import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  loggedSetSome,
  sessionCountsAsPlannedCompletion,
  type TickedSet,
} from "@/lib/logged-work";
import { sessionCompletionDay } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

const COMPLETION_SET_SELECT = {
  exerciseName: true,
  completed: true,
  reps: true,
  loadValue: true,
  durationSeconds: true,
} as const;

/**
 * Same session rows as `completedLocalDayKeys`.
 * `plannedSetCount` is the WorkoutSession column #140 adds. Select it when
 * this Prisma client has the column so `sessionCountsAsPlannedCompletion`
 * can require every prescribed set. Rebase onto #140 must regenerate the
 * client; this select then includes the field and passes it through.
 * Do not add a second done rule here.
 */
export function completionSessionSelect(): Prisma.WorkoutSessionSelect {
  const select: Prisma.WorkoutSessionSelect = {
    status: true,
    programDayId: true,
    performedAt: true,
    sets: { select: { ...COMPLETION_SET_SELECT } },
  };
  const fields = Prisma.WorkoutSessionScalarFieldEnum as Record<string, string>;
  if ("plannedSetCount" in fields) {
    (select as { plannedSetCount?: boolean }).plannedSetCount = true;
  }
  return select;
}

type ChipCompletionRow = {
  status: string;
  programDayId: string | null;
  plannedSetCount?: number | null;
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
 * Uses `sessionCountsAsPlannedCompletion`, the same gate as
 * `completedLocalDayKeys`. It does not define a second "done" rule.
 */
export async function completedSessionIdsByLocalDay(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
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
    select: completionSessionSelect(),
  });
  const dayIds = rows
    .map((row) => row.programDayId)
    .filter((id): id is string => Boolean(id));
  const exercises = await prisma.programExercise.findMany({
    where: { programDayId: { in: dayIds } },
    select: { programDayId: true, name: true },
  });
  const namesByDay = new Map<string, string[]>();
  for (const exercise of exercises) {
    const list = namesByDay.get(exercise.programDayId) ?? [];
    list.push(exercise.name);
    namesByDay.set(exercise.programDayId, list);
  }
  const tagged = rows.flatMap((row) => {
    if (!row.programDayId) return [];
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) return [];
    return [{ ...row, day: key }];
  });
  const byDay = new Map<string, string[]>();
  for (const key of new Set(tagged.map((row) => row.day))) {
    const ids = completedProgramDayIdsForChip(tagged, namesByDay, key);
    if (ids.length > 0) byDay.set(key, ids);
  }
  return Object.fromEntries(byDay);
}
