import { getWeeklyWrapped, weeklyWrappedCopy, lastSevenLocalDays } from "@/lib/wrapped";
import { getPersonalRecordsForUser } from "@/lib/records";
import { getProfileForUser } from "@/lib/profile";
import { getPathProgress } from "@/lib/paths";
import { prisma } from "@/lib/prisma";
import { mondayOf } from "@/lib/home";
import { timeZoneForUser } from "@/lib/profile";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview, planHasEliteReview } from "@/lib/plans";
import { AppError } from "@/lib/errors";
import { assertCanViewMemberTrend } from "@/lib/reports";

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
    return "Automated SVG summary: a quiet seven days. That is okay. Counts stay at zero until you log something. This is not a report card.";
  }
  return "Automated SVG summary. Built from workouts, loads, and ratings you logged. Not a message from Ricky.";
}

export async function getWeeklyProgressReport(userId: string, now = new Date()) {
  const profile = await getProfileForUser(userId);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const units = profile?.preferredUnits ?? "lb";
  const [wrap, records, path, planId, comment] = await Promise.all([
    getWeeklyWrapped(userId, now, tz),
    getPersonalRecordsForUser(userId, units, now, tz),
    getPathProgress(userId),
    getEffectivePlanId(userId),
    prisma.weeklyCoachComment.findUnique({
      where: { userId_weekStartKey: { userId, weekStartKey: weekStartKey(now, tz) } },
    }),
  ]);
  const { from, endExclusive } = lastSevenLocalDays(now, tz);
  const weekLoads = records.loadRecords.filter(
    (row) => row.date >= from && row.date < endExclusive,
  );
  const strengthNote =
    weekLoads.length > 0
      ? `Logged loads this window on ${weekLoads.length} exercise${
          weekLoads.length === 1 ? "" : "s"
        }. Example: ${weekLoads[0]!.exerciseName} ${weekLoads[0]!.bestLoad} ${weekLoads[0]!.unit}.`
      : records.loadRecords[0]
        ? `No new load PRs in this window. Best on file: ${records.loadRecords[0].exerciseName} ${records.loadRecords[0].bestLoad} ${records.loadRecords[0].unit}.`
        : "No loads logged yet, so there is no strength signal.";
  const weekSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: from, lt: endExclusive },
    },
    select: { title: true, notes: true },
  });
  const conditioningHit = weekSessions.some((row) =>
    `${row.title} ${row.notes}`.toLowerCase().includes("condition"),
  );
  const conditioningNote = conditioningHit
    ? "A session title or note in this window mentioned conditioning."
    : "No conditioning note in this window. Day 3 of the DEMO program is the engine template when you want it.";
  const nextFocus = path.nextStep
    ? `Suggested next focus: ${path.nextStep.title} (from your ${path.path.title} path).`
    : path.complete
      ? "Path milestones on this DEMO track are complete. Pick another path or keep logging."
      : "Suggested next focus: log one DEMO session when you are ready.";
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
      "Coach comments are for Fighter Development and higher. Do not invent a Ricky note for other plans.",
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
