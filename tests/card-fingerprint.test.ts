import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { enforceCardFingerprint, otherAccountOwnsFingerprint } from "@/lib/card-fingerprint";
import { makeUser, resetDatabase } from "./helpers";

describe("card fingerprint trial block", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks a second account that presents a card already used", () => {
    expect(
      otherAccountOwnsFingerprint(
        [{ fingerprint: "fp_same", userId: "user_a" }],
        "fp_same",
        "user_b",
      ),
    ).toBe(true);
    expect(
      otherAccountOwnsFingerprint(
        [{ fingerprint: "fp_same", userId: "user_a" }],
        "fp_same",
        "user_a",
      ),
    ).toBe(false);
  });

  it("ends the Stripe trial and does not start the in-app clock for a reused card", async () => {
    const first = await makeUser("fp-owner@example.com");
    const second = await makeUser("fp-second@example.com");
    await prisma.cardFingerprint.create({ data: { fingerprint: "fp_same", userId: first.id } });
    await prisma.subscription.create({
      data: {
        userId: second.id,
        plan: "performance",
        status: "trialing",
        stripeSubscriptionId: "sub_second",
        source: "webhook",
      },
    });
    const updates: unknown[] = [];
    const result = await enforceCardFingerprint({
      stripe: {
        paymentMethods: {
          retrieve: async () => ({ card: { fingerprint: "fp_same" } }),
        },
        subscriptions: {
          retrieve: async () => ({ default_payment_method: "pm_1" }),
          update: async (_id, params) => {
            updates.push(params);
            return {};
          },
        },
      },
      userId: second.id,
      subscriptionId: "sub_second",
      paymentMethodId: "pm_1",
      trialing: true,
    });
    expect(result.revoked).toBe(true);
    expect(updates).toEqual([{ trial_end: "now" }]);
    const row = await prisma.subscription.findFirst({ where: { userId: second.id } });
    expect(row?.status).toBe("incomplete");
    const profile = await prisma.profile.findUnique({ where: { userId: second.id } });
    expect(profile?.proTrialUsedAt).toBeTruthy();
    expect(profile?.trialStartedAt).toBeNull();
  });
});
