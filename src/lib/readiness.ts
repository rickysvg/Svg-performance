/**
 * Daily readiness is SVG's own 1–5 check.
 * Joel Jamieson discusses readiness / HRV. Andy Galpin discusses sleep.
 * This screen does not change the written plan.
 */

export const READINESS_CREDITS = [
  {
    coach: "Joel Jamieson",
    url: "https://8weeksout.com/2012/09/27/metabolic-conditioning-mma/",
    idea: "readiness before hard conditioning",
  },
  {
    coach: "Andy Galpin",
    url: "https://www.andygalpin.com/about",
    idea: "sleep and recovery",
  },
] as const;

export type ReadinessScores = {
  sleep: number;
  soreness: number;
  energy: number;
};

export function readinessAverage(scores: ReadinessScores) {
  return (scores.sleep + scores.soreness + scores.energy) / 3;
}

/** 1 is low (poor sleep, very sore, drained). 5 is ready. */
export function readinessIsLow(scores: ReadinessScores) {
  const values = [scores.sleep, scores.soreness, scores.energy];
  if (values.some((value) => value <= 2)) return true;
  return readinessAverage(scores) <= 2.5;
}

export function readinessSuggestion(scores: ReadinessScores): string | null {
  if (!readinessIsLow(scores)) return null;
  return "Today looks low. SVG suggests going lighter — Aerobic Base on the bike, or a mobility routine. Your written plan stays as it is until you choose to change it.";
}

export function isReadinessScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
