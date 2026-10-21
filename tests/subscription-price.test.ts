import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent } from "@/lib/billing";
import { isCheckoutSkuId } from "@/lib/plans";
import { memberProCopy } from "@/lib/member-pro-reminders";
import { PERFORMANCE_ANNUAL, PERFORMANCE_MONTHLY } from "@/lib/pricing";
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
