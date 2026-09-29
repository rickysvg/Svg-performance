import { isBikeIntervalName } from "@/lib/bike-sessions";
import { isHoldName, resolveLogMode } from "@/lib/exercise-log-mode";
import { convertLoad, isLoadUnit, type LoadUnit } from "@/lib/units";

export const BADGE_IDS = [
  "lift_l1",
  "lift_l2",
  "lift_l3",
  "lift_l4",
  "lift_l5",
  "bike_10",
  "bike_25",
  "bike_50",
  "bike_100",
  "hold_1min",
  "hold_2min",
  "hold_3min",
  "hold_5min",
  "pads_20",
  "pads_35",
  "pads_50",
  "pads_100",
  "pads_250",
  "bag_20",
  "bag_35",
  "bag_50",
  "bag_100",
  "bag_250",
  "sparring_10",
  "sparring_20",
  "sparring_35",
  "sparring_50",
  "grappling_10",
  "grappling_20",
  "grappling_35",
  "grappling_50",
  "first_session",
  "workouts_3",
  "workouts_5",
  "workouts_10",
  "workouts_25",
  "workouts_50",
  "workouts_100",
  "streak_3",
  "streak_7",
  "streak_14",
  "streak_30",
  "streak_100",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export const BADGE_CATEGORIES = ["lifting", "cardio", "martial", "grind"] as const;
export type BadgeCategoryId = (typeof BADGE_CATEGORIES)[number];

export const BADGE_CATEGORY_LABEL: Record<BadgeCategoryId, string> = {
  lifting: "Lifting",
  cardio: "Cardio",
  martial: "Martial Arts",
  grind: "Grind",
};

export const BADGE_TIERS = ["bronze", "steel", "gold"] as const;
export type BadgeTier = (typeof BADGE_TIERS)[number];

export type BadgeLadderId =
  | "lift"
  | "bike"
  | "hold"
  | "pads"
  | "bag"
  | "sparring"
  | "grappling"
  | "workouts"
  | "streak";

export type BadgeLadderDef = {
  id: BadgeLadderId;
  category: BadgeCategoryId;
  label: string;
  ids: readonly BadgeId[];
};

export const BADGE_LADDERS: readonly BadgeLadderDef[] = [
  { id: "lift", category: "lifting", label: "Lift", ids: ["lift_l1", "lift_l2", "lift_l3", "lift_l4", "lift_l5"] },
  { id: "bike", category: "cardio", label: "Bike rounds", ids: ["bike_10", "bike_25", "bike_50", "bike_100"] },
  { id: "hold", category: "cardio", label: "Timed hold", ids: ["hold_1min", "hold_2min", "hold_3min", "hold_5min"] },
  { id: "pads", category: "martial", label: "Pad rounds", ids: ["pads_20", "pads_35", "pads_50", "pads_100", "pads_250"] },
  { id: "bag", category: "martial", label: "Bag rounds", ids: ["bag_20", "bag_35", "bag_50", "bag_100", "bag_250"] },
  { id: "sparring", category: "martial", label: "Sparring", ids: ["sparring_10", "sparring_20", "sparring_35", "sparring_50"] },
  { id: "grappling", category: "martial", label: "Grappling", ids: ["grappling_10", "grappling_20", "grappling_35", "grappling_50"] },
  {
    id: "workouts",
    category: "grind",
    label: "Workouts",
    ids: ["first_session", "workouts_3", "workouts_5", "workouts_10", "workouts_25", "workouts_50", "workouts_100"],
  },
  { id: "streak", category: "grind", label: "Day streak", ids: ["streak_3", "streak_7", "streak_14", "streak_30", "streak_100"] },
];

export const BADGES_BY_CATEGORY: Record<BadgeCategoryId, BadgeId[]> = {
  lifting: [...BADGE_LADDERS.find((row) => row.category === "lifting")!.ids],
  cardio: BADGE_LADDERS.filter((row) => row.category === "cardio").flatMap((row) => [...row.ids]),
  martial: BADGE_LADDERS.filter((row) => row.category === "martial").flatMap((row) => [...row.ids]),
  grind: BADGE_LADDERS.filter((row) => row.category === "grind").flatMap((row) => [...row.ids]),
};

/** Old single-milestone ids → new ladder rung. Unlisted ids stay themselves. */
export const LEGACY_BADGE_ID_MAP: Record<string, BadgeId> = {
  lift_100kg: "lift_l3",
  lift_200kg: "lift_l5",
  lift_225lb: "lift_l3",
  lift_405lb: "lift_l5",
};

export const LIFT_LADDER = [
  { id: "lift_l1" as const, lb: 135, kg: 60, tier: "bronze" as const },
  { id: "lift_l2" as const, lb: 185, kg: 80, tier: "bronze" as const },
  { id: "lift_l3" as const, lb: 225, kg: 100, tier: "steel" as const },
  { id: "lift_l4" as const, lb: 315, kg: 140, tier: "steel" as const },
  { id: "lift_l5" as const, lb: 405, kg: 180, tier: "gold" as const },
];

export type LiftLadderId = (typeof LIFT_LADDER)[number]["id"];

export function isLiftLadderId(id: string): id is LiftLadderId {
  return LIFT_LADDER.some((row) => row.id === id);
}

export function liftLadderThreshold(id: LiftLadderId, unit: LoadUnit) {
  const row = LIFT_LADDER.find((item) => item.id === id)!;
  return unit === "kg" ? row.kg : row.lb;
}

export function liftBadgeTitle(id: LiftLadderId, unit: LoadUnit) {
  const display = unit === "kg" ? "lb" : unit;
  const threshold = liftLadderThreshold(id, display);
  return `${threshold} ${display} lift`;
}

export function liftBadgeHint(id: LiftLadderId, unit: LoadUnit) {
  const display = unit === "kg" ? "lb" : unit;
  return `Any loaded set at ${liftLadderThreshold(id, display)} ${display}`;
}

export type BadgeDef = {
  id: BadgeId;
  title: string;
  hint: string;
  icon: "star" | "flame" | "bike" | "barbell" | "pads" | "lock" | "hold" | "heavy";
  category: BadgeCategoryId;
};

export type EarnedBadge = BadgeDef & {
  earned: boolean;
  earnedAt: Date | null;
  mark: string;
  tier: BadgeTier;
  ribbon: string;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string;
};

export type BadgeLadderView = {
  id: BadgeLadderId;
  category: BadgeCategoryId;
  label: string;
  rungs: EarnedBadge[];
  featured: EarnedBadge;
  earnedRungs: EarnedBadge[];
  next: EarnedBadge | null;
  allEarned: boolean;
};

export function badgeCategory(id: BadgeId): BadgeCategoryId {
  if (id.startsWith("lift")) return "lifting";
  if (id.startsWith("bike") || id.startsWith("hold")) return "cardio";
  if (
    id.startsWith("pads") ||
    id.startsWith("bag") ||
    id.startsWith("sparring") ||
    id.startsWith("grappling")
  ) {
    return "martial";
  }
  return "grind";
}

export function badgeMark(id: BadgeId, unit: LoadUnit = "lb") {
  if (isLiftLadderId(id)) return String(liftLadderThreshold(id, unit === "kg" ? "lb" : unit));
  if (id === "first_session") return "1";
  if (id.startsWith("hold_")) {
    const minutes = Number(id.replace("hold_", "").replace("min", ""));
    return Number.isFinite(minutes) ? `${minutes}:00` : id;
  }
  const numeric = id.match(/_(\d+)$/);
  return numeric?.[1] ?? "1";
}

export function badgeTier(id: BadgeId): BadgeTier {
  if (isLiftLadderId(id)) return LIFT_LADDER.find((row) => row.id === id)!.tier;
  if (
    id === "first_session" ||
    id === "workouts_3" ||
    id === "workouts_5" ||
    id === "streak_3" ||
    id === "streak_7" ||
    id === "bike_10" ||
    id === "hold_1min" ||
    id === "pads_20" ||
    id === "pads_35" ||
    id === "bag_20" ||
    id === "bag_35" ||
    id === "sparring_10" ||
    id === "sparring_20" ||
    id === "grappling_10" ||
    id === "grappling_20"
  ) {
    return "bronze";
  }
  if (
    id === "bike_100" ||
    id === "hold_5min" ||
    id === "pads_250" ||
    id === "bag_250" ||
    id === "sparring_50" ||
    id === "grappling_50" ||
    id === "workouts_50" ||
    id === "workouts_100" ||
    id === "streak_100"
  ) {
    return "gold";
  }
  return "steel";
}

export function badgeRibbon(id: BadgeId) {
  if (id.startsWith("streak")) return "Streak";
  if (id.startsWith("lift")) return "Lift";
  if (id.startsWith("bike")) return "Bike";
  if (id.startsWith("pads")) return "Pads";
  if (id.startsWith("bag")) return "Bag";
  if (id.startsWith("sparring")) return "Sparring";
  if (id.startsWith("grappling")) return "Grappling";
  if (id.startsWith("hold")) return "Hold";
  if (id === "first_session") return "First";
  return "Work";
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function badgeProgressLabel(id: BadgeId, current: number, target: number) {
  if (id.startsWith("hold_")) {
    return `${formatClock(current)}/${formatClock(target)}`;
  }
  const shown = Math.max(0, Math.round(current));
  return `${shown}/${target}`;
}

export function formatBadgeEarnedOn(date: Date) {
  return `Earned ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function badgeCatalog(unit: LoadUnit = "lb"): BadgeDef[] {
  const lift = (id: LiftLadderId): BadgeDef => ({
    id,
    title: liftBadgeTitle(id, unit),
    hint: liftBadgeHint(id, unit),
    icon: id === "lift_l5" ? "heavy" : "barbell",
    category: "lifting",
  });
  return [
    lift("lift_l1"),
    lift("lift_l2"),
    lift("lift_l3"),
    lift("lift_l4"),
    lift("lift_l5"),
    { id: "bike_10", title: "10 bike rounds", hint: "Assault-bike rounds logged", icon: "bike", category: "cardio" },
    { id: "bike_25", title: "25 bike rounds", hint: "Assault-bike rounds logged", icon: "bike", category: "cardio" },
    { id: "bike_50", title: "50 bike rounds", hint: "Assault-bike rounds logged", icon: "bike", category: "cardio" },
    { id: "bike_100", title: "100 bike rounds", hint: "Assault-bike rounds logged", icon: "bike", category: "cardio" },
    { id: "hold_1min", title: "1 min hold", hint: "A timed hold of 1:00 or more", icon: "hold", category: "cardio" },
    { id: "hold_2min", title: "2 min hold", hint: "A timed hold of 2:00 or more", icon: "hold", category: "cardio" },
    { id: "hold_3min", title: "3 min hold", hint: "A timed hold of 3:00 or more", icon: "hold", category: "cardio" },
    { id: "hold_5min", title: "5 min hold", hint: "A timed hold of 5:00 or more", icon: "hold", category: "cardio" },
    { id: "pads_20", title: "20 pad rounds", hint: "Pad or mitt rounds logged", icon: "pads", category: "martial" },
    { id: "pads_35", title: "35 pad rounds", hint: "Pad or mitt rounds logged", icon: "pads", category: "martial" },
    { id: "pads_50", title: "50 pad rounds", hint: "Pad or mitt rounds logged", icon: "pads", category: "martial" },
    { id: "pads_100", title: "100 pad rounds", hint: "Pad or mitt rounds logged", icon: "pads", category: "martial" },
    { id: "pads_250", title: "250 pad rounds", hint: "Pad or mitt rounds logged", icon: "pads", category: "martial" },
    { id: "bag_20", title: "20 bag rounds", hint: "Heavy bag rounds logged", icon: "pads", category: "martial" },
    { id: "bag_35", title: "35 bag rounds", hint: "Heavy bag rounds logged", icon: "pads", category: "martial" },
    { id: "bag_50", title: "50 bag rounds", hint: "Heavy bag rounds logged", icon: "pads", category: "martial" },
    { id: "bag_100", title: "100 bag rounds", hint: "Heavy bag rounds logged", icon: "pads", category: "martial" },
    { id: "bag_250", title: "250 bag rounds", hint: "Heavy bag rounds logged", icon: "pads", category: "martial" },
    { id: "sparring_10", title: "10 sparring rounds", hint: "Sparring rounds logged", icon: "pads", category: "martial" },
    { id: "sparring_20", title: "20 sparring rounds", hint: "Sparring rounds logged", icon: "pads", category: "martial" },
    { id: "sparring_35", title: "35 sparring rounds", hint: "Sparring rounds logged", icon: "pads", category: "martial" },
    { id: "sparring_50", title: "50 sparring rounds", hint: "Sparring rounds logged", icon: "pads", category: "martial" },
    { id: "grappling_10", title: "10 grappling rounds", hint: "Grappling / rolling rounds logged", icon: "pads", category: "martial" },
    { id: "grappling_20", title: "20 grappling rounds", hint: "Grappling / rolling rounds logged", icon: "pads", category: "martial" },
    { id: "grappling_35", title: "35 grappling rounds", hint: "Grappling / rolling rounds logged", icon: "pads", category: "martial" },
    { id: "grappling_50", title: "50 grappling rounds", hint: "Grappling / rolling rounds logged", icon: "pads", category: "martial" },
    { id: "first_session", title: "First session", hint: "Log your first workout", icon: "star", category: "grind" },
    { id: "workouts_3", title: "3 workouts", hint: "Three sessions in the book", icon: "star", category: "grind" },
    { id: "workouts_5", title: "5 workouts", hint: "Five sessions logged", icon: "star", category: "grind" },
    { id: "workouts_10", title: "10 workouts", hint: "Ten sessions in the book", icon: "star", category: "grind" },
    { id: "workouts_25", title: "25 workouts", hint: "Twenty-five sessions logged", icon: "star", category: "grind" },
    { id: "workouts_50", title: "50 workouts", hint: "Fifty sessions logged", icon: "barbell", category: "grind" },
    { id: "workouts_100", title: "100 workouts", hint: "One hundred sessions logged", icon: "heavy", category: "grind" },
    { id: "streak_3", title: "3-day streak", hint: "Three scheduled days in a row", icon: "flame", category: "grind" },
    { id: "streak_7", title: "7-day streak", hint: "Seven scheduled days in a row", icon: "flame", category: "grind" },
    { id: "streak_14", title: "14-day streak", hint: "Fourteen scheduled days in a row", icon: "flame", category: "grind" },
    { id: "streak_30", title: "30-day streak", hint: "Thirty scheduled days in a row", icon: "flame", category: "grind" },
    { id: "streak_100", title: "100-day streak", hint: "One hundred scheduled days in a row", icon: "flame", category: "grind" },
  ];
}

export const BADGE_CATALOG = badgeCatalog("lb");

export type BadgeSetLike = {
  exerciseName: string;
  loadValue: number | null;
  loadUnit: string;
  durationSeconds?: number | null;
  logMode?: string | null;
  completed?: boolean;
  performedAt: Date;
};

function isTimedRound(name: string, logMode?: string | null) {
  return resolveLogMode({ logMode, name }) === "timed_round";
}

function named(name: string, pattern: RegExp) {
  return pattern.test(name);
}

/** Pad / mitt rounds only — not bag, sparring, or grappling. */
export function isPadRound(name: string, logMode?: string | null) {
  if (!isTimedRound(name, logMode)) return false;
  if (named(name, /\b(sparring|grappling|rolling)\b/i)) return false;
  if (named(name, /\b(bag)\b/i) && !named(name, /\b(pad|pads|mitt|mitts)\b/i)) return false;
  return named(name, /\b(pad|pads|mitt|mitts)\b/i);
}

/** Heavy bag rounds only. */
export function isBagRound(name: string, logMode?: string | null) {
  if (!isTimedRound(name, logMode)) return false;
  if (named(name, /\b(sparring|grappling|rolling|pad|pads|mitt|mitts)\b/i)) return false;
  return named(name, /\bbag\b/i);
}

export function isSparringRound(name: string, logMode?: string | null) {
  if (!isTimedRound(name, logMode)) return false;
  return named(name, /\bsparring\b/i);
}

export function isGrapplingRound(name: string, logMode?: string | null) {
  if (!isTimedRound(name, logMode)) return false;
  return named(name, /\b(grappling|rolling)\b/i);
}

export function countBikeRounds(sets: BadgeSetLike[]) {
  return sets.filter((set) => set.completed !== false && isBikeIntervalName(set.exerciseName)).length;
}

export function countPadRounds(sets: BadgeSetLike[]) {
  return sets.filter((set) => set.completed !== false && isPadRound(set.exerciseName, set.logMode)).length;
}

export function countBagRounds(sets: BadgeSetLike[]) {
  return sets.filter((set) => set.completed !== false && isBagRound(set.exerciseName, set.logMode)).length;
}

export function countSparringRounds(sets: BadgeSetLike[]) {
  return sets.filter((set) => set.completed !== false && isSparringRound(set.exerciseName, set.logMode)).length;
}

export function countGrapplingRounds(sets: BadgeSetLike[]) {
  return sets.filter((set) => set.completed !== false && isGrapplingRound(set.exerciseName, set.logMode)).length;
}

export function heaviestInUnit(sets: BadgeSetLike[], unit: LoadUnit) {
  let best = 0;
  for (const set of sets) {
    if (set.completed === false || set.loadValue == null || !isLoadUnit(set.loadUnit)) {
      continue;
    }
    const value = convertLoad(set.loadValue, set.loadUnit, unit);
    if (value > best) best = value;
  }
  return best;
}

export function heaviestKg(sets: BadgeSetLike[]) {
  return heaviestInUnit(sets, "kg");
}

export function longestHoldSeconds(sets: BadgeSetLike[]) {
  let best = 0;
  for (const set of sets) {
    if (set.completed === false || !isHoldName(set.exerciseName)) continue;
    const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
    if (mode !== "timed" && mode !== "load_timed") continue;
    if (set.durationSeconds != null && set.durationSeconds > best) {
      best = set.durationSeconds;
    }
  }
  return best;
}

function holdSecondsFor(id: BadgeId) {
  if (id === "hold_1min") return 60;
  if (id === "hold_2min") return 120;
  if (id === "hold_3min") return 180;
  if (id === "hold_5min") return 300;
  return 0;
}

export function evaluateBadges(input: {
  workoutCount: number;
  currentStreak: number;
  longestStreak: number;
  sets: BadgeSetLike[];
  firstWorkoutAt?: Date | null;
  displayUnit?: LoadUnit;
}): EarnedBadge[] {
  const bike = countBikeRounds(input.sets);
  const pads = countPadRounds(input.sets);
  const bag = countBagRounds(input.sets);
  const sparring = countSparringRounds(input.sets);
  const grappling = countGrapplingRounds(input.sets);
  const unit = input.displayUnit ?? "lb";
  const lift = heaviestInUnit(input.sets, unit);
  const liftLb = heaviestInUnit(input.sets, "lb");
  const liftKg = heaviestInUnit(input.sets, "kg");
  const hold = longestHoldSeconds(input.sets);
  const firstAt = input.firstWorkoutAt ?? null;
  const earnedAt = (ok: boolean, at: Date | null = firstAt) => (ok ? at : null);
  const liftOk = (id: LiftLadderId) => {
    const row = LIFT_LADDER.find((item) => item.id === id)!;
    return liftLb + 1e-6 >= row.lb || liftKg + 1e-6 >= row.kg;
  };

  const metrics: Record<BadgeId, { current: number; target: number; ok: boolean }> = {
    lift_l1: { current: lift, target: liftLadderThreshold("lift_l1", unit), ok: liftOk("lift_l1") },
    lift_l2: { current: lift, target: liftLadderThreshold("lift_l2", unit), ok: liftOk("lift_l2") },
    lift_l3: { current: lift, target: liftLadderThreshold("lift_l3", unit), ok: liftOk("lift_l3") },
    lift_l4: { current: lift, target: liftLadderThreshold("lift_l4", unit), ok: liftOk("lift_l4") },
    lift_l5: { current: lift, target: liftLadderThreshold("lift_l5", unit), ok: liftOk("lift_l5") },
    bike_10: { current: bike, target: 10, ok: bike >= 10 },
    bike_25: { current: bike, target: 25, ok: bike >= 25 },
    bike_50: { current: bike, target: 50, ok: bike >= 50 },
    bike_100: { current: bike, target: 100, ok: bike >= 100 },
    hold_1min: { current: hold, target: 60, ok: hold >= 60 },
    hold_2min: { current: hold, target: 120, ok: hold >= 120 },
    hold_3min: { current: hold, target: 180, ok: hold >= 180 },
    hold_5min: { current: hold, target: 300, ok: hold >= 300 },
    pads_20: { current: pads, target: 20, ok: pads >= 20 },
    pads_35: { current: pads, target: 35, ok: pads >= 35 },
    pads_50: { current: pads, target: 50, ok: pads >= 50 },
    pads_100: { current: pads, target: 100, ok: pads >= 100 },
    pads_250: { current: pads, target: 250, ok: pads >= 250 },
    bag_20: { current: bag, target: 20, ok: bag >= 20 },
    bag_35: { current: bag, target: 35, ok: bag >= 35 },
    bag_50: { current: bag, target: 50, ok: bag >= 50 },
    bag_100: { current: bag, target: 100, ok: bag >= 100 },
    bag_250: { current: bag, target: 250, ok: bag >= 250 },
    sparring_10: { current: sparring, target: 10, ok: sparring >= 10 },
    sparring_20: { current: sparring, target: 20, ok: sparring >= 20 },
    sparring_35: { current: sparring, target: 35, ok: sparring >= 35 },
    sparring_50: { current: sparring, target: 50, ok: sparring >= 50 },
    grappling_10: { current: grappling, target: 10, ok: grappling >= 10 },
    grappling_20: { current: grappling, target: 20, ok: grappling >= 20 },
    grappling_35: { current: grappling, target: 35, ok: grappling >= 35 },
    grappling_50: { current: grappling, target: 50, ok: grappling >= 50 },
    first_session: { current: Math.min(input.workoutCount, 1), target: 1, ok: input.workoutCount >= 1 },
    workouts_3: { current: input.workoutCount, target: 3, ok: input.workoutCount >= 3 },
    workouts_5: { current: input.workoutCount, target: 5, ok: input.workoutCount >= 5 },
    workouts_10: { current: input.workoutCount, target: 10, ok: input.workoutCount >= 10 },
    workouts_25: { current: input.workoutCount, target: 25, ok: input.workoutCount >= 25 },
    workouts_50: { current: input.workoutCount, target: 50, ok: input.workoutCount >= 50 },
    workouts_100: { current: input.workoutCount, target: 100, ok: input.workoutCount >= 100 },
    streak_3: { current: input.longestStreak, target: 3, ok: input.longestStreak >= 3 },
    streak_7: { current: input.longestStreak, target: 7, ok: input.longestStreak >= 7 },
    streak_14: { current: input.longestStreak, target: 14, ok: input.longestStreak >= 14 },
    streak_30: { current: input.longestStreak, target: 30, ok: input.longestStreak >= 30 },
    streak_100: { current: input.longestStreak, target: 100, ok: input.longestStreak >= 100 },
  };

  return badgeCatalog(unit).map((def) => {
    const row = metrics[def.id];
    const current = Math.min(row.current, row.target);
    return {
      ...def,
      earned: row.ok,
      earnedAt: earnedAt(row.ok),
      mark: badgeMark(def.id, unit),
      tier: badgeTier(def.id),
      ribbon: badgeRibbon(def.id),
      progressCurrent: current,
      progressTarget: row.target,
      progressLabel: badgeProgressLabel(def.id, current, row.target),
    };
  });
}

export function featuredBadges(badges: EarnedBadge[]) {
  return badges;
}

export function badgesGroupedByCategory(badges: EarnedBadge[]) {
  return BADGE_CATEGORIES.map((category) => ({
    category,
    label: BADGE_CATEGORY_LABEL[category],
    badges: BADGES_BY_CATEGORY[category]
      .map((id) => badges.find((row) => row.id === id))
      .filter((row): row is EarnedBadge => Boolean(row)),
  }));
}

export function featuredLadderRung(rungs: EarnedBadge[]) {
  const next = rungs.find((row) => !row.earned) ?? null;
  const lastEarned = [...rungs].reverse().find((row) => row.earned) ?? rungs[0]!;
  return next ?? lastEarned;
}

export function badgeLadders(badges: EarnedBadge[]): BadgeLadderView[] {
  return BADGE_LADDERS.map((ladder) => {
    const rungs = ladder.ids
      .map((id) => badges.find((row) => row.id === id))
      .filter((row): row is EarnedBadge => Boolean(row));
    const earnedRungs = rungs.filter((row) => row.earned);
    const next = rungs.find((row) => !row.earned) ?? null;
    const featured = featuredLadderRung(rungs);
    return {
      id: ladder.id,
      category: ladder.category,
      label: ladder.label,
      rungs,
      featured,
      earnedRungs,
      next,
      allEarned: rungs.length > 0 && earnedRungs.length === rungs.length,
    };
  });
}

export function laddersGroupedByCategory(badges: EarnedBadge[]) {
  const ladders = badgeLadders(badges);
  return BADGE_CATEGORIES.map((category) => ({
    category,
    label: BADGE_CATEGORY_LABEL[category],
    ladders: ladders.filter((row) => row.category === category),
  }));
}

export function earnedCount(badges: EarnedBadge[]) {
  return badges.filter((row) => row.earned).length;
}

export function mapLegacyBadgeId(id: string): BadgeId | null {
  if ((BADGE_IDS as readonly string[]).includes(id)) return id as BadgeId;
  return LEGACY_BADGE_ID_MAP[id] ?? null;
}

/** Unused helper kept so hold thresholds stay obvious in tests. */
export function holdBadgeSeconds(id: BadgeId) {
  return holdSecondsFor(id);
}
