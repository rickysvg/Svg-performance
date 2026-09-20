import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { setGymMembershipVerified } from "@/lib/admin";
import { assertCanCheckoutPlan } from "@/lib/billing";
import { makeUser, resetDatabase } from "./helpers";

describe("gym checkbox vs admin verify", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_STANDALONE;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not let a member verify themselves or anyone else", async () => {
    const member = await makeUser("claim@example.com", true);
    const other = await makeUser("target@example.com");
    await expect(
      setGymMembershipVerified({
        adminUserId: member.id,
        targetUserId: member.id,
        verified: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setGymMembershipVerified({
        adminUserId: member.id,
        targetUserId: other.id,
        verified: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const profile = await getProfileForUser(member.id);
    expect(profile?.claimsGymMembership).toBe(true);
    expect(profile?.gymMembershipVerified).toBe(false);
  });

  it("lets an admin verify, which is required for the $19 gym checkout", async () => {
    const admin = await makeUser("boss@example.com", false, "admin");
    const member = await makeUser("gym@example.com", true);
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
    process.env.STRIPE_PRICE_GYM = "price_gym";

    await expect(assertCanCheckoutPlan(member.id, "gym")).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    await setGymMembershipVerified({
      adminUserId: admin.id,
      targetUserId: member.id,
      verified: true,
    });
    const profile = await getProfileForUser(member.id);
    expect(profile?.gymMembershipVerified).toBe(true);
    await expect(assertCanCheckoutPlan(member.id, "gym")).resolves.toBeUndefined();
  });
});
