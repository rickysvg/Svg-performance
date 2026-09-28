import type { ScaleBand } from "@/lib/bike-sessions";

/**
 * Bag day numbers in demo-combat-skills.
 * Each weekday gets a distinct focus so Mon ≠ Wed.
 */
export const BAG_DAY = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturdayOptional: 6,
} as const;

export type BagWeekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export const BAG_FOCUS: Record<
  BagWeekday,
  { dayNumber: number; label: string; theme: string; minutesHint: string }
> = {
  Monday: {
    dayNumber: BAG_DAY.monday,
    label: "Bag — boxing combos",
    theme: "Boxing combinations",
    minutesHint: "Hands-first bag rounds",
  },
  Tuesday: {
    dayNumber: BAG_DAY.tuesday,
    label: "Bag — kicks & teeps",
    theme: "Kicks and teeps",
    minutesHint: "Leg-dominant bag rounds",
  },
  Wednesday: {
    dayNumber: BAG_DAY.wednesday,
    label: "Bag — body shots",
    theme: "Body shots and liver lines",
    minutesHint: "Body-shot bag rounds",
  },
  Thursday: {
    dayNumber: BAG_DAY.thursday,
    label: "Bag — clinch knees",
    theme: "Clinch knees and elbows",
    minutesHint: "Clinch / short-range bag rounds",
  },
  Friday: {
    dayNumber: BAG_DAY.friday,
    label: "Bag — defense & counters",
    theme: "Defense and counters",
    minutesHint: "Slip, cover, and fire back",
  },
  Saturday: {
    dayNumber: BAG_DAY.saturdayOptional,
    label: "Bag — power & speed (optional)",
    theme: "Power and speed",
    minutesHint: "Optional short power bag",
  },
};

/** Round length (seconds of work) by athlete band. Rest between rounds is 60s (45s advanced). */
export const BAG_ROUND_SECONDS: Record<ScaleBand, number> = {
  beginner: 150, // 2:30
  intermediate: 180, // 3:00
  advanced: 180, // 3:00
};

export const BAG_REST_SECONDS: Record<ScaleBand, number> = {
  beginner: 60,
  intermediate: 60,
  advanced: 45,
};

/**
 * Round counts so beginner ~30, intermediate ~35–40, advanced ~45 on Tue/Thu
 * (and optional Sat). Advanced Mon/Wed/Fri use the long count (~60).
 */
export const BAG_ROUND_COUNTS: Record<ScaleBand, number> = {
  beginner: 7,
  intermediate: 8,
  advanced: 10,
};

/** Advanced long bag days (Mon / Wed / Fri) — ~60 min of rounds. */
export const BAG_ROUND_COUNTS_ADVANCED_LONG = 14;

/** Combat-skills day numbers that get the advanced 60-min bag. */
export const ADVANCED_LONG_BAG_DAY_NUMBERS = new Set([1, 3, 5]);

const BAG_WARM_COOL_SECONDS: Record<ScaleBand, number> = {
  beginner: 390, // ~6.5 min shadow + cool
  intermediate: 300,
  advanced: 450,
};

const BAG_WARM_COOL_ADVANCED_LONG = 495; // ~8.25 min so long days land ~60

export function isAdvancedLongBagDay(dayNumber: number) {
  return ADVANCED_LONG_BAG_DAY_NUMBERS.has(dayNumber);
}

export function bagRoundCountFor(band: ScaleBand, dayNumber?: number) {
  if (band === "advanced" && dayNumber != null && isAdvancedLongBagDay(dayNumber)) {
    return BAG_ROUND_COUNTS_ADVANCED_LONG;
  }
  return BAG_ROUND_COUNTS[band];
}

export function bagMinutesForBand(band: ScaleBand, dayNumber?: number) {
  const rounds = bagRoundCountFor(band, dayNumber);
  const work = BAG_ROUND_SECONDS[band] * rounds;
  const rest = BAG_REST_SECONDS[band] * Math.max(0, rounds - 1);
  const warmCool =
    band === "advanced" && dayNumber != null && isAdvancedLongBagDay(dayNumber)
      ? BAG_WARM_COOL_ADVANCED_LONG
      : BAG_WARM_COOL_SECONDS[band];
  return Math.round((work + rest + warmCool) / 60);
}

/** Short label for the level toggle — advanced spans ~45 (Tue/Thu) to ~60 (Mon/Wed/Fri). */
export function bagMinutesHintForBand(band: ScaleBand) {
  if (band === "advanced") return "45–60";
  return String(bagMinutesForBand(band));
}

export function bagRoundLabel(band: ScaleBand, dayNumber?: number) {
  if (band === "advanced" && dayNumber == null) {
    return `${BAG_ROUND_COUNTS.advanced}–${BAG_ROUND_COUNTS_ADVANCED_LONG} rounds × 3:00 · ~45–60 min`;
  }
  const minutes = bagMinutesForBand(band, dayNumber);
  const rounds = bagRoundCountFor(band, dayNumber);
  const work = BAG_ROUND_SECONDS[band];
  const workClock = `${Math.floor(work / 60)}:${String(work % 60).padStart(2, "0")}`;
  return `${rounds} rounds × ${workClock} · ~${minutes} min`;
}
