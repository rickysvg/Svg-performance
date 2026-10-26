import { getWeeklyWrapped, mondayWeekBounds } from "@/lib/wrapped";
import { getProfileForUser } from "@/lib/profile";
import { getPathProgress } from "@/lib/paths";
import { loggedSetSome } from "@/lib/logged-work";
import { prisma } from "@/lib/prisma";
import { mondayOf } from "@/lib/home";
import { timeZoneForUser } from "@/lib/profile";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview, planHasEliteReview } from "@/lib/plans";
import { AppError } from "@/lib/errors";
import { assertCanViewMemberTrend } from "@/lib/reports";
import { convertLoad, isLoadUnit, type LoadUnit } from "@/lib/units";

export function weekStartKey(now = new Date(), timeZone = APP_TIMEZONE) {
  return dayKey(mondayOf(now, timeZone), timeZone);
}

export function automatedReportCopy(input: {
  workoutsLogged: number;
  strengthNote: string;
  conditioningNote: string;
  difficultyLabel: string;
  nextFocus: string;
}) {
  if (input.workoutsLogged === 0) {
    return "Automated SVG summary: a quiet week. That is okay. Counts stay at zero until you log something. This is not a report card.";
  }
  return "Automated SVG summary. Built from workouts, loads, and ratings you logged this Monday–Sunday week. Not a message from Ricky.";
}

export type PeriodLoad = {
  exerciseName: string;
  bestLoad: number;
  unit: LoadUnit;
};

function formatLoadAmount(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Heaviest logged load for each exercise whose session falls in [from, endExclusive). */
export async function heaviestLoadsInPeriod(input: {
  userId: string;
  from: Date;
  endExclusive: Date;
  displayUnit: LoadUnit;
}): Promise<PeriodLoad[]> {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: input.userId,
      status: { in: ["complete", "partial"] },
      performedAt: { gte: input.from, lt: input.endExclusive },
    },
    select: {
      sets: {
        select: { exerciseName: true, loadValue: true, loadUnit: true, completed: true },
      },
    },
  });
  const bests = new Map<string, PeriodLoad>();
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.completed === false || set.loadValue == null || set.loadValue <= 0) continue;
      if (!isLoadUnit(set.loadUnit)) continue;
      const name = set.exerciseName.trim();
      if (!name) continue;
      const load = Math.round(convertLoad(set.loadValue, set.loadUnit, input.displayUnit) * 10) / 10;
      const current = bests.get(name);
      if (!current || load > current.bestLoad) {
        bests.set(name, { exerciseName: name, bestLoad: load, unit: input.displayUnit });
      }
    }
  }
  return [...bests.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function formatStrengthNote(loads: PeriodLoad[], period: "week" | "month") {
  if (loads.length === 0) {
    return period === "week"
      ? "No load logged in this Monday–Sunday week."
      : "No load logged in this month.";
  }
  const list = loads.map((row) => `${row.exerciseName} ${formatLoadAmount(row.bestLoad)} ${row.unit}`).join(", ");
  return period === "week" ? `Logged this week: ${list}.` : `Logged this month: ${list}.`;
}

export async function strengthNoteForPeriod(input: {
  userId: string;
  from: Date;
  endExclusive: Date;
  displayUnit: LoadUnit;
  period: "week" | "month";
}) {
  const loads = await heaviestLoadsInPeriod(input);
  return formatStrengthNote(loads, input.period);
}

export async function getWeeklyProgressReport(userId: string, now = new Date()) {
  const profile = await getProfileForUser(userId);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const units = profile?.preferredUnits ?? "lb";
  const displayUnit: LoadUnit = units === "kg" ? "kg" : "lb";
  const bounds = mondayWeekBounds(now, tz);
  const [wrap, path, planId, comment, strengthNote] = await Promise.all([
    getWeeklyWrapped(userId, now, tz, bounds),
    getPathProgress(userId),
    getEffectivePlanId(userId),
    prisma.weeklyCoachComment.findUnique({
      where: { userId_weekStartKey: { userId, weekStartKey: weekStartKey(now, tz) } },
    }),
    strengthNoteForPeriod({
      userId,
      from: bounds.from,
      endExclusive: bounds.endExclusive,
      displayUnit,
      period: "week",
    }),
  ]);
  const { from, endExclusive } = bounds;
  const weekSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      sets: loggedSetSome,
      performedAt: { gte: from, lt: endExclusive },
    },
    select: { title: true, notes: true },
  });
  const conditioningHit = weekSessions.some((row) =>
    `${row.title} ${row.notes}`.toLowerCase().includes("condition"),
  );
  const conditioningNote = conditioningHit
    ? "A session title or note in this window mentioned conditioning."
    : "No conditioning note in this window. The conditioning day is the engine template when you want it.";
  const nextFocus = path.nextStep
    ? `Suggested next focus: ${path.nextStep.title} (from your ${path.path.title} path).`
    : path.complete
      ? "Path milestones on this track are complete. Pick another path or keep logging."
      : "Suggested next focus: log one session when you are ready.";
  const copy = automatedReportCopy({
    workoutsLogged: wrap.workoutsLogged,
    strengthNote,
    conditioningNote,
    difficultyLabel: wrap.avgDifficultyLabel,
    nextFocus,
  });
  const adjustments = planHasEliteReview(planId)
    ? await prisma.coachingAdjustment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];
  return {
    wrap,
    copy,
    strengthNote,
    conditioningNote,
    nextFocus,
    difficultyLabel: wrap.avgDifficultyLabel || "No difficulty ratings in this window yet.",
    labeled: "Automated SVG summary",
    coachComment: comment?.body ?? "",
    coachCommentEmpty: !comment?.body,
    showCoachSlot: planHasCoachReview(planId),
    showEliteAdjustments: planHasEliteReview(planId),
    adjustments,
    weekStartKey: weekStartKey(now, tz),
    pathTitle: path.path.title,
  };
}

export async function upsertWeeklyCoachComment(input: {
  staffUserId: string;
  staffRole: string;
  memberUserId: string;
  body: string;
  now?: Date;
}) {
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: input.memberUserId,
  });
  const planId = await getEffectivePlanId(input.memberUserId);
  if (!planHasCoachReview(planId)) {
    throw new AppError(
      "COACHING",
      "Coach comments are on VIP Coaching. Do not invent a Ricky note for other plans.",
    );
  }
  const body = input.body.trim().slice(0, 2000);
  if (!body) {
    throw new AppError("COACHING", "Write a real comment or leave the slot empty.");
  }
  const tz = await timeZoneForUser(input.memberUserId);
  const key = weekStartKey(input.now, tz);
  return prisma.weeklyCoachComment.upsert({
    where: {
      userId_weekStartKey: { userId: input.memberUserId, weekStartKey: key },
    },
    create: {
      userId: input.memberUserId,
      weekStartKey: key,
      authorUserId: input.staffUserId,
      body,
    },
    update: { body, authorUserId: input.staffUserId },
  });
}

export async function addCoachingAdjustment(input: {
  staffUserId: string;
  staffRole: string;
  memberUserId: string;
  body: string;
}) {
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: input.memberUserId,
  });
  const planId = await getEffectivePlanId(input.memberUserId);
  if (!planHasEliteReview(planId)) {
    throw new AppError("COACHING", "Adjustment log is for Elite and higher.");
  }
  const body = input.body.trim().slice(0, 800);
  if (!body) {
    throw new AppError("COACHING", "Write the adjustment in plain language.");
  }
  return prisma.coachingAdjustment.create({
    data: {
      userId: input.memberUserId,
      authorUserId: input.staffUserId,
      body,
    },
  });
}
