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
  updatedAt?: Date;
  status: string;
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

export function sessionDurationSeconds(session: ShareSessionLike) {
  const logged = loggedSets(session.sets).reduce(
    (sum, set) => sum + (set.durationSeconds && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  if (session.updatedAt) {
    const elapsed = Math.round((session.updatedAt.getTime() - session.performedAt.getTime()) / 1000);
    if (elapsed >= 5 * 60 && elapsed <= 4 * 60 * 60) {
      return elapsed;
    }
  }
  return logged > 0 ? logged : 0;
}

export function formatShareVolume(volume: number, unit: LoadUnit) {
  const label = unit === "kg" ? "KG" : "LBS";
  return `${volume.toLocaleString("en-US")} ${label}`;
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
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume, unit) } : null);
    push(sets > 0 ? { key: "sets", label: "Sets", value: String(sets) } : null);
    push(seconds > 0 ? { key: "time", label: "Time", value: formatClock(seconds) } : null);
  } else if (kind === "rounds") {
    push(rounds > 0 ? { key: "rounds", label: "Rounds", value: String(rounds) } : null);
    push(seconds > 0 ? { key: "time", label: "Time", value: formatClock(seconds) } : null);
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume, unit) } : null);
  } else {
    push(rounds > 0 ? { key: "rounds", label: "Rounds", value: String(rounds) } : null);
    push(volume > 0 ? { key: "volume", label: "Volume", value: formatShareVolume(volume, unit) } : null);
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
