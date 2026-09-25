import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { canUseFeature, getEffectivePlanId } from "@/lib/entitlements";
import { canUseMemberTools } from "@/lib/access";
import {
  MEMBER_TRIAL_DAYS,
  NONMEMBER_TRIAL_DAYS,
  addTrialDays,
  continueWithFreePlan,
  getTrialState,
  shouldShowThirdWorkoutCard,
  startTrialForUser,
  trialDaysLeft,
  trialLengthDays,
} from "@/lib/trial";

function turnStripeOn() {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
  process.env.STRIPE_PRICE_GYM = "price_gym";
}

function turnStripeOff() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_STANDALONE;
  delete process.env.STRIPE_PRICE_GYM;
}

async function verifyMember(userId: string) {
  await prisma.profile.update({
    where: { userId },
    data: { gymMembershipVerified: true },
  });
}

describe("member free tier and Performance trial", () => {
  beforeEach(async () => {
    await resetDatabase();
    turnStripeOn();
  });

  afterAll(async () => {
    turnStripeOff();
    await prisma.$disconnect();
  });

  it("keeps verified members and nonmembers on the free tier without a trial", async () => {
    const member = await makeUser("free-member@example.com");
    await verifyMember(member.id);
    const guest = await makeUser("free-guest@example.com");

    expect(await getEffectivePlanId(member.id)).toBe("member_access");
    expect(await getEffectivePlanId(guest.id)).toBe("member_access");
    expect(await canUseFeature(member.id, "training")).toBe(true);
    expect(await canUseFeature(member.id, "learn_beginner")).toBe(true);
    expect(await canUseFeature(member.id, "learn_full")).toBe(false);
    expect(await canUseFeature(member.id, "nutrition")).toBe(false);
    expect(await canUseFeature(member.id, "ai")).toBe(false);
    expect(await canUseFeature(member.id, "daily_quote")).toBe(false);
    expect((await canUseMemberTools(member.id)).allowed).toBe(false);
  });

  it("treats an active trial as Performance", async () => {
    const user = await makeUser("trial-on@example.com");
    await verifyMember(user.id);
    const started = await startTrialForUser(user.id);
    expect(started.days).toBe(MEMBER_TRIAL_DAYS);
    expect(await getEffectivePlanId(user.id)).toBe("performance");
    expect(await canUseFeature(user.id, "learn_full")).toBe(true);
    expect(await canUseFeature(user.id, "nutrition")).toBe(true);
    expect(await canUseFeature(user.id, "ai")).toBe(true);
    expect(await canUseFeature(user.id, "daily_quote")).toBe(true);
    expect(await canUseFeature(user.id, "coaching")).toBe(false);
    expect((await canUseMemberTools(user.id)).allowed).toBe(true);
    const state = await getTrialState(user.id);
    expect(state.trialActive).toBe(true);
    expect(state.trialDaysLeft).toBe(MEMBER_TRIAL_DAYS);
    expect(state.canStartTrial).toBe(false);
  });

  it("falls back to the free tier when the trial ends", async () => {
    const user = await makeUser("trial-off@example.com");
    const ended = addTrialDays(new Date(), -1);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        trialStartedAt: addTrialDays(ended, -MEMBER_TRIAL_DAYS),
        trialEndsAt: ended,
      },
    });
    expect(await getEffectivePlanId(user.id)).toBe("member_access");
    expect(await canUseFeature(user.id, "nutrition")).toBe(false);
    expect(await canUseFeature(user.id, "ai")).toBe(false);
    expect(await canUseFeature(user.id, "learn_full")).toBe(false);
    const state = await getTrialState(user.id);
    expect(state.trialActive).toBe(false);
    expect(state.trialUsed).toBe(true);
    expect(state.canStartTrial).toBe(false);
  });

  it("allows only one trial per account", async () => {
    const user = await makeUser("one-trial@example.com");
    await startTrialForUser(user.id);
    await expect(startTrialForUser(user.id)).rejects.toBeInstanceOf(AppError);
    await prisma.profile.update({
      where: { userId: user.id },
      data: { trialEndsAt: addTrialDays(new Date(), -1) },
    });
    await expect(startTrialForUser(user.id)).rejects.toMatchObject({
      code: "TRIAL",
    });
    expect(await getEffectivePlanId(user.id)).toBe("member_access");
  });

  it("gives verified members 14 days and nonmembers 7", async () => {
    expect(trialLengthDays(true)).toBe(MEMBER_TRIAL_DAYS);
    expect(trialLengthDays(false)).toBe(NONMEMBER_TRIAL_DAYS);
    expect(MEMBER_TRIAL_DAYS).toBe(14);
    expect(NONMEMBER_TRIAL_DAYS).toBe(7);

    const member = await makeUser("days-member@example.com");
    await verifyMember(member.id);
    const guest = await makeUser("days-guest@example.com");
    const memberTrial = await startTrialForUser(member.id);
    const guestTrial = await startTrialForUser(guest.id);
    expect(memberTrial.days).toBe(14);
    expect(guestTrial.days).toBe(7);
    expect(trialDaysLeft(memberTrial.trialEndsAt)).toBe(14);
    expect(trialDaysLeft(guestTrial.trialEndsAt)).toBe(7);
  });

  it("shows the third-workout card once on free tier with no trial", async () => {
    const user = await makeUser("three-logs@example.com");
    expect(await shouldShowThirdWorkoutCard(user.id, "member_access")).toBe(false);
    for (let i = 0; i < 3; i += 1) {
      await prisma.workoutSession.create({
        data: {
          userId: user.id,
          title: `Session ${i + 1}`,
          status: "complete",
          performedAt: new Date(),
        },
      });
    }
    expect(await shouldShowThirdWorkoutCard(user.id, "member_access")).toBe(true);
    expect(await shouldShowThirdWorkoutCard(user.id, "performance")).toBe(false);
    await startTrialForUser(user.id);
    expect(await shouldShowThirdWorkoutCard(user.id, "member_access")).toBe(false);
  });

  it("records a free-plan choice without starting a trial", async () => {
    const user = await makeUser("stay-free@example.com");
    await continueWithFreePlan(user.id);
    const state = await getTrialState(user.id);
    expect(state.planChoiceAt).toBeTruthy();
    expect(state.trialUsed).toBe(false);
    expect(await getEffectivePlanId(user.id)).toBe("member_access");
  });
});
