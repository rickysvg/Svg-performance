export type LoadUnit = "lb" | "kg";

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

export function formatLoad(value: number, unit: LoadUnit): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
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
