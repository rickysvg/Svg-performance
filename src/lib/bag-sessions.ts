import type { ScaleBand } from "@/lib/bike-sessions";
import {
  BAG_THEMES,
  type BagWeekdayName,
} from "@/lib/bag-themes";
import type { MesoBlock } from "@/lib/mesocycle";

export {
  BAG_THEME_CREDIT,
  BAG_THEMES,
  SHADOW_COOL_NAME,
  SHADOW_EMPTY_NAME,
  SHADOW_WEIGHTED_NAME,
  formatBagRoundNotes,
} from "@/lib/bag-themes";

/**
 * Bag day numbers in demo-combat-skills.
 * Block A is days 1–6, Block B 7–12, Block C 13–18.
 * Each weekday inside a block has its own theme so Mon ≠ Wed.
 */
export const BAG_DAY = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturdayOptional: 6,
} as const;

export type BagWeekday = BagWeekdayName;

const WEEKDAY_OFFSET: Record<BagWeekday, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
};

const BLOCK_BASE: Record<MesoBlock, number> = { A: 1, B: 7, C: 13 };

export function bagDayNumber(weekday: BagWeekday, block: MesoBlock = "A") {
  return BLOCK_BASE[block] + WEEKDAY_OFFSET[weekday];
}

export function bagFocusFor(weekday: BagWeekday, block: MesoBlock = "A") {
  const theme = BAG_THEMES[block][weekday];
  return {
    ...theme,
    block,
    dayNumber: bagDayNumber(weekday, block),
  };
}

/** Block A labels. Week index 0. Later blocks use `bagFocusFor`. */
export const BAG_FOCUS: Record<
  BagWeekday,
  { dayNumber: number; label: string; theme: string; minutesHint: string }
> = {
  Monday: {
    dayNumber: bagDayNumber("Monday", "A"),
    label: BAG_THEMES.A.Monday.label,
    theme: BAG_THEMES.A.Monday.theme,
    minutesHint: BAG_THEMES.A.Monday.minutesHint,
  },
  Tuesday: {
    dayNumber: bagDayNumber("Tuesday", "A"),
    label: BAG_THEMES.A.Tuesday.label,
    theme: BAG_THEMES.A.Tuesday.theme,
    minutesHint: BAG_THEMES.A.Tuesday.minutesHint,
  },
  Wednesday: {
    dayNumber: bagDayNumber("Wednesday", "A"),
    label: BAG_THEMES.A.Wednesday.label,
    theme: BAG_THEMES.A.Wednesday.theme,
    minutesHint: BAG_THEMES.A.Wednesday.minutesHint,
  },
  Thursday: {
    dayNumber: bagDayNumber("Thursday", "A"),
    label: BAG_THEMES.A.Thursday.label,
    theme: BAG_THEMES.A.Thursday.theme,
    minutesHint: BAG_THEMES.A.Thursday.minutesHint,
  },
  Friday: {
    dayNumber: bagDayNumber("Friday", "A"),
    label: BAG_THEMES.A.Friday.label,
    theme: BAG_THEMES.A.Friday.theme,
    minutesHint: BAG_THEMES.A.Friday.minutesHint,
  },
  Saturday: {
    dayNumber: bagDayNumber("Saturday", "A"),
    label: BAG_THEMES.A.Saturday.label,
    theme: BAG_THEMES.A.Saturday.theme,
    minutesHint: BAG_THEMES.A.Saturday.minutesHint,
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

/** Combat-skills day numbers that get the advanced 60-min bag (Mon/Wed/Fri, every block). */
export const ADVANCED_LONG_BAG_DAY_NUMBERS = new Set<number>(
  (["A", "B", "C"] as const).flatMap((block) =>
    (["Monday", "Wednesday", "Friday"] as const).map((weekday) => bagDayNumber(weekday, block)),
  ),
);

/** Optional Saturday bag days. */
export const OPTIONAL_BAG_DAY_NUMBERS = new Set<number>(
  (["A", "B", "C"] as const).map((block) => bagDayNumber("Saturday", block)),
);

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
