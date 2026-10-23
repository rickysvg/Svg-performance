import { isBikeIntervalName } from "@/lib/bike-sessions";
import { textIsBikeWorkout } from "@/lib/timer-session";
import { bikeChoiceFromKey, bikeTimerRoundCount } from "@/lib/bike-chooser";
import { bikeEffortSeconds } from "@/lib/bike-interval-timer";
import {
  formatShareDuration,
  formatShareVolume,
  sessionDurationSeconds,
  sessionRoundCount,
  sessionSetCount,
  sessionVolume,
  shareVolumeUnit,
  type ShareSessionLike,
  type ShareSetLike,
  type ShareStat,
} from "@/lib/share-card";
import type { LoadUnit } from "@/lib/units";

export type WorkoutCompleteTile = {
  key: "time" | "setsRounds" | "volume" | "prs";
  label: string;
  value: string;
};

export function sessionOrdinal(sessionId: string, completeIdsInOrder: string[]) {
  const index = completeIdsInOrder.indexOf(sessionId);
  return index >= 0 ? index + 1 : completeIdsInOrder.length;
}

export function formatWorkoutCompleteDate(date: Date, timeZone?: string) {
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeZone || undefined,
  });
  return formatted.replace(/,/g, "").toUpperCase();
}

export function workoutCompleteHeadline() {
  return "YOU PUT IN THE WORK.";
}

function loggedSets(sets: ShareSetLike[]) {
  return sets.filter(
    (set) => set.completed || set.reps != null || set.durationSeconds != null || set.loadValue != null,
  );
}

/** A session whose logged work is only bike intervals. Lifts and bag rounds stay on the pound tiles. */
export function isBikeCardioSession(session: ShareSessionLike) {
  const sets = loggedSets(session.sets);
  return (
    sets.length > 0 &&
    sets.every((set) => isBikeIntervalName(set.exerciseName) || textIsBikeWorkout(set.exerciseName))
  );
}

function bikeCardioEffort(sets: ShareSetLike[]) {
  const choice = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((row) => row != null) ?? null;
  if (choice) {
    const effort = bikeEffortSeconds(choice.spec);
    const prescribed = bikeTimerRoundCount(choice);
    const logged = sets.length;
    if (prescribed > 0 && logged > 0 && logged < prescribed) {
      return {
        totalSeconds: Math.max(1, Math.round((effort.totalSeconds * logged) / prescribed)),
        workSeconds: Math.max(1, Math.round((effort.workSeconds * logged) / prescribed)),
      };
    }
    return effort;
  }
  const workSeconds = sets.reduce(
    (sum, set) => sum + (set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  return { totalSeconds: workSeconds, workSeconds };
}

/**
 * Bike time is the prescribed ride (work plus easy spin). A one-second logger
 * freeze is shorter than that ride, so it does not replace it. A longer saved
 * clock still counts.
 */
export function bikeCardioDurationSeconds(session: ShareSessionLike) {
  const effort = bikeCardioEffort(loggedSets(session.sets));
  const wall = sessionDurationSeconds(session);
  if (effort.totalSeconds > 0 && wall < effort.totalSeconds) return effort.totalSeconds;
  return wall > 0 ? wall : effort.totalSeconds;
}

export function workoutCompleteTiles(input: {
  session: ShareSessionLike;
  displayUnit: LoadUnit;
  newPrCount: number;
}): WorkoutCompleteTile[] {
  if (isBikeCardioSession(input.session)) {
    const sets = loggedSets(input.session.sets);
    const effort = bikeCardioEffort(sets);
    const seconds = bikeCardioDurationSeconds(input.session);
    const intervals = sessionRoundCount(sets) || sets.length;
    return [
      { key: "time", label: "Time", value: seconds > 0 ? formatShareDuration(seconds) : "0:00" },
      { key: "setsRounds", label: "Intervals", value: String(intervals) },
      { key: "volume", label: "Work", value: effort.workSeconds > 0 ? formatShareDuration(effort.workSeconds) : "0:00" },
      { key: "prs", label: "New PRs", value: "0" },
    ];
  }
  const seconds = sessionDurationSeconds(input.session);
  const sets = sessionSetCount(input.session.sets);
  const rounds = sessionRoundCount(input.session.sets);
  const volume = sessionVolume(input.session.sets, input.displayUnit);
  const setsRounds = rounds > 0 && rounds !== sets ? `${sets} / ${rounds}` : String(Math.max(sets, rounds));
  return [
    { key: "time", label: "Time", value: seconds > 0 ? formatShareDuration(seconds) : "0:00" },
    { key: "setsRounds", label: "Sets / Rounds", value: setsRounds },
    {
      key: "volume",
      label: `Total ${shareVolumeUnit(input.displayUnit)}`,
      value: formatShareVolume(volume),
    },
    { key: "prs", label: "New PRs", value: String(input.newPrCount) },
  ];
}

export function workoutCompleteShareStats(tiles: WorkoutCompleteTile[]): ShareStat[] {
  return tiles.map((tile) => ({ key: tile.key, label: tile.label, value: tile.value }));
}
