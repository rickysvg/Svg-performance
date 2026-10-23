import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getLatestSubscription } from "@/lib/access";
import { applyStripeEvent } from "@/lib/billing";
import { isCheckoutSkuId } from "@/lib/plans";
import { memberProCopy } from "@/lib/member-pro-reminders";
import {
  billingPlanFromStored,
  catalogPlanFromStored,
} from "@/lib/pro-annual-record";
import { PERFORMANCE_ANNUAL, PERFORMANCE_MONTHLY } from "@/lib/pricing";
import { inferProPeriod, unusedSubscriptionCents } from "@/lib/vip-coaching";
import { proUnusedCentsForUser } from "@/lib/vip-store";
import { makeUser, resetDatabase } from "./helpers";

type SubRow = { plan: string; status: string; stripePriceId: string; founding: boolean } | null;

const YEAR_PRICE = "price_test_year";
const OTHER_PRICE = "price_test_other";

describe("subscription price ids leave the unused seat flag alone", () => {
  const snapshot = {
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_WEBHOOK_SECRET,
  };

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    if (snapshot.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = snapshot.secret;
    if (snapshot.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = snapshot.webhook;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not offer a retired annual checkout sku", () => {
    expect(isCheckoutSkuId("performance_founding")).toBe(false);
    expect(isCheckoutSkuId("performance_founding_gym")).toBe(false);
    expect(isCheckoutSkuId("conditioning_founding_gym")).toBe(false);
    expect(isCheckoutSkuId("conditioning_founding_non")).toBe(false);
    expect(PERFORMANCE_MONTHLY).toBe(9.99);
    expect(PERFORMANCE_ANNUAL).toBe(72.99);
  });

  it("stores a Pro checkout as performance and does not set the unused flag", async () => {
    const user = await makeUser("pro@example.com");
    const row = (await applyStripeEvent({
      id: "evt_year_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { userId: user.id, plan: "performance_year" },
          subscription: "sub_year_1",
          items: { data: [{ price: { id: YEAR_PRICE } }] },
        },
      },
    })) as SubRow;
    expect(row?.plan).toBe("performance");
    expect(row?.stripePriceId).toBe(YEAR_PRICE);
    expect(row?.founding).toBe(false);
  });

  it("keeps a stored flag when a later webhook omits it", async () => {
    const user = await makeUser("kept@example.com");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        stripeSubscriptionId: "sub_kept",
        stripePriceId: YEAR_PRICE,
        founding: true,
      },
    });

    const failed = (await applyStripeEvent({
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_1",
          subscription: "sub_kept",
          metadata: { userId: user.id, plan: "performance_year" },
        },
      },
    })) as SubRow;
    expect(failed?.status).toBe("past_due");
    expect(failed?.stripePriceId).toBe(YEAR_PRICE);
    expect(failed?.founding).toBe(true);

    const updated = (await applyStripeEvent({
      id: "evt_update",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_kept",
          status: "active",
          metadata: { userId: user.id, plan: "performance_year" },
          items: { data: [{ price: { id: OTHER_PRICE } }] },
        },
      },
    })) as SubRow;
    expect(updated?.stripePriceId).toBe(OTHER_PRICE);
    expect(updated?.founding).toBe(true);
  });

  it("reads an exact retired id as Pro annual and does not delete the row", async () => {
    expect(catalogPlanFromStored({ plan: "coaching", founding: true })).toBe("coaching");
    expect(billingPlanFromStored({ plan: "elite", founding: true })).toBe("elite");
    expect(catalogPlanFromStored({ plan: "coaching_founding", founding: true })).toBe("coaching");
    expect(catalogPlanFromStored({ plan: "elite_founding" })).toBe("elite");
    expect(catalogPlanFromStored({ plan: "pro_founding_annual" })).toBe("member_access");
    expect(catalogPlanFromStored({ plan: "nonfounding" })).toBe("member_access");
    expect(billingPlanFromStored({ plan: "performance", founding: true })).toBe("performance");
    expect(catalogPlanFromStored({ plan: "conditioning_founding_non" })).toBe("performance");
    expect(billingPlanFromStored({ plan: "  Performance_Founding " })).toBe("performance_year");
    expect(catalogPlanFromStored({ plan: "performance_founding_non" })).toBe("performance");

    const user = await makeUser("legacy-annual@example.com");
    const periodEnd = new Date("2026-12-01T00:00:00.000Z");
    const created = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance_founding",
        status: "active",
        stripeSubscriptionId: "sub_legacy_annual",
        stripePriceId: "price_retired_annual",
        founding: true,
        currentPeriodEnd: periodEnd,
      },
    });

    const viewed = await getLatestSubscription(user.id);
    expect(viewed?.plan).toBe("performance_year");
    const stored = await prisma.subscription.findUnique({ where: { id: created.id } });
    expect(stored?.plan).toBe("performance_founding");
    expect(stored?.founding).toBe(true);
    expect(stored?.stripePriceId).toBe("price_retired_annual");

    const now = new Date("2026-11-20T00:00:00.000Z");
    const annual = inferProPeriod({ periodEnd, annual: true });
    expect(annual.priceCents).toBe(7299);
    expect(await proUnusedCentsForUser(user.id, now)).toBe(
      unusedSubscriptionCents({
        priceCents: annual.priceCents,
        periodStart: annual.periodStart,
        periodEnd,
        now,
      }),
    );
  });

  it("uses monthly Pro after the plan leaves the retired seat, and keeps annual while the price is still that seat", async () => {
    const day = 24 * 60 * 60 * 1000;
    const now = new Date("2026-10-01T00:00:00.000Z");
    const periodEnd = new Date(now.getTime() + 20 * day);
    const monthly = inferProPeriod({ periodEnd, annual: false });
    const annual = inferProPeriod({ periodEnd, annual: true });
    const monthlyCents = unusedSubscriptionCents({
      priceCents: monthly.priceCents,
      periodStart: monthly.periodStart,
      periodEnd,
      now,
    });
    const annualCents = unusedSubscriptionCents({
      priceCents: annual.priceCents,
      periodStart: annual.periodStart,
      periodEnd,
      now,
    });
    expect(monthlyCents).toBe(666);
    expect(annualCents).toBe(400);

    const moved = await makeUser("moved-monthly@example.com");
    await prisma.subscription.create({
      data: {
        userId: moved.id,
        plan: "performance",
        status: "active",
        stripeSubscriptionId: "sub_moved",
        stripePriceId: "price_now_monthly",
        founding: true,
        currentPeriodEnd: periodEnd,
      },
    });
    expect((await getLatestSubscription(moved.id))?.plan).toBe("performance");
    expect(await proUnusedCentsForUser(moved.id, now)).toBe(666);

    const previousFounding = process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING;
    const previousMonthly = process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY;
    try {
      const priced = await makeUser("still-retired-price@example.com");
      process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = "price_still_retired";
      await prisma.subscription.create({
        data: {
          userId: priced.id,
          plan: "performance",
          status: "active",
          stripeSubscriptionId: "sub_priced",
          stripePriceId: "price_still_retired",
          founding: true,
          currentPeriodEnd: periodEnd,
        },
      });
      expect((await getLatestSubscription(priced.id))?.plan).toBe("performance_year");
      expect(await proUnusedCentsForUser(priced.id, now)).toBe(400);

      process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY = "price_current_month";
      const repriced = await makeUser("repriced@example.com");
      await prisma.subscription.create({
        data: {
          userId: repriced.id,
          plan: "performance_founding",
          status: "active",
          stripeSubscriptionId: "sub_repriced",
          stripePriceId: "price_current_month",
          founding: true,
          currentPeriodEnd: periodEnd,
        },
      });
      expect(
        billingPlanFromStored({
          plan: "performance_founding",
          founding: true,
          stripePriceId: "price_current_month",
        }),
      ).toBe("performance_founding");
      expect(await proUnusedCentsForUser(repriced.id, now)).toBe(666);
    } finally {
      if (previousFounding === undefined) delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING;
      else process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = previousFounding;
      if (previousMonthly === undefined) delete process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY;
      else process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY = previousMonthly;
    }
  });

  it("records a retired checkout id as Pro annual without setting the stored flag", async () => {
    const user = await makeUser("retired-sku@example.com");
    const row = (await applyStripeEvent({
      id: "evt_retired_sku",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_retired",
          metadata: { userId: user.id, plan: "performance_founding" },
          subscription: "sub_retired",
          items: { data: [{ price: { id: "price_retired_sku" } }] },
        },
      },
    })) as SubRow;
    expect(row?.plan).toBe("performance_year");
    expect(row?.stripePriceId).toBe("price_retired_sku");
    expect(row?.founding).toBe(false);
    const stored = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(stored?.plan).toBe("performance_year");
    expect(stored?.founding).toBe(false);
  });

  it("keeps Pro reminder copy on the public prices", () => {
    const recap = { workouts: 6, checkIns: 1, aiMessages: 2 };
    for (const stage of ["day25", "day29", "day31"] as const) {
      const body = memberProCopy(stage, recap).body;
      expect(body).not.toMatch(/founding/i);
      expect(body).not.toMatch(/\$59/);
    }
    expect(memberProCopy("day25", recap).body).toMatch(/\$9\.99\/mo or \$72\.99\/yr/);
    expect(memberProCopy("day31", recap).body).toMatch(/30 days of history/);
  });
});
