/**
 * Dynamic prep before training. Static holds stay in the cooldown routine.
 * Thomas Kurz: no static stretching before explosive work.
 * Jonathan Chaimberg and Martin Rooney: a standard dynamic warm-up.
 */

export const WARMUP_CREDITS = [
  {
    coach: "Thomas Kurz",
    url: "https://www.usadojo.com/5-stretch-yourself-right-stretches-for-high-kicks/",
    idea: "dynamic leg work before kicking or lifting",
  },
  {
    coach: "Jonathan Chaimberg",
    url: "https://www.grapplearts.com/gsps-original-mma-conditioning-coach-jon-chaimberg/",
    idea: "a dynamic warm-up every session",
  },
  {
    coach: "Martin Rooney",
    url: "https://trainingforwarriors.com/our-history/",
    idea: "one standard warm-up template",
  },
] as const;

export const DAILY_WARMUP_ID = "daily-warmup";
export const COOLDOWN_ID = "cooldown";
