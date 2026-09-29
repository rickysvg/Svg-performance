import type { LoadUnit } from "@/lib/units";

/** Length follows load units: pounds → inches. (App is lbs-only; cm kept for legacy rows.) */
export function lengthUnitForLoad(unit: LoadUnit): "in" | "cm" {
  return unit === "kg" ? "cm" : "in";
}

export function lengthToCm(value: number, unit: string) {
  return unit === "in" ? value * 2.54 : value;
}
