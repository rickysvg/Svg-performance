import type { ScaleBand } from "@/lib/bike-sessions";
import {
  BAG_INSPIRED_BY,
  BAG_THEMES,
  bagCreditLine,
  type BagWeekdayName,
} from "@/lib/bag-themes";
import type { MesoBlock } from "@/lib/mesocycle";

export {
  BAG_CREDIT_SUFFIX,
  BAG_INSPIRED_BY,
  BAG_THEME_CREDIT,
  BAG_THEMES,
  SHADOW_COOL_NAME,
  SHADOW_EMPTY_NAME,
  SHADOW_WEIGHTED_NAME,
  bagCreditLine,
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
  const inspiredBy = BAG_INSPIRED_BY[block][weekday];
  return {
    ...theme,
    block,
    inspiredBy,
    credit: bagCreditLine(inspiredBy),
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

/**
 * Round length so warm-up + themed rounds + cooldown land in 30–45 minutes.
 * Beginner rounds are shorter. Nobody gets a 60-minute bag.
 */
export const BAG_ROUND_SECONDS: Record<ScaleBand, number> = {
  beginner: 150, // 2:30
  intermediate: 180, // 3:00
  advanced: 180, // 3:00
};

export const BAG_REST_SECONDS: Record<ScaleBand, number> = {
  beginner: 45,
  intermediate: 60,
  advanced: 30,
};

/** Themed bag rounds only. Warm-up and cooldown sit around this block. */
export const BAG_ROUND_COUNTS: Record<ScaleBand, number> = {
  beginner: 7,
  intermediate: 7,
  advanced: 8,
};

/** Kept so older imports compile. Every bag day now uses the 30–45 minute count. */
export const BAG_ROUND_COUNTS_ADVANCED_LONG = BAG_ROUND_COUNTS.advanced;

/** No day is a long bag anymore. */
export const ADVANCED_LONG_BAG_DAY_NUMBERS = new Set<number>();

/** Optional Saturday bag days. */
export const OPTIONAL_BAG_DAY_NUMBERS = new Set<number>(
  (["A", "B", "C"] as const).map((block) => bagDayNumber("Saturday", block)),
);

const TRANSITION_SECONDS = 30;

/** Matches the day-page clock: work + rest on every set, plus a short transition. */
function blockSeconds(sets: number, workSeconds: number, restSeconds: number) {
  return sets * (workSeconds + restSeconds) + TRANSITION_SECONDS;
}

export function isAdvancedLongBagDay(dayNumber?: number) {
  return dayNumber != null && ADVANCED_LONG_BAG_DAY_NUMBERS.has(dayNumber);
}

export function bagRoundCountFor(band: ScaleBand, dayNumber?: number) {
  if (isAdvancedLongBagDay(dayNumber)) return BAG_ROUND_COUNTS_ADVANCED_LONG;
  return BAG_ROUND_COUNTS[band];
}

/**
 * Warm-up (empty shadow, weighted shadow, one technique round) + themed rounds + cooldown.
 * Same total for every weekday. Lands between 30 and 45 minutes.
 */
export function bagMinutesForBand(band: ScaleBand, dayNumber?: number) {
  const roundSeconds = BAG_ROUND_SECONDS[band];
  const rest = BAG_REST_SECONDS[band];
  const shadowWork = band === "beginner" ? 120 : 180;
  const weightedRest = band === "advanced" ? 30 : 45;
  const rounds = bagRoundCountFor(band, dayNumber);
  const seconds =
    blockSeconds(1, shadowWork, 30) +
    blockSeconds(1, shadowWork, weightedRest) +
    blockSeconds(1, roundSeconds, rest) +
    blockSeconds(rounds, roundSeconds, rest) +
    blockSeconds(1, 120, 0);
  return Math.round(seconds / 60);
}

/** Short label for the level toggle. Every bag day is in this range. */
export function bagMinutesHintForBand(band: ScaleBand) {
  return String(bagMinutesForBand(band));
}

export function bagRoundLabel(band: ScaleBand, dayNumber?: number) {
  const minutes = bagMinutesForBand(band, dayNumber);
  const rounds = bagRoundCountFor(band, dayNumber);
  const work = BAG_ROUND_SECONDS[band];
  const workClock = `${Math.floor(work / 60)}:${String(work % 60).padStart(2, "0")}`;
  return `${rounds} rounds × ${workClock} · ~${minutes} min`;
}
