import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent, assertCanCheckoutPlan, countFoundingSeats } from "@/lib/billing";
import { loadFoundingOffer } from "@/lib/founding-offer";
import { CHECKOUT_SKUS, isCheckoutSkuId } from "@/lib/plans";
import { FOUNDING_CAP, isFoundingDealOpen } from "@/lib/pricing";
import { memberProCopy } from "@/lib/member-pro-reminders";
import { makeUser, resetDatabase } from "./helpers";

type SubRow = { plan: string; status: string; stripePriceId: string; founding: boolean } | null;

const FOUNDING_PRICE = "price_test_founding";
const YEAR_PRICE = "price_test_year";

describe("founding seat count", () => {
  const snapshot = {
    founding: process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING,
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_WEBHOOK_SECRET,
  };

  beforeEach(async () => {
    await resetDatabase();
    process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = FOUNDING_PRICE;
  });

  afterEach(() => {
    if (snapshot.founding === undefined) delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING;
    else process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = snapshot.founding;
    if (snapshot.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = snapshot.secret;
    if (snapshot.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = snapshot.webhook;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("offers one $59 founding SKU that academy members can claim, and keeps checkout off", () => {
    expect(isCheckoutSkuId("performance_founding")).toBe(true);
    expect(isCheckoutSkuId("performance_founding_gym")).toBe(false);
    expect(isCheckoutSkuId("performance_founding_non")).toBe(false);
    expect(CHECKOUT_SKUS.performance_founding.amountCents).toBe(5900);
    expect(CHECKOUT_SKUS.performance_founding.requiresGymVerify).toBe(false);
    expect(CHECKOUT_SKUS.performance_founding.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.performance_founding.envPrice).toBe("STRIPE_PRICE_PERFORMANCE_FOUNDING");
  });

  it("counts a founding checkout even though the stored plan is 'performance'", async () => {
    const user = await makeUser("founder@example.com");
    const row = (await applyStripeEvent({
      id: "evt_founding_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          metadata: { userId: user.id, plan: "performance_founding" },
          subscription: "sub_founding_1",
        },
      },
    })) as SubRow;
    expect(row?.plan).toBe("performance");
    expect(row?.founding).toBe(true);
    expect(await countFoundingSeats()).toBe(1);
    const offer = await loadFoundingOffer();
    expect(offer?.spotsLeft).toBe(FOUNDING_CAP - 1);
    expect(offer?.line).toBe(
      "Founding member: $59/yr. 39 of 40 left. Academy members can claim it.",
    );
  });

  it("stores the Stripe price ID on create and update, and keeps it on payment failure", async () => {
    const user = await makeUser("price@example.com");
    await applyStripeEvent({
      id: "evt_create",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_2",
          metadata: { userId: user.id, plan: "performance_year" },
          items: { data: [{ price: { id: YEAR_PRICE } }] },
        },
      },
    });
    expect(await countFoundingSeats()).toBe(0);

    const updated = (await applyStripeEvent({
      id: "evt_update",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_2",
          status: "active",
          metadata: { userId: user.id, plan: "performance_year" },
          items: { data: [{ price: { id: FOUNDING_PRICE } }] },
        },
      },
    })) as SubRow;
    expect(updated?.stripePriceId).toBe(FOUNDING_PRICE);
    expect(updated?.founding).toBe(true);
    expect(await countFoundingSeats()).toBe(1);

    const failed = (await applyStripeEvent({
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_1",
          subscription: "sub_2",
          metadata: { userId: user.id, plan: "performance_year" },
        },
      },
    })) as SubRow;
    expect(failed?.stripePriceId).toBe(FOUNDING_PRICE);
    expect(failed?.status).toBe("past_due");
    expect(await countFoundingSeats()).toBe(0);
  });

  it("counts rows that carry only a founding price ID", async () => {
    const user = await makeUser("legacy@example.com");
    await prisma.subscription.create({
      data: { userId: user.id, plan: "performance", status: "active", stripePriceId: FOUNDING_PRICE },
    });
    expect(await countFoundingSeats()).toBe(1);
  });

  it("caps founding at 40 and hides the public line when the cap is full", async () => {
    expect(FOUNDING_CAP).toBe(40);
    expect(isFoundingDealOpen(39)).toBe(true);
    expect(isFoundingDealOpen(40)).toBe(false);
    for (let i = 0; i < FOUNDING_CAP; i += 1) {
      const user = await prisma.user.create({
        data: { email: `seat${i}@example.com`, passwordHash: "x" },
      });
      await prisma.subscription.create({
        data: { userId: user.id, plan: "performance", status: "active", founding: true },
      });
    }
    expect(await countFoundingSeats()).toBe(40);
    expect(await loadFoundingOffer()).toBeNull();
  });

  it("still refuses founding checkout while paid plans are off", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    const user = await makeUser("founding-soon@example.com");
    await expect(assertCanCheckoutPlan(user.id, "performance_founding")).rejects.toMatchObject({
      code: "BILLING",
      message: "Paid plans coming soon.",
    });
  });

  it("adds the live line to member Pro reminder copy only while the deal is open", () => {
    const recap = { workouts: 6, checkIns: 1, aiMessages: 2 };
    const line = "Founding member: $59/yr. 12 of 40 left. Academy members can claim it.";
    expect(memberProCopy("day25", recap).body).not.toMatch(/Founding/);
    expect(memberProCopy("day25", recap, line).body).toContain(line);
    expect(memberProCopy("day29", recap, line).body).toContain("12 of 40 left");
    expect(memberProCopy("day31", recap, line).body).toContain(line);
    expect(memberProCopy("day31", recap).body).toMatch(/30 days of history/);
  });
});
