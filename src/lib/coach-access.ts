import { getLatestSubscription } from "@/lib/access";
import { isDashboardAdmin } from "@/lib/admin-access";
import { normalizePlanId, planIsPro } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { trialDaysLeft } from "@/lib/trial";

/** First week of AI coach chat. No card. */
export const FREE_COACH_CHAT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shown when the free week is over and the account is not Pro or VIP. */
export const COACH_CHAT_LOCKED =
  "Your free week of AI coach chat ended. It stays open on Pro and VIP Coaching.";

export function freeCoachChatLabel(daysLeft: number) {
  const unit = daysLeft === 1 ? "day" : "days";
  return `${daysLeft} ${unit} of free coach chat left`;
}

/**
 * Days left in the free chat week.
 * An opt-in 7-day Pro trial is that window once it has been started.
 * The academy Pro grant is 14 days and does not extend chat past the first week.
 */
export function freeCoachChatDaysRemaining(input: {
  now: Date;
  createdAt: Date;
  trialEndsAt: Date | null;
  memberProStartedAt: Date | null;
}) {
  const fromAccount = new Date(input.createdAt.getTime() + FREE_COACH_CHAT_DAYS * DAY_MS);
  const end = !input.memberProStartedAt && input.trialEndsAt ? input.trialEndsAt : fromAccount;
  return trialDaysLeft(end, input.now);
}

export type CoachChatAccess = {
  allowed: boolean;
  /** Set during the free week. Null for a paid Pro or VIP plan, and for admins. */
  freeDaysLeft: number | null;
};

async function hasPaidCoachPlan(userId: string, now: Date) {
  const subscription = await getLatestSubscription(userId);
  if (subscription?.status !== "active") return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) return false;
  return planIsPro(normalizePlanId(subscription.plan));
}

/**
 * SVG Coach chat: a paid Pro or VIP plan, an admin, or the free first week.
 * Academy dues and a lapsed free account do not include chat.
 */
export async function getCoachChatAccess(
  user: { id: string; role: string; email: string },
  now = new Date(),
): Promise<CoachChatAccess> {
  if (isDashboardAdmin(user)) return { allowed: true, freeDaysLeft: null };
  if (await hasPaidCoachPlan(user.id, now)) return { allowed: true, freeDaysLeft: null };
  const [account, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { trialEndsAt: true, memberProStartedAt: true },
    }),
  ]);
  const freeDaysLeft = freeCoachChatDaysRemaining({
    now,
    createdAt: account?.createdAt ?? now,
    trialEndsAt: profile?.trialEndsAt ?? null,
    memberProStartedAt: profile?.memberProStartedAt ?? null,
  });
  return { allowed: freeDaysLeft > 0, freeDaysLeft };
}

export async function canUseCoachChat(
  user: { id: string; role: string; email: string },
  now = new Date(),
) {
  return (await getCoachChatAccess(user, now)).allowed;
}
