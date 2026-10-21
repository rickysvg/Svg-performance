import { prisma } from "@/lib/prisma";
import { loggedSetSome } from "@/lib/logged-work";
import { sendPushToUser } from "@/lib/weekly-checkin-push";
import { getAppTier } from "@/lib/entitlements";
import { memberProDay, memberProGrantDays } from "@/lib/trial";
import {
  LEGACY_MEMBER_PRO_DAYS,
  MEMBER_PRO_DAYS,
  PERFORMANCE_ANNUAL,
  PERFORMANCE_MONTHLY,
  usd,
} from "@/lib/pricing";

export type MemberProStage = "day25" | "day29" | "day31";

/**
 * Recap while 5 days are left, last days of the grant, then the week after it ends.
 * Stage ids stay day25 / day29 / day31 so a grant is reminded once.
 * A 14-day grant uses days 9–12, 13–14, and 15–21. A 30-day grant keeps 25–28, 29–30, and 31–37.
 */
export function memberProStage(
  day: number | null,
  grantDays = LEGACY_MEMBER_PRO_DAYS,
): MemberProStage | null {
  if (day == null) return null;
  const length = grantDays >= 1 ? Math.floor(grantDays) : LEGACY_MEMBER_PRO_DAYS;
  const fiveLeft = length - 5;
  if (fiveLeft >= 1 && day >= fiveLeft && day <= length - 2) return "day25";
  if (day >= length - 1 && day <= length) return "day29";
  if (day >= length + 1 && day <= length + 7) return "day31";
  return null;
}

export type MemberProRecap = { workouts: number; checkIns: number; aiMessages: number };

export async function memberProRecap(userId: string, since: Date): Promise<MemberProRecap> {
  const [workouts, checkIns, aiMessages] = await Promise.all([
    prisma.workoutSession.count({
      where: { userId, status: "complete", sets: loggedSetSome, createdAt: { gte: since } },
    }),
    prisma.weeklyCheckIn.count({ where: { userId, submittedAt: { gte: since } } }),
    prisma.aiUsageEvent.count({ where: { userId, kind: "message", createdAt: { gte: since } } }),
  ]);
  return { workouts, checkIns, aiMessages };
}

function recapLine(recap: MemberProRecap) {
  const w = `${recap.workouts} workout${recap.workouts === 1 ? "" : "s"}`;
  const c = `${recap.checkIns} check-in${recap.checkIns === 1 ? "" : "s"}`;
  const a = `${recap.aiMessages} coach message${recap.aiMessages === 1 ? "" : "s"}`;
  return `${w}, ${c}, and ${a} so far.`;
}

const PRICE = `${usd(PERFORMANCE_MONTHLY)}/mo or ${usd(PERFORMANCE_ANNUAL)}/yr`;

export function memberProCopy(stage: MemberProStage, recap: MemberProRecap) {
  if (stage === "day25") {
    return {
      title: "5 days left of free Pro",
      body: `${recapLine(recap)} Keep Pro for ${PRICE}, or stay on the core app with your dues. No card on file, never auto-billed.`,
      cta: "Keep Pro",
    };
  }
  if (stage === "day29") {
    return {
      title: "Last day of free Pro",
      body: `Tomorrow you go back to the core app included with your dues. Keep AI coach chat, Today's Summary, and full history for ${PRICE}.`,
      cta: "Keep Pro",
    };
  }
  return {
    title: "Your free Pro ended",
    body: `You're on the core app included with your dues: rounds, mobility and form libraries, standard SVG blocks, calendar, sparring log, weekly check-in, Fuel logging, and 30 days of history. AI coach chat stays on Pro. ${recapLine(recap).replace(" so far.", " during free Pro.")}`,
    cta: `Upgrade to Pro · ${usd(PERFORMANCE_MONTHLY)}/mo`,
  };
}

export type MemberProCronResult = { checked: number; sent: number; skipped: number };

/** Sends each stage once per member (push). Safe to run hourly. */
export async function runMemberProReminderCron(now = new Date()): Promise<MemberProCronResult> {
  const lookbackDays = Math.max(MEMBER_PRO_DAYS, LEGACY_MEMBER_PRO_DAYS) + 7;
  const earliest = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const profiles = await prisma.profile.findMany({
    where: { gymMembershipVerified: true, memberProStartedAt: { gte: earliest } },
    select: { userId: true, memberProStartedAt: true, memberProDays: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const grantDays = memberProGrantDays(profile.memberProDays);
    const stage = memberProStage(memberProDay(profile.memberProStartedAt, now), grantDays);
    if (!stage) {
      skipped += 1;
      continue;
    }
    // Members who already bought Pro do not need the offer.
    if (stage !== "day31" && (await hasPaidPro(profile.userId, now))) {
      skipped += 1;
      continue;
    }
    if (stage === "day31" && (await getAppTier(profile.userId, now)) === "pro") {
      skipped += 1;
      continue;
    }
    const already = await prisma.memberProReminderLog.findUnique({
      where: { userId_stage: { userId: profile.userId, stage } },
    });
    if (already) {
      skipped += 1;
      continue;
    }
    const recap = await memberProRecap(profile.userId, profile.memberProStartedAt!);
    const copy = memberProCopy(stage, recap);
    await sendPushToUser(profile.userId, { title: copy.title, body: copy.body, url: "/pricing" });
    await prisma.memberProReminderLog.create({
      data: { userId: profile.userId, stage, channel: "push" },
    });
    sent += 1;
  }
  return { checked: profiles.length, sent, skipped };
}

async function hasPaidPro(userId: string, now: Date) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  return Boolean(sub && !(sub.currentPeriodEnd && sub.currentPeriodEnd < now));
}
