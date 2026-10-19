import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent, countFoundingSeats } from "@/lib/billing";
import { FOUNDING_CAP, isFoundingDealOpen } from "@/lib/pricing";
import { makeUser, resetDatabase } from "./helpers";

type SubRow = { plan: string; status: string; stripePriceId: string; founding: boolean } | null;

const FOUNDING_PRICE = "price_test_founding";
const YEAR_PRICE = "price_test_year";

describe("founding seat count", () => {
  const snapshot = {
    founding: process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING,
  };

  beforeEach(async () => {
    await resetDatabase();
    process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = FOUNDING_PRICE;
  });

  afterEach(() => {
    if (snapshot.founding === undefined) delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING;
    else process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING = snapshot.founding;
  });

  afterAll(async () => {
    await prisma.$disconnect();
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

  it("caps founding at 100", () => {
    expect(FOUNDING_CAP).toBe(100);
    expect(isFoundingDealOpen(99)).toBe(true);
    expect(isFoundingDealOpen(100)).toBe(false);
  });
});
