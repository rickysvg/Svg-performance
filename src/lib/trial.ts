import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { type CatalogPlanId, type CatalogPlan, planAtLeast } from "@/lib/plans";

export const MEMBER_TRIAL_DAYS = 14;
export const NONMEMBER_TRIAL_DAYS = 7;

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
    },
  });
  const verified = Boolean(profile?.gymMembershipVerified);
  const trialStartedAt = profile?.trialStartedAt ?? null;
  const trialEndsAt = profile?.trialEndsAt ?? null;
  const trialUsed = Boolean(trialStartedAt || trialEndsAt);
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
    },
  });
  return {
    trialStartedAt: row.trialStartedAt,
    trialEndsAt: row.trialEndsAt,
    days,
    verified: state.verified,
  };
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
    where: { userId, status: "complete" },
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
      perk: null as string | null,
      academyHint: !verified && plan.section !== "vip",
    };
  }
  if (verified) {
    return {
      headline: plan.gymPriceLabel,
      perk: `Academy member price ${plan.gymPriceLabel} (normally ${plan.nonmemberPriceLabel})`,
      academyHint: false,
    };
  }
  return {
    headline: plan.nonmemberPriceLabel,
    perk: null as string | null,
    academyHint: true,
  };
}

export const ACADEMY_PRICE_HINT = "Train at SVG MMA Academy? Get the member price.";
