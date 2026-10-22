import { prisma } from "@/lib/prisma";
import {
  loggedSetSome,
  prescribedSetTotal,
  sessionCountsAsPlannedCompletion,
  tickedSetCount,
  type TickedSet,
} from "@/lib/logged-work";
import { sessionCompletionDay } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";
import { calendarPlanDoses, type ScaledDayPlan } from "@/lib/plan-doses";
export { scaledPlanByProgramDay, type ScaledDayPlan } from "@/lib/plan-doses";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

const CHIP_SESSION_SELECT = {
  status: true,
  programDayId: true,
  performedAt: true,
  plannedSetCount: true,
  sets: {
    select: {
      exerciseName: true,
      completed: true,
      reps: true,
      loadValue: true,
      durationSeconds: true,
    },
  },
  programDay: {
    select: {
      exercises: { select: { name: true, sets: true } },
    },
  },
} as const;

type ChipCompletionRow = {
  status: string;
  programDayId: string | null;
  plannedSetCount?: number | null;
  prescribedCount?: number | null;
  sets: TickedSet[];
  day: string;
};

/** Program days on one civil day that pass the shared completion helper. */
export function completedProgramDayIdsForChip(
  rows: readonly ChipCompletionRow[],
  namesByDay: ReadonlyMap<string, readonly string[]>,
  day: string,
) {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.day !== day || !row.programDayId) continue;
    if (
      !sessionCountsAsPlannedCompletion(
        row,
        [...(namesByDay.get(row.programDayId) ?? [])],
        row.prescribedCount,
      )
    ) {
      continue;
    }
    ids.push(row.programDayId);
  }
  return ids;
}

/**
 * Program days completed on each civil day in [from, to).
 * Uses `sessionCountsAsPlannedCompletion` with the calendar's scaled dose,
 * the same gate as `completedLocalDayKeys`. It does not define a second
 * "done" rule. A null `plannedSetCount` still has to cover that dose.
 */
export async function completedSessionIdsByLocalDay(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  now = new Date(),
) {
  const fromKey = dayKey(from, timeZone);
  const endKey = dayKey(to, timeZone);
  const planByDay = await calendarPlanDoses(userId, now);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      sets: loggedSetSome,
      performedAt: {
        gte: new Date(from.getTime() - DAY_PAD_MS),
        lt: new Date(to.getTime() + DAY_PAD_MS),
      },
    },
    select: CHIP_SESSION_SELECT,
  });
  const tagged = rows.flatMap((row) => {
    if (!row.programDayId) return [];
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) return [];
    const exercises = row.programDay?.exercises ?? [];
    const plan = planByDay.get(row.programDayId);
    const catalogDose = prescribedSetTotal(exercises);
    const dose = plan && plan.dose > 0 ? plan.dose : catalogDose;
    const names =
      plan && plan.names.length > 0 ? [...plan.names] : exercises.map((exercise) => exercise.name);
    return [
      {
        status: row.status,
        programDayId: row.programDayId,
        plannedSetCount: row.plannedSetCount,
        prescribedCount: dose,
        sets: row.sets,
        day: key,
        names,
      },
    ];
  });
  const namesByDay = new Map<string, string[]>();
  for (const row of tagged) {
    if (!namesByDay.has(row.programDayId)) namesByDay.set(row.programDayId, row.names);
  }
  const byDay = new Map<string, string[]>();
  for (const key of new Set(tagged.map((row) => row.day))) {
    const ids = completedProgramDayIdsForChip(tagged, namesByDay, key);
    if (ids.length > 0) byDay.set(key, ids);
  }
  return Object.fromEntries(byDay);
}

/**
 * Civil days in [from, to) that have ticked work which does not finish the
 * prescription. `planByDay` is the scaled plan the calendar uses for its dose.
 * A log with no program day is skipped, matching the calendar.
 * Drafts and saved-short rows count. A day that passes the full rule is not included.
 * Unticked drafts stay out, even when the logger has prefilled numbers.
 */
export async function partialLocalDayKeys(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  planByDay?: ReadonlyMap<string, ScaledDayPlan>,
) {
  const fromKey = dayKey(from, timeZone);
  const endKey = dayKey(to, timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { in: ["complete", "partial", "draft"] },
      sets: loggedSetSome,
      performedAt: {
        gte: new Date(from.getTime() - DAY_PAD_MS),
        lt: new Date(to.getTime() + DAY_PAD_MS),
      },
    },
    select: CHIP_SESSION_SELECT,
  });
  const days = new Set<string>();
  for (const row of rows) {
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) continue;
    if (!row.programDayId) continue;
    if (tickedSetCount(row.sets) === 0) continue;
    const exercises = row.programDay?.exercises ?? [];
    const plan = planByDay?.get(row.programDayId);
    const dose = plan && plan.dose > 0 ? plan.dose : prescribedSetTotal(exercises);
    const names =
      plan && plan.dose > 0
        ? [...plan.names]
        : exercises.map((exercise) => exercise.name);
    const judged = {
      ...row,
      plannedSetCount: row.plannedSetCount ?? (dose > 0 ? dose : null),
    };
    if (sessionCountsAsPlannedCompletion(judged, names)) continue;
    days.add(key);
  }
  return [...days];
}
