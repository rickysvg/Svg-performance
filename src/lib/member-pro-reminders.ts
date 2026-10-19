import { prisma } from "@/lib/prisma";
import { loggedSetSome } from "@/lib/logged-work";
import { sendPushToUser } from "@/lib/weekly-checkin-push";
import { getAppTier } from "@/lib/entitlements";
import { memberProDay } from "@/lib/trial";
import { MEMBER_PRO_DAYS, PERFORMANCE_ANNUAL, PERFORMANCE_MONTHLY, usd } from "@/lib/pricing";

export type MemberProStage = "day25" | "day29" | "day31";

/** Day 25 recap + offer, day 29 last day, day 31 downgrade summary. Shown for a short window. */
export function memberProStage(day: number | null): MemberProStage | null {
  if (day == null) return null;
  if (day >= 25 && day <= 28) return "day25";
  if (day >= 29 && day <= MEMBER_PRO_DAYS) return "day29";
  if (day >= MEMBER_PRO_DAYS + 1 && day <= MEMBER_PRO_DAYS + 7) return "day31";
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
      title: "5 days left of your Pro month",
      body: `${recapLine(recap)} Keep Pro for ${PRICE}, or stay on the core app with your dues. No card on file, never auto-billed.`,
      cta: "Keep Pro",
    };
  }
  if (stage === "day29") {
    return {
      title: "Last day of your Pro month",
      body: `Tomorrow you go back to the core app included with your dues. Keep AI coach chat with voices, Today's Summary, and full history for ${PRICE}.`,
      cta: "Keep Pro",
    };
  }
  return {
    title: "Your Pro month ended",
    body: `You're on the core app included with your dues: rounds, mobility and form libraries, standard SVG blocks, calendar, sparring log, weekly check-in, Fuel logging, 30 days of history, and 3 AI messages a week. ${recapLine(recap).replace(" so far.", " in your Pro month.")}`,
    cta: `Upgrade to Pro · ${usd(PERFORMANCE_MONTHLY)}/mo`,
  };
}

export type MemberProCronResult = { checked: number; sent: number; skipped: number };

/** Sends each stage once per member (push). Safe to run hourly. */
export async function runMemberProReminderCron(now = new Date()): Promise<MemberProCronResult> {
  const earliest = new Date(now.getTime() - (MEMBER_PRO_DAYS + 7) * 24 * 60 * 60 * 1000);
  const profiles = await prisma.profile.findMany({
    where: { gymMembershipVerified: true, memberProStartedAt: { gte: earliest } },
    select: { userId: true, memberProStartedAt: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const stage = memberProStage(memberProDay(profile.memberProStartedAt, now));
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
