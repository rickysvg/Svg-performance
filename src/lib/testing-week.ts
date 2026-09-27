import type { LoadUnit } from "@/lib/units";
import { convertLoad } from "@/lib/units";

export const TESTING_CREDITS = [
  {
    coach: "UFC Performance Institute",
    url: "https://www.ufcpi.com/",
    idea: "test, train, then retest",
  },
  {
    coach: "Joel Jamieson",
    url: "https://8weeksout.com/2012/09/27/metabolic-conditioning-mma/",
    idea: "assess before you copy someone else's conditioning",
  },
] as const;

export const STRENGTH_TEST_LIFTS = ["Trap-bar deadlift", "Squat"] as const;

/** Epley estimate from a hard set of 2–8. A single is the load itself. */
export function estimatedStrength(load: number, reps: number) {
  if (!Number.isFinite(load) || !Number.isFinite(reps) || load <= 0 || reps <= 0) return null;
  if (reps === 1) return Math.round(load * 10) / 10;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export function testingDelta(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.round((current - previous) * 10) / 10;
}

export function formatDelta(delta: number | null, unit = "") {
  if (delta == null) return "—";
  const sign = delta > 0 ? "+" : "";
  const rounded = Number.isInteger(delta) ? String(delta) : delta.toFixed(1);
  return `${sign}${rounded}${unit ? ` ${unit}` : ""}`;
}

export function strengthToLb(value: number, unit: LoadUnit) {
  return convertLoad(value, unit, "lb");
}

export function lengthToCm(value: number, unit: string) {
  if (unit === "in") return value * 2.54;
  return value;
}
