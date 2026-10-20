import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent, countFoundingSeats } from "@/lib/billing";
import { CHECKOUT_SKUS, isCheckoutSkuId } from "@/lib/plans";
import { makeUser, resetDatabase } from "./helpers";

type SubRow = { plan: string; status: string; stripePriceId: string; founding: boolean } | null;

const YEAR_PRICE = "price_test_year";

describe("founding price removed", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING;
    delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING_GYM;
    delete process.env.STRIPE_PRICE_PERFORMANCE_FOUNDING_NON;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not offer a $59 founding checkout SKU", () => {
    expect(isCheckoutSkuId("performance_founding")).toBe(false);
    expect(isCheckoutSkuId("performance_founding_gym")).toBe(false);
    expect(isCheckoutSkuId("performance_founding_non")).toBe(false);
    expect("performance_founding" in CHECKOUT_SKUS).toBe(false);
    expect(CHECKOUT_SKUS.performance_monthly.amountCents).toBe(999);
    expect(CHECKOUT_SKUS.performance_year.amountCents).toBe(7299);
  });

  it("does not mark a performance_founding checkout as a founding seat", async () => {
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
    expect(row?.founding).toBe(false);
    expect(await countFoundingSeats()).toBe(0);
  });

  it("stores the Stripe price ID and does not treat a price ID as a founding seat", async () => {
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
          items: { data: [{ price: { id: YEAR_PRICE } }] },
        },
      },
    })) as SubRow;
    expect(updated?.stripePriceId).toBe(YEAR_PRICE);
    expect(updated?.founding).toBe(false);
    expect(await countFoundingSeats()).toBe(0);

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
    expect(failed?.stripePriceId).toBe(YEAR_PRICE);
    expect(failed?.status).toBe("past_due");
    expect(await countFoundingSeats()).toBe(0);
  });

  it("still counts a historical founding=true row and ignores a price id alone", async () => {
    const legacy = await makeUser("legacy@example.com");
    await prisma.subscription.create({
      data: { userId: legacy.id, plan: "performance", status: "active", stripePriceId: "price_old" },
    });
    expect(await countFoundingSeats()).toBe(0);

    const founder = await makeUser("stored@example.com");
    await prisma.subscription.create({
      data: {
        userId: founder.id,
        plan: "performance",
        status: "active",
        stripePriceId: "price_old",
        founding: true,
      },
    });
    expect(await countFoundingSeats()).toBe(1);
  });
});
