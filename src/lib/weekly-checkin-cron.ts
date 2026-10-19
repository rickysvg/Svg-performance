import { prisma } from "@/lib/prisma";
import { performanceAppOrigin } from "@/lib/reminders";
import { reminderEmailHtml, sendMail } from "@/lib/mail";
import { resolveTimeZone } from "@/lib/timezone";
import { sendPushToUser, vapidConfig } from "@/lib/weekly-checkin-push";
import {
  checkInWeekKey,
  decideCheckInReminder,
  DEFAULT_REMINDER_MINUTE,
  DEFAULT_REMINDER_WEEKDAY,
  planIsOneOnOneCoaching,
  type ReminderDecision,
} from "@/lib/weekly-checkin-shared";

type Candidate = {
  userId: string;
  email: string;
  timeZone: string;
  weekday: number;
  minuteOfDay: number;
  displayName: string;
  hasPush: boolean;
};

export type CheckInCronResult = {
  scanned: number;
  initialPush: number;
  initialEmail: number;
  followUpPush: number;
  followUpEmail: number;
  skipped: number;
};

function emptyResult(): CheckInCronResult {
  return {
    scanned: 0,
    initialPush: 0,
    initialEmail: 0,
    followUpPush: 0,
    followUpEmail: 0,
    skipped: 0,
  };
}

async function loadCandidates(now: Date): Promise<Candidate[]> {
  const [subscriptions, overrides] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" },
      select: {
        userId: true,
        plan: true,
        currentPeriodEnd: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            profile: {
              select: {
                timeZone: true,
                displayName: true,
                weeklyCheckInOverride: true,
              },
            },
            pushSubscriptions: { select: { id: true }, take: 1 },
            weeklyCheckInPrefs: { select: { weekday: true, minuteOfDay: true } },
          },
        },
      },
    }),
    prisma.profile.findMany({
      where: { weeklyCheckInOverride: "force_on" },
      select: {
        userId: true,
        timeZone: true,
        displayName: true,
        user: {
          select: {
            email: true,
            pushSubscriptions: { select: { id: true }, take: 1 },
            weeklyCheckInPrefs: { select: { weekday: true, minuteOfDay: true } },
          },
        },
      },
    }),
  ]);

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const latestByUser = new Map<string, (typeof subscriptions)[number]>();
  for (const row of subscriptions) {
    if (!latestByUser.has(row.userId)) latestByUser.set(row.userId, row);
  }

  for (const row of latestByUser.values()) {
    if (row.currentPeriodEnd && row.currentPeriodEnd < now) continue;
    const forced = row.user.profile?.weeklyCheckInOverride === "force_on";
    if (!planIsOneOnOneCoaching(row.plan) && !forced) continue;
    seen.add(row.userId);
    candidates.push(toCandidate(row.userId, row.user.email, row.user.profile, row.user));
  }

  for (const row of overrides) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    candidates.push(
      toCandidate(row.userId, row.user.email, row, row.user),
    );
  }

  return candidates;
}

function toCandidate(
  userId: string,
  email: string,
  profile: { timeZone: string; displayName: string } | null | undefined,
  user: {
    pushSubscriptions: { id: string }[];
    weeklyCheckInPrefs: { weekday: number; minuteOfDay: number } | null;
  },
): Candidate {
  return {
    userId,
    email,
    timeZone: resolveTimeZone(profile?.timeZone, "America/Denver"),
    weekday: user.weeklyCheckInPrefs?.weekday ?? DEFAULT_REMINDER_WEEKDAY,
    minuteOfDay: user.weeklyCheckInPrefs?.minuteOfDay ?? DEFAULT_REMINDER_MINUTE,
    displayName: profile?.displayName?.trim() || "Athlete",
    hasPush: user.pushSubscriptions.length > 0,
  };
}

async function claimReminder(
  userId: string,
  weekKey: string,
  kind: ReminderDecision,
  channel: "push" | "email",
  sentAt: Date,
) {
  if (kind === "none") return null;
  try {
    return await prisma.checkInReminderLog.create({
      data: { userId, weekKey, kind, channel, sentAt },
    });
  } catch {
    return null;
  }
}

async function releaseReminder(id: string) {
  await prisma.checkInReminderLog.delete({ where: { id } }).catch(() => undefined);
}

function checkInUrl() {
  return `${performanceAppOrigin()}/checkin`;
}

async function sendEmailReminder(input: {
  email: string;
  name: string;
  followUp: boolean;
}) {
  const href = checkInUrl();
  const headline = input.followUp ? "Still open" : "Check-in due";
  const intro = input.followUp
    ? `${input.name}, this week's check-in is still open. It takes about two minutes.`
    : `${input.name}, your weekly check-in with Coach Ricky is due. It takes about two minutes.`;
  const html = reminderEmailHtml({
    eyebrow: "Weekly check-in",
    headline,
    intro,
    items: [
      {
        label: "In the app",
        message: "Bodyweight, sleep, energy, and how the week went. Open it on your phone.",
      },
    ],
    ctaLabel: "Open check-in",
    ctaHref: href,
    pull: "Coach Ricky reads these once a week.",
    profileHref: `${performanceAppOrigin()}/checkin`,
    footer: "This email is the backup when push reminders are off.",
    preheader: intro,
  });
  return sendMail({
    to: input.email,
    subject: input.followUp ? "Your weekly check-in is still open" : "Weekly check-in is due",
    text: `${intro}\n\nOpen check-in: ${href}`,
    html,
  });
}

async function deliver(input: {
  candidate: Candidate;
  decision: Exclude<ReminderDecision, "none">;
  weekKey: string;
  now: Date;
}) {
  const followUp = input.decision === "followup";
  const pushPayload = followUp
    ? {
        title: "Weekly check-in still due",
        body: "Open your check-in. It takes about two minutes.",
        url: "/checkin",
      }
    : {
        title: "Weekly check-in due",
        body: "Coach Ricky is ready for this week's check-in.",
        url: "/checkin",
      };
  const pushReady = vapidConfig().configured && input.candidate.hasPush;
  if (pushReady) {
    const claim = await claimReminder(
      input.candidate.userId,
      input.weekKey,
      input.decision,
      "push",
      input.now,
    );
    if (!claim) return "skipped" as const;
    const result = await sendPushToUser(input.candidate.userId, pushPayload);
    if (result.sent > 0) return followUp ? ("followUpPush" as const) : ("initialPush" as const);
    await releaseReminder(claim.id);
  }
  const emailClaim = await claimReminder(
    input.candidate.userId,
    input.weekKey,
    input.decision,
    "email",
    input.now,
  );
  if (!emailClaim) return "skipped" as const;
  const mailed = await sendEmailReminder({
    email: input.candidate.email,
    name: input.candidate.displayName.split(/\s+/)[0] || "Athlete",
    followUp,
  });
  if (!mailed.sent) {
    await releaseReminder(emailClaim.id);
    return "skipped" as const;
  }
  return followUp ? ("followUpEmail" as const) : ("initialEmail" as const);
}

export async function runWeeklyCheckInCron(now = new Date()): Promise<CheckInCronResult> {
  const result = emptyResult();
  const candidates = await loadCandidates(now);
  result.scanned = candidates.length;
  if (candidates.length === 0) return result;

  const userIds = candidates.map((row) => row.userId);
  const weekKeys = [
    ...new Set(
      candidates.map((row) => checkInWeekKey(now, row.timeZone, row.weekday, row.minuteOfDay)),
    ),
  ];
  const [submitted, logs] = await Promise.all([
    prisma.weeklyCheckIn.findMany({
      where: { userId: { in: userIds }, weekKey: { in: weekKeys } },
      select: { userId: true, weekKey: true },
    }),
    prisma.checkInReminderLog.findMany({
      where: { userId: { in: userIds }, weekKey: { in: weekKeys } },
      select: { userId: true, weekKey: true, kind: true, sentAt: true },
    }),
  ]);
  const submittedKeys = new Set(submitted.map((row) => `${row.userId}:${row.weekKey}`));
  const logMap = new Map<string, { initial: Date | null; followUp: boolean }>();
  for (const log of logs) {
    const key = `${log.userId}:${log.weekKey}`;
    const current = logMap.get(key) ?? { initial: null, followUp: false };
    if (log.kind === "initial") current.initial = log.sentAt;
    if (log.kind === "followup") current.followUp = true;
    logMap.set(key, current);
  }

  for (const candidate of candidates) {
    const weekKey = checkInWeekKey(
      now,
      candidate.timeZone,
      candidate.weekday,
      candidate.minuteOfDay,
    );
    const key = `${candidate.userId}:${weekKey}`;
    const prior = logMap.get(key) ?? { initial: null, followUp: false };
    const decision = decideCheckInReminder({
      now,
      timeZone: candidate.timeZone,
      weekday: candidate.weekday,
      minuteOfDay: candidate.minuteOfDay,
      submitted: submittedKeys.has(key),
      initialSentAt: prior.initial,
      followUpSent: prior.followUp,
    });
    if (decision === "none") {
      result.skipped += 1;
      continue;
    }
    const outcome = await deliver({ candidate, decision, weekKey, now });
    if (outcome === "skipped") result.skipped += 1;
    else result[outcome] += 1;
  }
  return result;
}
