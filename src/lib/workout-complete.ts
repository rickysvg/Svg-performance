import { formatClock } from "@/lib/exercise-log-mode";
import {
  formatShareVolume,
  sessionDurationSeconds,
  sessionRoundCount,
  sessionSetCount,
  sessionVolume,
  shareVolumeUnit,
  type ShareSessionLike,
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

export function workoutCompleteTiles(input: {
  session: ShareSessionLike;
  displayUnit: LoadUnit;
  newPrCount: number;
}): WorkoutCompleteTile[] {
  const seconds = sessionDurationSeconds(input.session);
  const sets = sessionSetCount(input.session.sets);
  const rounds = sessionRoundCount(input.session.sets);
  const volume = sessionVolume(input.session.sets, input.displayUnit);
  const setsRounds = rounds > 0 && rounds !== sets ? `${sets} / ${rounds}` : String(Math.max(sets, rounds));
  return [
    { key: "time", label: "Time", value: seconds > 0 ? formatClock(seconds) : "0:00" },
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
