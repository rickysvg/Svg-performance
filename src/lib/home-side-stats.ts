/**
 * Home mass-card readouts. Rule-based only: logged body fat and
 * completed sessions, or an active fight date. No model calls.
 */

export type BodyFatReadout = {
  value: number | null;
  /** Signed change versus the previous body-fat entry. Null with no previous entry. */
  delta: number | null;
  direction: "up" | "down" | "flat" | "none";
};

export type HomeTrainingReadout =
  | { mode: "fight"; days: number }
  | { mode: "streak"; days: number };

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function civilDayNumber(key: string): number | null {
  const match = DATE_KEY.exec(key.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utc.getTime() / 86_400_000);
}

export function bodyFatReadout(
  latest: number | null | undefined,
  previous: number | null | undefined,
): BodyFatReadout {
  if (latest == null || !Number.isFinite(latest)) {
    return { value: null, delta: null, direction: "none" };
  }
  const value = Math.round(latest * 10) / 10;
  if (previous == null || !Number.isFinite(previous)) {
    return { value, delta: null, direction: "none" };
  }
  const delta = Math.round((value - previous) * 10) / 10;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { value, delta, direction };
}

export function formatBodyFatDelta(delta: number) {
  const amount = Math.abs(delta).toFixed(1);
  if (delta > 0) return `▲ ${amount}`;
  if (delta < 0) return `▼ ${amount}`;
  return `— ${amount}`;
}

/**
 * An active camp with a fight date that is today or later replaces the streak.
 * A past fight date, a cancelled camp, or a bad date keeps the streak.
 * Streak days are consecutive scheduled training days with a completed session.
 */
export function homeTrainingReadout(input: {
  campStatus?: string | null;
  fightDateKey?: string | null;
  todayKey: string;
  streakDays: number;
}): HomeTrainingReadout {
  const streakDays = Number.isFinite(input.streakDays)
    ? Math.max(0, Math.trunc(input.streakDays))
    : 0;
  if (input.campStatus !== "active" || !input.fightDateKey) {
    return { mode: "streak", days: streakDays };
  }
  const fight = civilDayNumber(input.fightDateKey);
  const today = civilDayNumber(input.todayKey);
  if (fight == null || today == null) return { mode: "streak", days: streakDays };
  const days = fight - today;
  if (days < 0) return { mode: "streak", days: streakDays };
  return { mode: "fight", days };
}
