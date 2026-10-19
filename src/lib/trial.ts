import { loggedSetSome } from "@/lib/logged-work";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { type CatalogPlanId, type CatalogPlan, planAtLeast } from "@/lib/plans";
import { isGymdeskSyncEnabled } from "@/lib/gymdesk/config";
import { matchUserToGymdesk } from "@/lib/gymdesk/match";
import { recomputeMembership } from "@/lib/gymdesk/recompute";

import { MEMBER_PRO_DAYS, NONMEMBER_TRIAL_DAYS as NONMEMBER_DAYS } from "@/lib/pricing";

/** Verified academy members: Pro free for 30 days, no card, never auto-billed. */
export const MEMBER_TRIAL_DAYS = MEMBER_PRO_DAYS;
/** Nonmembers: 7-day no-card Pro trial, then Pro is required. */
export const NONMEMBER_TRIAL_DAYS = NONMEMBER_DAYS;

export type TrialState = {
  verified: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  planChoiceAt: Date | null;
  thirdWorkoutCardDismissedAt: Date | null;
  trialUsed: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  trialLengthDays: number;
  canStartTrial: boolean;
};

export function trialLengthDays(verified: boolean) {
  return verified ? MEMBER_TRIAL_DAYS : NONMEMBER_TRIAL_DAYS;
}

export function isTrialActive(trialEndsAt: Date | null, now = new Date()) {
  return Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
}

export function trialDaysLeft(trialEndsAt: Date | null, now = new Date()) {
  if (!trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function addTrialDays(start: Date, days: number) {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function trialLabel(daysLeft: number) {
  const unit = daysLeft === 1 ? "day" : "days";
  return `Trial: ${daysLeft} ${unit} left`;
}

export async function getTrialState(userId: string, now = new Date()): Promise<TrialState> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      gymMembershipVerified: true,
      trialStartedAt: true,
      trialEndsAt: true,
      planChoiceAt: true,
      thirdWorkoutCardDismissedAt: true,
      memberProStartedAt: true,
    },
  });
  const verified = Boolean(profile?.gymMembershipVerified);
  const trialStartedAt = profile?.trialStartedAt ?? null;
  const trialEndsAt = profile?.trialEndsAt ?? null;
  // Verified members get one 30-day Pro month even if they used a nonmember trial before.
  const trialUsed = verified
    ? Boolean(profile?.memberProStartedAt)
    : Boolean(trialStartedAt || trialEndsAt);
  const active = isTrialActive(trialEndsAt, now);
  return {
    verified,
    trialStartedAt,
    trialEndsAt,
    planChoiceAt: profile?.planChoiceAt ?? null,
    thirdWorkoutCardDismissedAt: profile?.thirdWorkoutCardDismissedAt ?? null,
    trialUsed,
    trialActive: active,
    trialDaysLeft: active ? trialDaysLeft(trialEndsAt, now) : 0,
    trialLengthDays: trialLengthDays(verified),
    canStartTrial: !trialUsed,
  };
}

export async function startTrialForUser(userId: string, now = new Date()) {
  if (isGymdeskSyncEnabled()) {
    await matchUserToGymdesk(userId, now);
    await recomputeMembership(userId, now);
  }
  const state = await getTrialState(userId, now);
  if (state.trialUsed) {
    throw new AppError("TRIAL", "This account already used its free trial.");
  }
  const days = state.trialLengthDays;
  const trialEndsAt = addTrialDays(now, days);
  const row = await prisma.profile.update({
    where: { userId },
    data: {
      trialStartedAt: now,
      trialEndsAt,
      planChoiceAt: state.planChoiceAt ?? now,
      ...(state.verified ? { memberProStartedAt: now } : {}),
    },
  });
  return {
    trialStartedAt: row.trialStartedAt,
    trialEndsAt: row.trialEndsAt,
    days,
    verified: state.verified,
  };
}

/**
 * Start the 30-day member Pro month once for a verified academy member. No card.
 * Safe to call on every request; it only writes the first time.
 */
export async function ensureMemberProMonth(userId: string, now = new Date()) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { gymMembershipVerified: true, memberProStartedAt: true, planChoiceAt: true },
  });
  if (!profile?.gymMembershipVerified || profile.memberProStartedAt) return null;
  return prisma.profile.update({
    where: { userId },
    data: {
      memberProStartedAt: now,
      trialStartedAt: now,
      trialEndsAt: addTrialDays(now, MEMBER_TRIAL_DAYS),
      planChoiceAt: profile.planChoiceAt ?? now,
    },
  });
}

/** Day of the member Pro month, 1-based. Null when the month never started. */
export function memberProDay(memberProStartedAt: Date | null, now = new Date()) {
  if (!memberProStartedAt) return null;
  const ms = now.getTime() - memberProStartedAt.getTime();
  if (ms < 0) return 1;
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export async function continueWithFreePlan(userId: string, now = new Date()) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new AppError("TRIAL", "Profile not found.");
  }
  if (existing.planChoiceAt) {
    return existing;
  }
  return prisma.profile.update({
    where: { userId },
    data: { planChoiceAt: now },
  });
}

export async function dismissThirdWorkoutCard(userId: string, now = new Date()) {
  return prisma.profile.update({
    where: { userId },
    data: { thirdWorkoutCardDismissedAt: now },
  });
}

export async function countCompleteWorkoutsForUser(userId: string) {
  return prisma.workoutSession.count({
    where: { userId, status: "complete", sets: loggedSetSome },
  });
}

export async function shouldShowThirdWorkoutCard(
  userId: string,
  planId: CatalogPlanId,
  now = new Date(),
) {
  if (planAtLeast(planId, "performance")) {
    return false;
  }
  const state = await getTrialState(userId, now);
  if (state.trialUsed || state.thirdWorkoutCardDismissedAt) {
    return false;
  }
  const sessions = await countCompleteWorkoutsForUser(userId);
  return sessions >= 3;
}

export function paidPlanPriceCopy(plan: CatalogPlan, verified: boolean) {
  const samePrice = plan.gymPriceLabel === plan.nonmemberPriceLabel;
  if (samePrice) {
    return {
      headline: plan.gymPriceLabel,
      normally: null as string | null,
      academyHint: !verified && plan.section !== "vip",
    };
  }
  if (verified) {
    return {
      headline: plan.gymPriceLabel,
      normally: plan.nonmemberPriceLabel,
      academyHint: false,
    };
  }
  return {
    headline: plan.nonmemberPriceLabel,
    normally: null as string | null,
    academyHint: true,
  };
}

export const ACADEMY_PRICE_HINT =
  "Train at SVG MMA Academy? Verified members get the core app with their dues and Pro free for 30 days.";
