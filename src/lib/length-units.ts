import type { LoadUnit } from "@/lib/units";

/** Length follows the athlete: pounds users see inches, kilogram users see centimeters. */
export function lengthUnitForLoad(unit: LoadUnit): "in" | "cm" {
  return unit === "kg" ? "cm" : "in";
}

export function lengthToCm(value: number, unit: string) {
  return unit === "in" ? value * 2.54 : value;
}
