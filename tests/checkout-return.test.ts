import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkoutSessionBelongsToUser, fulfillCheckoutSession } from "@/lib/checkout-return";
import { hasWebhookGrantedAccess } from "@/lib/access";
import { makeUser, resetDatabase } from "./helpers";

describe("checkout return fulfillment", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a session that belongs to someone else", () => {
    expect(
      checkoutSessionBelongsToUser({ metadata: { userId: "other" }, client_reference_id: "other" }, "me"),
    ).toBe(false);
    expect(checkoutSessionBelongsToUser({ metadata: { userId: "me" }, customer: "cus_a" }, "me", "cus_b")).toBe(
      false,
    );
    expect(checkoutSessionBelongsToUser({ metadata: { userId: "me" }, customer: "cus_a" }, "me", "cus_a")).toBe(
      true,
    );
  });

  it("stores the subscription through the webhook path for the signed-in member", async () => {
    const user = await makeUser("return@example.com");
    const result = await fulfillCheckoutSession({
      userId: user.id,
      sessionId: "cs_test_return",
      stripe: {
        checkout: {
          sessions: {
            retrieve: async () => ({
              id: "cs_test_return",
              metadata: { userId: user.id, plan: "performance_monthly", priceId: "price_pro_mo" },
              client_reference_id: user.id,
              customer: "cus_return",
              payment_status: "no_payment_required",
              subscription: {
                id: "sub_return",
                status: "trialing",
                customer: "cus_return",
                metadata: { userId: user.id, plan: "performance_monthly" },
                trial_end: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
                items: { data: [{ price: { id: "price_pro_mo" } }] },
              },
            }),
          },
        },
        subscriptions: { retrieve: async () => { throw new Error("already expanded"); } },
      },
    });
    expect(result).toEqual({ ok: true, reason: "stored" });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({
      stripeCustomerId: "cus_return",
      stripeSubscriptionId: "sub_return",
      status: "trialing",
      billingSku: "performance_monthly",
    });
    const again = await fulfillCheckoutSession({
      userId: user.id,
      sessionId: "cs_test_return",
      knownCustomerId: "cus_return",
      stripe: {
        checkout: {
          sessions: {
            retrieve: async () => ({
              id: "cs_test_return",
              metadata: { userId: user.id, plan: "performance_monthly" },
              customer: "cus_return",
              payment_status: "no_payment_required",
              subscription: "sub_return",
            }),
          },
        },
        subscriptions: {
          retrieve: async () => ({
            id: "sub_return",
            status: "trialing",
            customer: "cus_return",
            metadata: { userId: user.id, plan: "performance_monthly" },
          }),
        },
      },
    });
    expect(again.ok).toBe(true);
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(1);
  });
});
