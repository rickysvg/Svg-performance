import { isBikeIntervalName } from "@/lib/bike-sessions";
import { resolveLogMode } from "@/lib/exercise-log-mode";
import { convertLoad, isLoadUnit } from "@/lib/units";
export const BADGE_IDS = [
  "first_session",
  "streak_7",
  "bike_50",
  "lift_100kg",
  "pads_250",
  "streak_30",
  "hold_5min",
  "lift_200kg",
  "workouts_10",
  "workouts_25",
  "workouts_50",
  "workouts_100",
  "streak_100",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type BadgeDef = {
  id: BadgeId;
  title: string;
  hint: string;
  icon: "star" | "flame" | "bike" | "barbell" | "pads" | "lock" | "hold" | "heavy";
};

export type EarnedBadge = BadgeDef & {
  earned: boolean;
  earnedAt: Date | null;
};

export const BADGE_CATALOG: BadgeDef[] = [
  { id: "first_session", title: "First session", hint: "Log your first workout", icon: "star" },
  { id: "streak_7", title: "7-day streak", hint: "Seven scheduled days in a row", icon: "flame" },
  { id: "bike_50", title: "50 bike rounds", hint: "Assault-bike rounds logged", icon: "bike" },
  { id: "lift_100kg", title: "100 kg lift", hint: "Any loaded set at 100 kg", icon: "barbell" },
  { id: "pads_250", title: "Pad rounds ×250", hint: "Bag or pad rounds logged", icon: "pads" },
  { id: "streak_30", title: "30-day streak", hint: "Thirty scheduled days in a row", icon: "flame" },
  { id: "hold_5min", title: "5 min hold", hint: "A timed hold of 5:00 or more", icon: "hold" },
  { id: "lift_200kg", title: "200 kg lift", hint: "Any loaded set at 200 kg", icon: "heavy" },
  { id: "workouts_10", title: "10 workouts", hint: "Ten sessions in the book", icon: "star" },
  { id: "workouts_25", title: "25 workouts", hint: "Twenty-five sessions logged", icon: "star" },
  { id: "workouts_50", title: "50 workouts", hint: "Fifty sessions logged", icon: "barbell" },
  { id: "workouts_100", title: "100 workouts", hint: "One hundred sessions logged", icon: "heavy" },
  { id: "streak_100", title: "100-day streak", hint: "One hundred scheduled days in a row", icon: "flame" },
];

export const FEATURED_BADGE_IDS: BadgeId[] = [
  "first_session",
  "streak_7",
  "bike_50",
  "lift_100kg",
  "pads_250",
  "streak_30",
  "hold_5min",
  "lift_200kg",
];

export type BadgeSetLike = {
  exerciseName: string;
  loadValue: number | null;
  loadUnit: string;
  durationSeconds?: number | null;
  logMode?: string | null;
  completed?: boolean;
  performedAt: Date;
};

function isPadRound(name: string, logMode?: string | null) {
  const mode = resolveLogMode({ logMode, name });
  if (mode !== "timed_round") return false;
  return /\b(pad|pads|bag|mitt|mitts)\b/i.test(name);
}

export function countBikeRounds(sets: BadgeSetLike[]) {
  return sets.filter(
    (set) =>
      set.completed !== false && isBikeIntervalName(set.exerciseName),
  ).length;
}

export function countPadRounds(sets: BadgeSetLike[]) {
  return sets.filter(
    (set) => set.completed !== false && isPadRound(set.exerciseName, set.logMode),
  ).length;
}

export function heaviestKg(sets: BadgeSetLike[]) {
  let best = 0;
  for (const set of sets) {
    if (set.completed === false || set.loadValue == null || !isLoadUnit(set.loadUnit)) {
      continue;
    }
    const kg = convertLoad(set.loadValue, set.loadUnit, "kg");
    if (kg > best) best = kg;
  }
  return best;
}

export function longestHoldSeconds(sets: BadgeSetLike[]) {
  let best = 0;
  for (const set of sets) {
    const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
    if (set.completed === false || mode !== "timed") continue;
    if (set.durationSeconds != null && set.durationSeconds > best) {
      best = set.durationSeconds;
    }
  }
  return best;
}

export function evaluateBadges(input: {
  workoutCount: number;
  currentStreak: number;
  longestStreak: number;
  sets: BadgeSetLike[];
  firstWorkoutAt?: Date | null;
}): EarnedBadge[] {
  const bike = countBikeRounds(input.sets);
  const pads = countPadRounds(input.sets);
  const kg = heaviestKg(input.sets);
  const hold = longestHoldSeconds(input.sets);
  const firstAt = input.firstWorkoutAt ?? null;

  const earnedAt = (ok: boolean, at: Date | null = firstAt) => (ok ? at : null);

  const checks: Record<BadgeId, { ok: boolean; at: Date | null }> = {
    first_session: { ok: input.workoutCount >= 1, at: earnedAt(input.workoutCount >= 1) },
    streak_7: { ok: input.longestStreak >= 7, at: earnedAt(input.longestStreak >= 7) },
    bike_50: { ok: bike >= 50, at: earnedAt(bike >= 50) },
    lift_100kg: { ok: kg >= 100, at: earnedAt(kg >= 100) },
    pads_250: { ok: pads >= 250, at: earnedAt(pads >= 250) },
    streak_30: { ok: input.longestStreak >= 30, at: earnedAt(input.longestStreak >= 30) },
    hold_5min: { ok: hold >= 5 * 60, at: earnedAt(hold >= 5 * 60) },
    lift_200kg: { ok: kg >= 200, at: earnedAt(kg >= 200) },
    workouts_10: { ok: input.workoutCount >= 10, at: earnedAt(input.workoutCount >= 10) },
    workouts_25: { ok: input.workoutCount >= 25, at: earnedAt(input.workoutCount >= 25) },
    workouts_50: { ok: input.workoutCount >= 50, at: earnedAt(input.workoutCount >= 50) },
    workouts_100: { ok: input.workoutCount >= 100, at: earnedAt(input.workoutCount >= 100) },
    streak_100: { ok: input.longestStreak >= 100, at: earnedAt(input.longestStreak >= 100) },
  };

  return BADGE_CATALOG.map((def) => ({
    ...def,
    earned: checks[def.id].ok,
    earnedAt: checks[def.id].at,
  }));
}

export function featuredBadges(badges: EarnedBadge[]) {
  return FEATURED_BADGE_IDS.map((id) => badges.find((row) => row.id === id)).filter(
    (row): row is EarnedBadge => Boolean(row),
  );
}

export function earnedCount(badges: EarnedBadge[]) {
  return badges.filter((row) => row.earned).length;
}

