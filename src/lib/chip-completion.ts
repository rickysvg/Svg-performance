import { prisma } from "@/lib/prisma";
import { loggedSetSome, sessionCountsAsPlannedCompletion } from "@/lib/logged-work";
import { sessionCompletionDay } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

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
    select: {
      status: true,
      programDayId: true,
      performedAt: true,
      sets: {
        select: {
          exerciseName: true,
          completed: true,
          reps: true,
          loadValue: true,
          durationSeconds: true,
        },
      },
    },
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
  const byDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.programDayId) continue;
    const key = sessionCompletionDay(row, timeZone);
    if (key < fromKey || key >= endKey) continue;
    if (
      !sessionCountsAsPlannedCompletion(row, namesByDay.get(row.programDayId) ?? [])
    ) {
      continue;
    }
    const ids = byDay.get(key) ?? new Set<string>();
    ids.add(row.programDayId);
    byDay.set(key, ids);
  }
  return Object.fromEntries([...byDay].map(([key, ids]) => [key, [...ids]]));
}
