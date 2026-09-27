export const FORM_CHECK_MONTHLY_LIMIT = 2;
export const FORM_CHECK_MAX_BYTES = 24 * 1024 * 1024;
export const FORM_CHECK_MAX_SECONDS = 60;
export const FORM_CHECK_TURNAROUND = "Expect feedback within 2–3 days.";
export const FORM_CHECK_SIGNATURE = "SVG Coach";

export const FORM_CHECK_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type FormCheckMime = (typeof FORM_CHECK_TYPES)[number];

export const FORM_CHECK_MOVEMENTS = [
  { id: "trap-bar-deadlift", label: "Trap bar deadlift" },
  { id: "goblet-squat", label: "Goblet squat" },
  { id: "romanian-deadlift", label: "Romanian deadlift" },
  { id: "overhead-press", label: "Overhead press" },
  { id: "bench-or-pushup", label: "Bench press or push-up" },
  { id: "one-arm-row", label: "One-arm row" },
  { id: "kettlebell-swing", label: "Kettlebell swing" },
  { id: "front-plank", label: "Front plank" },
  { id: "jab-cross", label: "Jab–cross" },
  { id: "bag-combo", label: "Bag combo: jab–cross–hook–cross" },
  { id: "pad-combo", label: "Pad combo: 1-2-3" },
  { id: "lead-hook", label: "Lead hook" },
  { id: "low-kick", label: "Low kick" },
  { id: "teep", label: "Teep" },
  { id: "double-leg", label: "Double-leg entry" },
  { id: "sprawl", label: "Sprawl" },
  { id: "hip-escape", label: "Hip escape (shrimp)" },
  { id: "other", label: "Other" },
] as const;

export type FormCheckMovementId = (typeof FORM_CHECK_MOVEMENTS)[number]["id"];

export const FORM_CHECK_STATUS_LABEL = {
  submitted: "Submitted",
  in_review: "In review",
  reviewed: "Reviewed",
} as const;

export type FormCheckStatus = keyof typeof FORM_CHECK_STATUS_LABEL;
