export type LoadUnit = "lb" | "kg";

/** App standard: collect and display weight in pounds. */
export const APP_LOAD_UNIT: LoadUnit = "lb";

const LB_PER_KG = 2.2046226218;

export function isLoadUnit(value: string): value is LoadUnit {
  return value === "lb" || value === "kg";
}

export function toKg(value: number, unit: LoadUnit): number {
  return unit === "kg" ? value : value / LB_PER_KG;
}

export function fromKg(kg: number, unit: LoadUnit): number {
  return unit === "kg" ? kg : kg * LB_PER_KG;
}

export function convertLoad(
  value: number,
  from: LoadUnit,
  to: LoadUnit,
): number {
  if (from === to) {
    return value;
  }
  return fromKg(toKg(value, from), to);
}

/** Whole pounds for body weight / fight weight (×2.20462). */
export function kgToWholeLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}

/** Coerce a stored body-weight number into whole lbs when the profile was kg. */
export function bodyWeightInLb(value: number | null, storedUnit: string): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (storedUnit === "kg") return kgToWholeLb(value);
  return Math.round(value * 10) / 10;
}

/**
 * Normalize free-text weight class copy so kg / kilo mentions become lbs.
 * Example: "77 kg class" → "170 lb class".
 */
export function normalizeWeightClassLabel(value: string): string {
  return value
    .replace(/(\d+(?:\.\d+)?)\s*kgs?\b/gi, (_, n: string) => `${kgToWholeLb(Number(n))} lb`)
    .replace(/\bkilograms?\b/gi, "lb")
    .replace(/\bkilos?\b/gi, "lb");
}

export function formatLoad(value: number, unit: LoadUnit): string {
  const inLb = unit === "kg" ? convertLoad(value, "kg", "lb") : value;
  const rounded = Math.round(inLb * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} lb`;
}

export function volumeInUnit(
  reps: number | null,
  loadValue: number | null,
  loadUnit: string,
  displayUnit: LoadUnit,
): number {
  if (reps == null || loadValue == null || !isLoadUnit(loadUnit)) {
    return 0;
  }
  return reps * convertLoad(loadValue, loadUnit, displayUnit);
}

/** Round a load for logger editing after unit conversion. */
export function roundLoadForInput(value: number): number {
  return Math.round(value * 10) / 10;
}
