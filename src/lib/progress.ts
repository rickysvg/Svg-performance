import { volumeInUnit, type LoadUnit } from "@/lib/units";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";

type SessionWithSets = WorkoutSession & { sets: WorkoutSet[] };

export type ProgressPoint = {
  id: string;
  label: string;
  performedAt: string;
  volume: number;
  setCount: number;
};

export type ExerciseBest = {
  exerciseName: string;
  bestLoad: number;
  unit: LoadUnit;
  date: string;
};

export function buildProgressSummary(
  sessions: SessionWithSets[],
  displayUnit: LoadUnit,
) {
  const completed = sessions.filter((session) => session.status === "complete");
  const points: ProgressPoint[] = [...completed]
    .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
    .map((session) => {
      const volume = session.sets.reduce(
        (sum, set) =>
          sum +
          volumeInUnit(set.reps, set.loadValue, set.loadUnit, displayUnit),
        0,
      );
      return {
        id: session.id,
        label: session.title,
        performedAt: session.performedAt.toISOString(),
        volume: Math.round(volume),
        setCount: session.sets.filter((set) => set.completed || set.reps).length,
      };
    });

  const bestByExercise = new Map<string, ExerciseBest>();
  for (const session of completed) {
    for (const set of session.sets) {
      if (set.loadValue == null) {
        continue;
      }
      const load = volumeInUnit(1, set.loadValue, set.loadUnit, displayUnit);
      const current = bestByExercise.get(set.exerciseName);
      if (!current || load > current.bestLoad) {
        bestByExercise.set(set.exerciseName, {
          exerciseName: set.exerciseName,
          bestLoad: Math.round(load * 10) / 10,
          unit: displayUnit,
          date: session.performedAt.toISOString(),
        });
      }
    }
  }

  const last = completed[0];
  return {
    sessionCount: completed.length,
    lastSessionTitle: last?.title ?? null,
    lastSessionAt: last?.performedAt.toISOString() ?? null,
    points,
    exerciseBests: [...bestByExercise.values()].sort((a, b) =>
      a.exerciseName.localeCompare(b.exerciseName),
    ),
  };
}
