import { isBackfillRoundMode, type BackfillRoundMode } from "@/lib/backfill-rules";
import { bikeChoiceFromKey } from "@/lib/bike-chooser";
import { roundStructureFromKey } from "@/lib/round-session";

export type DecodedInterval = {
  kind: "bike" | BackfillRoundMode;
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
  done: number;
};

type LoggedIntervalSet = {
  exerciseName: string;
  prescriptionKey: string | null;
  durationSeconds: number | null;
  completed: boolean;
};

/** Structure and completed count from stored interval rows, including `timer#bw:` keys. */
export function decodeInterval(sets: LoggedIntervalSet[]): DecodedInterval | null {
  const bikeSet = sets.find((set) => bikeChoiceFromKey(set.prescriptionKey));
  const choice = bikeSet ? bikeChoiceFromKey(bikeSet.prescriptionKey) : null;
  if (choice) {
    const done = sets.filter(
      (set) => Boolean(bikeChoiceFromKey(set.prescriptionKey)) && set.completed && (set.durationSeconds ?? 0) > 0,
    ).length;
    return {
      kind: "bike",
      sets: choice.spec.repeatRounds ?? 1,
      rounds: choice.spec.roundsPerSet,
      workSeconds: choice.spec.workSeconds,
      restSeconds: choice.spec.restSeconds,
      setRestSeconds: choice.spec.restBetweenRoundsSeconds ?? 0,
      done,
    };
  }
  const roundSet = sets.find((set) => (set.prescriptionKey ?? "").startsWith("round:"));
  const structure = roundStructureFromKey(roundSet?.prescriptionKey);
  const kind = structure?.type ?? "";
  if (!roundSet || !structure || !isBackfillRoundMode(kind)) return null;
  const done = sets.filter(
    (set) =>
      (set.prescriptionKey ?? "").startsWith(`round:${kind}:`) && set.completed && (set.durationSeconds ?? 0) > 0,
  ).length;
  return {
    kind,
    sets: structure.sets,
    rounds: structure.roundsPerSet ?? Math.max(1, done),
    workSeconds: roundSet.durationSeconds ?? 180,
    restSeconds: structure.restSeconds,
    setRestSeconds: structure.setRestSeconds,
    done,
  };
}

/**
 * History paints Edit from the grouped seed before the edit request returns.
 * Expand the completed rows so a `timer#bw:` or round key becomes the structure,
 * with Done equal to the rows already stored.
 */
export function decodeSeedInterval(
  exercises: {
    name: string;
    sets: number;
    done: number;
    prescriptionKey?: string | null;
    durationSeconds?: number | null;
  }[],
): DecodedInterval | null {
  const sets = exercises.flatMap((row) => {
    const key = row.prescriptionKey ?? "";
    const count = Math.max(0, Math.round(row.done));
    if (!key || count < 1) return [];
    return Array.from({ length: count }, () => ({
      exerciseName: row.name,
      prescriptionKey: key,
      durationSeconds: row.durationSeconds ?? null,
      completed: true,
    }));
  });
  return decodeInterval(sets);
}
