/**
 * Core plan mesocycle. A block is three calendar weeks, then the next block.
 * Week 0 is week 1 of block A. Weeks 0–2 stay on A; weeks 3–5 are block B.
 * Uses the same Monday week index as bike rotation (`bikeWeekIndex`).
 */
export const MESOCYCLE_WEEKS = 3;

export const MESO_BLOCKS = ["A", "B", "C"] as const;

export type MesoBlock = (typeof MESO_BLOCKS)[number];

export const MESO_BLOCK_META: Record<MesoBlock, { title: string; intent: string }> = {
  A: { title: "Block A", intent: "Jab IQ and range" },
  B: { title: "Block B", intent: "Level changes and entries" },
  C: { title: "Block C", intent: "Traps, flow, and exits" },
};

/**
 * Strength catalog day numbers. Three full-body days plus Friday conditioning.
 * Bikes stay on days 4–9. Fight-pace bike is day 22.
 */
export const STRENGTH_DAY_BY_BLOCK: Record<
  MesoBlock,
  { monday: number; tuesday: number; thursday: number; friday: number }
> = {
  A: { monday: 1, tuesday: 2, thursday: 11, friday: 10 },
  B: { monday: 12, tuesday: 13, thursday: 15, friday: 16 },
  C: { monday: 17, tuesday: 18, thursday: 20, friday: 21 },
};

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

/** Which 3-week block this calendar week belongs to. Not `week % 3`. */
export function mesoBlockIndex(weekIndex: number) {
  return mod(Math.floor(weekIndex / MESOCYCLE_WEEKS), MESOCYCLE_WEEKS);
}

/** 1, 2, or 3 inside the current block. Week 0 is week 1. */
export function weekInBlock(weekIndex: number) {
  return mod(weekIndex, MESOCYCLE_WEEKS) + 1;
}

export function mesoBlockForWeekIndex(weekIndex: number): MesoBlock {
  return MESO_BLOCKS[mesoBlockIndex(weekIndex)] ?? "A";
}

export function mesoBlockLabel(block: MesoBlock) {
  const meta = MESO_BLOCK_META[block];
  return `${meta.title} · ${meta.intent}`;
}

export function strengthDaysForWeek(weekIndex: number) {
  return STRENGTH_DAY_BY_BLOCK[mesoBlockForWeekIndex(weekIndex)];
}

const FRIDAY_CIRCUIT_DAYS = new Set(
  (["A", "B", "C"] as const).map((block) => STRENGTH_DAY_BY_BLOCK[block].friday),
);

/**
 * Member-facing name for the Friday prep block.
 * "Conditioning" is preferred. A day chip is about 48px wide and shares that
 * row with another mark, so the chip draws a bolt instead of this word.
 * "Engine" is the shorter word if a surface has to print the name inside the chip.
 */
export const FRIDAY_CONDITIONING_LABEL = "Conditioning";
export const FRIDAY_CONDITIONING_CHIP_WORD = "Engine";

/** Friday conditioning days. The member-facing title is "Conditioning". */
export function isGppStrengthDay(dayNumber: number) {
  return FRIDAY_CIRCUIT_DAYS.has(dayNumber);
}

/** Plyo add-on days are off. Power work is already inside the three lift days. */
export function isPlyoStrengthDay(_dayNumber: number) {
  return false;
}
