/**
 * Core plan mesocycle. Three calendar weeks, then it repeats.
 * Uses the same Monday week index as bike rotation and deload weeks
 * (`bikeWeekIndex` in bike-sessions.ts), so one week is one block.
 */
export const MESOCYCLE_WEEKS = 3;

export const MESO_BLOCKS = ["A", "B", "C"] as const;

export type MesoBlock = (typeof MESO_BLOCKS)[number];

export const MESO_BLOCK_META: Record<MesoBlock, { title: string; intent: string }> = {
  A: { title: "Block A", intent: "Jab IQ and range" },
  B: { title: "Block B", intent: "Level changes and entries" },
  C: { title: "Block C", intent: "Traps, flow, and exits" },
};

/** Strength catalog day numbers. Bikes stay on days 4–9 in every block. */
export const STRENGTH_DAY_BY_BLOCK: Record<
  MesoBlock,
  { monday: number; tuesday: number; wednesday: number; thursday: number; friday: number }
> = {
  A: { monday: 1, tuesday: 2, wednesday: 3, thursday: 11, friday: 10 },
  B: { monday: 12, tuesday: 13, wednesday: 14, thursday: 15, friday: 16 },
  C: { monday: 17, tuesday: 18, wednesday: 19, thursday: 20, friday: 21 },
};

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

export function mesoBlockIndex(weekIndex: number) {
  return mod(weekIndex, MESOCYCLE_WEEKS);
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

export function isGppStrengthDay(dayNumber: number) {
  return Object.values(STRENGTH_DAY_BY_BLOCK).some((row) => row.friday === dayNumber);
}

/** Mon / Wed / Thu lift days get the short plyo add-on. */
export function isPlyoStrengthDay(dayNumber: number) {
  return Object.values(STRENGTH_DAY_BY_BLOCK).some(
    (row) =>
      row.monday === dayNumber || row.wednesday === dayNumber || row.thursday === dayNumber,
  );
}
