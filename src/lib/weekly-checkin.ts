import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getLatestSubscription } from "@/lib/access";
import { getAppTier } from "@/lib/entitlements";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import {
  assertClipDuration,
  deleteStoredFormMedia,
  readFormCheckMedia,
  validateFormCheckBytes,
  writeFormCheckMedia,
} from "@/lib/form-check-storage";
import { loggedSetSome } from "@/lib/logged-work";
import { sparringLogsForWeek, type SparringLog } from "@/lib/outside-log";
import { addZonedDays, mondayOfZoned } from "@/lib/timezone";
import { resolveTrainingDays } from "@/lib/week-plan";
import { checkInAiEnabled, generateCheckInDraft } from "@/lib/weekly-checkin-ai";
import { sendPushToUser } from "@/lib/weekly-checkin-push";
import {
  checkInWeekKey,
  clampScore,
  detectCheckInFlags,
  fallbackCheckInDraft,
  isWeeklyCheckInDue,
  memberHasWeeklyCheckInAccess,
  normalizeReminderPrefs,
  parseFlagsJson,
  parseRegionIds,
  sortCheckInsFlaggedFirst,
  DEFAULT_REMINDER_MINUTE,
  DEFAULT_REMINDER_WEEKDAY,
  type CheckInFlag,
} from "@/lib/weekly-checkin-shared";

export function isWeeklyCheckInCoach(user: { role: string; email: string }) {
  return isFormCheckReviewer(user);
}

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function formatSparringSummary(logs: SparringLog[]) {
  if (logs.length === 0) return "";
  return logs
    .map((log) => {
      const intensity = log.intensity ? `, ${log.intensity}` : "";
      const notes = log.notes.trim() ? ` (${log.notes.trim()})` : "";
      const day = log.weekday || log.dateKey;
      return `${day}: ${log.rounds} x ${log.minutesPerRound} min${intensity}${notes}`;
    })
    .join("; ");
}

function plannedCount(profile: {
  sessionsPerWeek: number | null;
  weeklyAvailabilityJson: string;
} | null) {
  if (!profile) return 0;
  let weeklyAvailability: string[] = [];
  try {
    const parsed = JSON.parse(profile.weeklyAvailabilityJson) as unknown;
    if (Array.isArray(parsed)) {
      weeklyAvailability = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    weeklyAvailability = [];
  }
  return resolveTrainingDays({
    weeklyAvailability,
    sessionsPerWeek: profile.sessionsPerWeek,
  }).size;
}

/**
 * The weekly check-in form is in the academy tier and Pro. Ricky only reviews check-ins
 * from 1-on-1 coaching members (or accounts an admin turned on); see weeklyCheckInReviewed.
 */
export async function weeklyCheckInAllowed(userId: string, now = new Date()) {
  if (await weeklyCheckInReviewed(userId, now)) return true;
  const tier = await getAppTier(userId, now);
  return tier === "academy" || tier === "pro";
}

/** 1-on-1 coaching (or an admin override): Ricky reviews and replies. */
export async function weeklyCheckInReviewed(userId: string, now = new Date()) {
  const [subscription, profile] = await Promise.all([
    getLatestSubscription(userId),
    prisma.profile.findUnique({
      where: { userId },
      select: { weeklyCheckInOverride: true },
    }),
  ]);
  const active =
    subscription?.status === "active" &&
    !(subscription.currentPeriodEnd && subscription.currentPeriodEnd < now);
  return memberHasWeeklyCheckInAccess({
    planId: active ? subscription.plan : null,
    override: profile?.weeklyCheckInOverride,
  });
}

async function assertCheckInAccess(userId: string, now: Date) {
  const allowed = await weeklyCheckInAllowed(userId, now);
  if (!allowed) {
    throw new AppError(
      "PLAN",
      "The weekly check-in is for verified academy members and Pro.",
    );
  }
}

async function weekKeyForUser(userId: string, now: Date, timeZone: string) {
  const prefs = await getCheckInPrefs(userId);
  return checkInWeekKey(now, timeZone, prefs.weekday, prefs.minuteOfDay);
}

export async function getCheckInPrefs(userId: string) {
  const row = await prisma.weeklyCheckInPrefs.findUnique({ where: { userId } });
  return normalizeReminderPrefs(
    row?.weekday ?? DEFAULT_REMINDER_WEEKDAY,
    row?.minuteOfDay ?? DEFAULT_REMINDER_MINUTE,
  );
}

export async function saveCheckInPrefs(userId: string, weekday: number, minuteOfDay: number) {
  await assertCheckInAccess(userId, new Date());
  const prefs = normalizeReminderPrefs(weekday, minuteOfDay);
  await prisma.weeklyCheckInPrefs.upsert({
    where: { userId },
    create: { userId, ...prefs },
    update: prefs,
  });
  return prefs;
}

export async function weekTrainingSnapshot(userId: string, now: Date, timeZone: string) {
  const start = mondayOfZoned(now, timeZone);
  const end = addZonedDays(start, 7, timeZone);
  const [sessions, sparring, profile, latestWeight, previous] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        performedAt: { gte: start, lt: end, lte: now },
        sets: loggedSetSome,
      },
      select: { id: true, title: true },
      orderBy: { performedAt: "asc" },
    }),
    sparringLogsForWeek(userId, now, timeZone),
    prisma.profile.findUnique({
      where: { userId },
      select: {
        sessionsPerWeek: true,
        weeklyAvailabilityJson: true,
        displayName: true,
        currentWeight: true,
      },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId, kind: "weight", recordedAt: { lt: now } },
      orderBy: { recordedAt: "desc" },
      select: { value: true },
    }),
    prisma.weeklyCheckIn.findFirst({
      where: { userId, weekKey: { not: await weekKeyForUser(userId, now, timeZone) } },
      orderBy: { submittedAt: "desc" },
      select: { bodyweightLb: true, energy: true },
    }),
  ]);
  const previousWeightLb =
    previous?.bodyweightLb ?? latestWeight?.value ?? profile?.currentWeight ?? null;
  return {
    sessionsCompleted: sessions.length,
    sessionsPlanned: plannedCount(profile),
    sessionTitles: sessions.map((row) => row.title),
    sparringSummary: formatSparringSummary(sparring.logs),
    sparringRounds: sparring.rounds,
    displayName: profile?.displayName ?? "",
    suggestedWeightLb: latestWeight?.value ?? profile?.currentWeight ?? null,
    previousWeightLb,
    previousEnergy: previous?.energy ?? null,
  };
}

export type CheckInSubmitInput = {
  userId: string;
  now: Date;
  timeZone: string;
  bodyweightLb: number;
  sleepQuality: number;
  energy: number;
  stress: number;
  regions: string[];
  sorenessNotes: string;
  wins: string;
  struggles: string;
  video?: {
    bytes: Uint8Array;
    claimedType?: string;
    durationSeconds: number;
  } | null;
};

export async function submitWeeklyCheckIn(input: CheckInSubmitInput) {
  await assertCheckInAccess(input.userId, input.now);
  const sleepQuality = clampScore(input.sleepQuality);
  const energy = clampScore(input.energy);
  const stress = clampScore(input.stress);
  if (!sleepQuality || !energy || !stress) {
    throw new AppError("CHECKIN", "Score sleep, energy, and stress from 1 to 5.");
  }
  if (!Number.isFinite(input.bodyweightLb) || input.bodyweightLb < 50 || input.bodyweightLb > 500) {
    throw new AppError("CHECKIN", "Enter a bodyweight between 50 and 500 lb.");
  }
  const bodyweightLb = Math.round(input.bodyweightLb * 10) / 10;
  const regions = parseRegionIds(input.regions);
  const sorenessNotes = input.sorenessNotes.trim().slice(0, 400);
  const wins = input.wins.trim().slice(0, 600);
  const struggles = input.struggles.trim().slice(0, 600);
  const weekKey = await weekKeyForUser(input.userId, input.now, input.timeZone);
  const snapshot = await weekTrainingSnapshot(input.userId, input.now, input.timeZone);

  let mime: ReturnType<typeof validateFormCheckBytes> | null = null;
  let durationSeconds = 0;
  if (input.video && input.video.bytes.byteLength > 0) {
    mime = validateFormCheckBytes(input.video.bytes, input.video.claimedType);
    durationSeconds = assertClipDuration(input.video.durationSeconds);
  }

  const scores = {
    bodyweightLb,
    previousWeightLb: snapshot.previousWeightLb,
    sleepQuality,
    energy,
    previousEnergy: snapshot.previousEnergy,
    stress,
    regions,
    sorenessNotes,
    sessionsCompleted: snapshot.sessionsCompleted,
    sessionsPlanned: snapshot.sessionsPlanned,
    sparringSummary: snapshot.sparringSummary,
    wins,
    struggles,
  };

  let row;
  try {
    row = await prisma.weeklyCheckIn.create({
      data: {
        userId: input.userId,
        weekKey,
        bodyweightLb,
        sleepQuality,
        energy,
        stress,
        sorenessRegionsJson: JSON.stringify(regions),
        sorenessNotes,
        sessionsCompleted: snapshot.sessionsCompleted,
        sessionsPlanned: snapshot.sessionsPlanned,
        sparringSummary: snapshot.sparringSummary,
        wins,
        struggles,
        aiFlagsJson: JSON.stringify(detectCheckInFlags(scores)),
        submittedAt: input.now,
      },
    });
  } catch (error) {
    if (isUnique(error)) {
      throw new AppError("CHECKIN", "This week's check-in is already in.");
    }
    throw error;
  }

  if (input.video && mime) {
    try {
      const stored = await writeFormCheckMedia({
        userId: input.userId,
        checkId: row.id,
        bytes: input.video.bytes,
        mime,
      });
      row = await prisma.weeklyCheckIn.update({
        where: { id: row.id },
        data: {
          videoStorageKey: stored.storageKey,
          videoStorageKind: stored.storageKind,
          videoMimeType: mime,
          videoByteSize: input.video.bytes.byteLength,
          videoDurationSeconds: durationSeconds,
        },
      });
    } catch (error) {
      await prisma.weeklyCheckIn.delete({ where: { id: row.id } }).catch(() => undefined);
      throw error;
    }
  }

  const draft = await generateCheckInDraft({
    ...scores,
    displayName: snapshot.displayName,
  });
  row = await prisma.weeklyCheckIn.update({
    where: { id: row.id },
    data: {
      aiSummary: draft.summary,
      aiFlagsJson: JSON.stringify(draft.flags),
      aiReply: draft.reply,
      aiTweaks: draft.tweaks,
      aiSource: draft.source,
      coachReply: draft.reply,
    },
  });
  return row;
}

export async function getCurrentCheckIn(userId: string, now: Date, timeZone: string) {
  return prisma.weeklyCheckIn.findUnique({
    where: { userId_weekKey: { userId, weekKey: await weekKeyForUser(userId, now, timeZone) } },
  });
}

export async function unseenCoachReply(userId: string) {
  return prisma.weeklyCheckIn.findFirst({
    where: {
      userId,
      coachStatus: "sent",
      replySeenAt: null,
      coachReply: { not: "" },
    },
    orderBy: { sentAt: "desc" },
  });
}

export async function markCoachRepliesSeen(userId: string, now = new Date()) {
  await prisma.weeklyCheckIn.updateMany({
    where: { userId, coachStatus: "sent", replySeenAt: null },
    data: { replySeenAt: now },
  });
}

export type CheckInHomeState = {
  allowed: boolean;
  due: boolean;
  weekKey: string;
  submitted: boolean;
  unseenReply: boolean;
};

export async function getCheckInHomeState(
  userId: string,
  now: Date,
  timeZone: string,
): Promise<CheckInHomeState> {
  const allowed = await weeklyCheckInAllowed(userId, now);
  const prefsForKey = await getCheckInPrefs(userId);
  const weekKey = checkInWeekKey(now, timeZone, prefsForKey.weekday, prefsForKey.minuteOfDay);
  if (!allowed) {
    return { allowed: false, due: false, weekKey, submitted: false, unseenReply: false };
  }
  const [current, reply] = await Promise.all([
    prisma.weeklyCheckIn.findUnique({
      where: { userId_weekKey: { userId, weekKey } },
      select: { id: true },
    }),
    unseenCoachReply(userId),
  ]);
  return {
    allowed: true,
    due: isWeeklyCheckInDue({
      now,
      timeZone,
      weekday: prefsForKey.weekday,
      minuteOfDay: prefsForKey.minuteOfDay,
      submitted: Boolean(current),
    }),
    weekKey,
    submitted: Boolean(current),
    unseenReply: Boolean(reply),
  };
}

function presentFlags(raw: string): CheckInFlag[] {
  return parseFlagsJson(raw);
}

export async function listCheckInsForCoach() {
  const rows = await prisma.weeklyCheckIn.findMany({
    // Ricky's queue: 1-on-1 coaching members and admin-enabled accounts only.
    where: {
      OR: [
        { user: { profile: { weeklyCheckInOverride: "force_on" } } },
        {
          user: {
            subscriptions: {
              some: {
                status: "active",
                OR: [
                  { plan: { startsWith: "coaching" } },
                  { plan: { startsWith: "development" } },
                  { plan: { startsWith: "elite" } },
                  { plan: { in: ["vip", "platinum"] } },
                ],
              },
            },
          },
        },
      ],
    },
    orderBy: { submittedAt: "desc" },
    take: 80,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });
  const cards = rows.map((row) => {
    const flags = presentFlags(row.aiFlagsJson);
    const name = row.user.profile?.displayName?.trim() || row.user.email;
    const live = checkInAiEnabled() && row.aiSource === "openai";
    const template =
      live || row.aiSource === "fallback"
        ? null
        : fallbackCheckInDraft({
            displayName: name,
            bodyweightLb: row.bodyweightLb,
            previousWeightLb: null,
            sleepQuality: row.sleepQuality,
            energy: row.energy,
            previousEnergy: null,
            stress: row.stress,
            regions: parseRegionIds(safeJsonArray(row.sorenessRegionsJson)),
            sorenessNotes: row.sorenessNotes,
            sessionsCompleted: row.sessionsCompleted,
            sessionsPlanned: row.sessionsPlanned,
            sparringSummary: row.sparringSummary,
            wins: row.wins,
            struggles: row.struggles,
          });
    return {
      id: row.id,
      userId: row.userId,
      name,
      email: row.user.email,
      weekKey: row.weekKey,
      submittedAt: row.submittedAt,
      bodyweightLb: row.bodyweightLb,
      sleepQuality: row.sleepQuality,
      energy: row.energy,
      stress: row.stress,
      sessionsCompleted: row.sessionsCompleted,
      sessionsPlanned: row.sessionsPlanned,
      sparringSummary: row.sparringSummary,
      wins: row.wins,
      struggles: row.struggles,
      sorenessNotes: row.sorenessNotes,
      regions: parseRegionIds(safeJsonArray(row.sorenessRegionsJson)),
      summary: template?.summary || row.aiSummary,
      flags,
      flagCount: flags.length,
      tweaks: template?.tweaks || row.aiTweaks,
      aiSource: live ? "openai" : "fallback",
      coachStatus: row.coachStatus,
      reply: row.coachReply || template?.reply || row.aiReply,
      hasVideo: Boolean(row.videoStorageKey),
      videoSeconds: row.videoDurationSeconds,
    };
  });
  return sortCheckInsFlaggedFirst(cards);
}

function safeJsonArray(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
}

async function requireCoachCheckIn(checkInId: string) {
  const row = await prisma.weeklyCheckIn.findUnique({ where: { id: checkInId } });
  if (!row) throw new NotFoundError("That check-in was not found.");
  return row;
}

export async function saveCheckInReply(input: {
  actor: { id: string; role: string; email: string };
  checkInId: string;
  reply: string;
  send: boolean;
  now?: Date;
}) {
  if (!isWeeklyCheckInCoach(input.actor)) {
    throw new ForbiddenError("Only an admin can review weekly check-ins.");
  }
  const row = await requireCoachCheckIn(input.checkInId);
  const reply = input.reply.trim().slice(0, 2000);
  const now = input.now ?? new Date();
  if (input.send) {
    if (reply.length < 2) {
      throw new AppError("CHECKIN", "Write a reply before you send it.");
    }
    const updated = await prisma.weeklyCheckIn.update({
      where: { id: row.id },
      data: {
        coachReply: reply,
        coachStatus: "sent",
        reviewerUserId: input.actor.id,
        sentAt: now,
        reviewedAt: row.reviewedAt ?? now,
        replySeenAt: null,
      },
    });
    await sendPushToUser(row.userId, {
      title: "Coach Ricky replied",
      body: "Your weekly check-in has a reply.",
      url: "/checkin",
    }).catch(() => undefined);
    return updated;
  }
  return prisma.weeklyCheckIn.update({
    where: { id: row.id },
    data: {
      coachReply: reply,
      reviewerUserId: input.actor.id,
    },
  });
}

export async function markCheckInReviewed(input: {
  actor: { id: string; role: string; email: string };
  checkInId: string;
  reply?: string;
  now?: Date;
}) {
  if (!isWeeklyCheckInCoach(input.actor)) {
    throw new ForbiddenError("Only an admin can review weekly check-ins.");
  }
  const row = await requireCoachCheckIn(input.checkInId);
  const now = input.now ?? new Date();
  const reply = input.reply?.trim().slice(0, 2000);
  return prisma.weeklyCheckIn.update({
    where: { id: row.id },
    data: {
      coachStatus: row.coachStatus === "sent" ? "sent" : "reviewed",
      reviewedAt: now,
      reviewerUserId: input.actor.id,
      ...(reply ? { coachReply: reply } : {}),
    },
  });
}

export async function setWeeklyCheckInOverride(input: {
  actor: { id: string; role: string; email: string };
  email: string;
  enabled: boolean;
}) {
  if (!isWeeklyCheckInCoach(input.actor)) {
    throw new ForbiddenError("Only an admin can turn on weekly check-ins.");
  }
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("CHECKIN", "No account uses that email yet.");
  }
  await prisma.profile.update({
    where: { userId: user.id },
    data: { weeklyCheckInOverride: input.enabled ? "force_on" : "none" },
  });
  return { userId: user.id, email: user.email, enabled: input.enabled };
}

export async function listCheckInOverrides() {
  const rows = await prisma.profile.findMany({
    where: { weeklyCheckInOverride: "force_on" },
    select: {
      userId: true,
      displayName: true,
      user: { select: { email: true } },
    },
    orderBy: { displayName: "asc" },
  });
  return rows.map((row) => ({
    userId: row.userId,
    email: row.user.email,
    name: row.displayName.trim() || row.user.email,
  }));
}

export async function readCheckInVideoForActor(
  checkInId: string,
  actor: { id: string; role: string; email: string },
) {
  const row = await prisma.weeklyCheckIn.findUnique({ where: { id: checkInId } });
  if (!row || !row.videoStorageKey) {
    throw new NotFoundError("That clip was not found.");
  }
  if (row.userId !== actor.id && !isWeeklyCheckInCoach(actor)) {
    throw new ForbiddenError("You cannot open that clip.");
  }
  const bytes = await readFormCheckMedia({
    userId: row.userId,
    storageKind: row.videoStorageKind,
    storageKey: row.videoStorageKey,
  });
  return { row, bytes };
}

export async function deleteWeeklyCheckInMediaForUser(userId: string) {
  const rows = await prisma.weeklyCheckIn.findMany({
    where: { userId, videoStorageKey: { not: "" } },
    select: { videoStorageKind: true, videoStorageKey: true },
  });
  await Promise.all(
    rows.map((row) =>
      deleteStoredFormMedia({
        userId,
        storageKind: row.videoStorageKind,
        storageKey: row.videoStorageKey,
      }),
    ),
  );
}

export async function memberHasPushSubscription(userId: string) {
  const count = await prisma.pushSubscription.count({ where: { userId } });
  return count > 0;
}
