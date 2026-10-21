import { formatClock, resolveLogMode } from "@/lib/exercise-log-mode";
import { isBikeIntervalName } from "@/lib/bike-sessions";
import { currentConsecutiveDays, uniqueActiveDayKeys } from "@/lib/records";
import { volumeInUnit, type LoadUnit } from "@/lib/units";
import { APP_TIMEZONE } from "@/lib/timezone";

export const SHARE_CARD_APP_LINK = "svg-performance.vercel.app";
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;
export const SHARE_CARD_STYLES = ["photo", "black", "lime"] as const;
export type ShareCardStyle = (typeof SHARE_CARD_STYLES)[number];
export type ShareWorkoutKind = "lift" | "rounds" | "mixed";

export type ShareStat = {
  key: string;
  label: string;
  value: string;
  /** Smaller same-line unit, e.g. volume "1,125" + "lbs". */
  unit?: string;
};

export type ShareSetLike = {
  exerciseName: string;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode?: string | null;
  durationSeconds?: number | null;
  completed: boolean;
};

export type ShareSessionLike = {
  title: string;
  performedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  status: string;
  /** Frozen header duration from Save. Preferred over updatedAt when the session is complete. */
  elapsedSeconds?: number | null;
  sets: ShareSetLike[];
};

function loggedSets(sets: ShareSetLike[]) {
  return sets.filter((set) => set.completed || set.reps != null || set.durationSeconds != null || set.loadValue != null);
}

export function classifyShareWorkout(session: ShareSessionLike): ShareWorkoutKind {
  const title = session.title.toLowerCase();
  const sets = loggedSets(session.sets);
  const hasRounds = sets.some((set) => {
    const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
    return mode === "timed_round" || isBikeIntervalName(set.exerciseName);
  });
  const titleRounds = /\b(bag|pads|sparring|bike|round|rounds)\b/.test(title);
  const hasLift = sets.some((set) => {
    const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
    return mode === "load_reps" || mode === "load_timed";
  });
  const rounds = hasRounds || titleRounds;
  if (rounds && hasLift) return "mixed";
  if (rounds) return "rounds";
  return "lift";
}

export function sessionVolume(sets: ShareSetLike[], displayUnit: LoadUnit) {
  return Math.round(
    loggedSets(sets).reduce(
      (sum, set) => sum + volumeInUnit(set.reps, set.loadValue, set.loadUnit, displayUnit),
      0,
    ),
  );
}

export function sessionSetCount(sets: ShareSetLike[]) {
  return loggedSets(sets).length;
}

export function sessionRoundCount(sets: ShareSetLike[]) {
  return loggedSets(sets).filter((set) => {
    const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
    return mode === "timed_round" || isBikeIntervalName(set.exerciseName);
  }).length;
}

/** Wall-clock cap for a session left open. Longer than this is not training time. */
export const SESSION_DURATION_CAP_SECONDS = 4 * 60 * 60;

export function formatShareDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return formatClock(safe);
}

export function sessionDurationSeconds(session: ShareSessionLike) {
  if (
    session.status === "complete" &&
    typeof session.elapsedSeconds === "number" &&
    Number.isFinite(session.elapsedSeconds) &&
    session.elapsedSeconds >= 0
  ) {
    return Math.min(SESSION_DURATION_CAP_SECONDS, Math.round(session.elapsedSeconds));
  }
  const logged = loggedSets(session.sets).reduce(
    (sum, set) => sum + (set.durationSeconds && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  const start = session.createdAt ?? session.performedAt;
  if (loggedSets(session.sets).length > 0 && session.updatedAt && start) {
    const elapsed = Math.round((session.updatedAt.getTime() - start.getTime()) / 1000);
    if (elapsed >= 1 && elapsed <= SESSION_DURATION_CAP_SECONDS) return elapsed;
    if (elapsed > SESSION_DURATION_CAP_SECONDS) {
      if (logged > 0 && logged <= SESSION_DURATION_CAP_SECONDS) return logged;
      return SESSION_DURATION_CAP_SECONDS;
    }
  }
  return logged > 0 ? logged : 0;
}

export function shareVolumeUnit(_unit: LoadUnit) {
  return "lbs";
}

export function formatShareVolume(volume: number) {
  return volume.toLocaleString("en-US");
}

export function workoutStreakDays(
  performedAts: Date[],
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  return currentConsecutiveDays(uniqueActiveDayKeys(performedAts, timeZone), now, timeZone);
}

export function selectShareStats(input: {
  session: ShareSessionLike;
  displayUnit?: LoadUnit;
  streakDays?: number;
}): ShareStat[] {
  const unit = input.displayUnit ?? "lb";
  const kind = classifyShareWorkout(input.session);
  const volume = sessionVolume(input.session.sets, unit);
  const sets = sessionSetCount(input.session.sets);
  const rounds = sessionRoundCount(input.session.sets);
  const seconds = sessionDurationSeconds(input.session);
  const streak = input.streakDays ?? 0;
  const stats: ShareStat[] = [];

  const push = (stat: ShareStat | null) => {
    if (stat) stats.push(stat);
  };

  if (kind === "lift") {
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume), unit: shareVolumeUnit(unit) } : null);
    push(sets > 0 ? { key: "sets", label: "Sets", value: String(sets) } : null);
    push(seconds > 0 ? { key: "time", label: "Time", value: formatClock(seconds) } : null);
  } else if (kind === "rounds") {
    push(rounds > 0 ? { key: "rounds", label: "Rounds", value: String(rounds) } : null);
    push(seconds > 0 ? { key: "time", label: "Time", value: formatClock(seconds) } : null);
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume), unit: shareVolumeUnit(unit) } : null);
  } else {
    push(rounds > 0 ? { key: "rounds", label: "Rounds", value: String(rounds) } : null);
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume), unit: shareVolumeUnit(unit) } : null);
    push(seconds > 0 ? { key: "time", label: "Time", value: formatClock(seconds) } : null);
  }
  if (streak > 0) {
    push({
      key: "streak",
      label: "Streak",
      value: `${streak} day${streak === 1 ? "" : "s"}`,
    });
  }
  return stats.slice(0, 4);
}
