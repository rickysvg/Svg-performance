import { formatClock } from "@/lib/exercise-log-mode";
import { civilDayInstant } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";
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

/** Session 2 is the second logged workout on that local day, not the second workout ever. */
export function sameDaySessionOrdinal(
  sessionId: string,
  sessions: Array<{ id: string; performedAt: Date; updatedAt?: Date }>,
  timeZone: string,
) {
  const current = sessions.find((row) => row.id === sessionId);
  if (!current) return sessionOrdinal(sessionId, sessions.map((row) => row.id));
  const key = dayKey(civilDayInstant(current.performedAt, timeZone), timeZone);
  const same = sessions
    .filter((row) => dayKey(civilDayInstant(row.performedAt, timeZone), timeZone) === key)
    .sort((a, b) => {
      const aAt = (a.updatedAt ?? a.performedAt).getTime();
      const bAt = (b.updatedAt ?? b.performedAt).getTime();
      return aAt - bAt || a.id.localeCompare(b.id);
    });
  return sessionOrdinal(
    sessionId,
    same.map((row) => row.id),
  );
}

export function formatHistoryWhen(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
