import { prisma } from "@/lib/prisma";
import {
  loggedSetSome,
  offPlanSessionDone,
  prescribedSetTotal,
  tickedSetCount,
  type TickedSet,
} from "@/lib/logged-work";
import { sessionCompletionDay } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";
import { calendarPlanDoses, withCalendarScaleMemory, type ScaledDayPlan } from "@/lib/plan-doses";
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
      !offPlanSessionDone(
        row,
        row.prescribedCount ?? 0,
        namesByDay.get(`${row.day}\0${row.programDayId}`) ?? namesByDay.get(row.programDayId) ?? [],
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
 * Uses `offPlanSessionDone`, which calls `sessionCountsAsPlannedCompletion`
 * with the calendar's scaled dose. Same gate as `completedLocalDayKeys`.
 * A null `plannedSetCount` still has to cover that dose, including a swapped log.
 */
export function completedSessionIdsByLocalDay(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  now = new Date(),
) {
  return withCalendarScaleMemory(() =>
    completedSessionIdsByLocalDayNow(userId, from, to, timeZone, now),
  );
}

async function completedSessionIdsByLocalDayNow(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  now = new Date(),
) {
  const fromKey = dayKey(from, timeZone);
  const endKey = dayKey(to, timeZone);
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
  const tagged = (
    await Promise.all(
      rows.map(async (row) => {
        if (!row.programDayId) return null;
        const key = sessionCompletionDay(row, timeZone);
        if (key < fromKey || key >= endKey) return null;
        const exercises = row.programDay?.exercises ?? [];
        const weekPlan = (await calendarPlanDoses(userId, row.performedAt ?? now)).get(row.programDayId);
        const catalogDose = prescribedSetTotal(exercises);
        const dose = weekPlan && weekPlan.dose > 0 ? weekPlan.dose : catalogDose;
        const names =
          weekPlan && weekPlan.names.length > 0
            ? [...weekPlan.names]
            : exercises.map((exercise) => exercise.name);
        return {
          status: row.status,
          programDayId: row.programDayId,
          plannedSetCount: row.plannedSetCount,
          prescribedCount: dose,
          sets: row.sets,
          day: key,
          names,
        };
      }),
    )
  ).filter((row): row is NonNullable<typeof row> => row != null);
  const namesByDay = new Map<string, string[]>();
  for (const row of tagged) {
    const key = `${row.day}\0${row.programDayId}`;
    if (!namesByDay.has(key)) namesByDay.set(key, row.names);
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
 * prescription. Each row uses the dose for its own week. `planByDay` only
 * fills a program day the week scale does not list.
 * A short log with no program day still marks the day partial, so an ad hoc
 * session does not read as missed. The dose is the session's own week.
 * Drafts and saved-short rows count. A day that passes the full rule is not included.
 * Unticked drafts stay out, even when the logger has prefilled numbers.
 *
 * Callers that need a partial mark to follow a swap use `partialProgramIdsByLocalDay`
 * and realign in chip-days. The done check stays `offPlanSessionDone`.
 */
async function visitPartialSessions(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  planByDay: ReadonlyMap<string, ScaledDayPlan> | undefined,
  visit: (row: { programDayId: string | null }, key: string) => void,
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
  for (const row of rows) {
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) continue;
    if (tickedSetCount(row.sets) === 0) continue;
    const exercises = row.programDay?.exercises ?? [];
    const weekPlan = row.programDayId
      ? (await calendarPlanDoses(userId, row.performedAt)).get(row.programDayId)
      : undefined;
    const plan = weekPlan ?? (row.programDayId ? planByDay?.get(row.programDayId) : undefined);
    const dose = row.programDayId
      ? plan && plan.dose > 0
        ? plan.dose
        : prescribedSetTotal(exercises)
      : 0;
    const names = row.programDayId
      ? plan && plan.dose > 0
        ? [...plan.names]
        : exercises.map((exercise) => exercise.name)
      : [];
    if (offPlanSessionDone(row, dose, names)) continue;
    visit(row, key);
  }
}

export function partialLocalDayKeys(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  planByDay?: ReadonlyMap<string, ScaledDayPlan>,
) {
  return withCalendarScaleMemory(async () => {
    const days = new Set<string>();
    await visitPartialSessions(userId, from, to, timeZone, planByDay, (_row, key) => {
      days.add(key);
    });
    return [...days];
  });
}

/** Partial program-day ids keyed by the civil day they were logged. */
export function partialProgramIdsByLocalDay(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  planByDay?: ReadonlyMap<string, ScaledDayPlan>,
) {
  return withCalendarScaleMemory(async () => {
    const byDay: Record<string, string[]> = {};
    await visitPartialSessions(userId, from, to, timeZone, planByDay, (row, key) => {
      if (!row.programDayId) return;
      const list = byDay[key] ?? [];
      if (!list.includes(row.programDayId)) list.push(row.programDayId);
      byDay[key] = list;
    });
    return byDay;
  });
}

/**
 * Off-plan logs (no program day and no applied day plan), by civil day.
 * Done vs partial uses the same gate as `partialLocalDayKeys`.
 */
export function offPlanMarksByLocalDay(userId: string, from: Date, to: Date, timeZone: string) {
  return withCalendarScaleMemory(() => offPlanMarksByLocalDayNow(userId, from, to, timeZone));
}

async function offPlanMarksByLocalDayNow(userId: string, from: Date, to: Date, timeZone: string) {
  const fromKey = dayKey(from, timeZone);
  const endKey = dayKey(to, timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      programDayId: null,
      dayPlanId: null,
      status: { in: ["complete", "partial", "draft"] },
      sets: loggedSetSome,
      performedAt: {
        gte: new Date(from.getTime() - DAY_PAD_MS),
        lt: new Date(to.getTime() + DAY_PAD_MS),
      },
    },
    select: CHIP_SESSION_SELECT,
  });
  const marks = new Map<string, { done: boolean; partial: boolean }>();
  for (const row of rows) {
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) continue;
    if (tickedSetCount(row.sets) === 0) continue;
    const current = marks.get(key) ?? { done: false, partial: false };
    if (offPlanSessionDone(row, 0, [])) current.done = true;
    else current.partial = true;
    marks.set(key, current);
  }
  return Object.fromEntries(marks);
}
