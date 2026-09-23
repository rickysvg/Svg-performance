export const LOG_MODES = ["load_reps", "reps_only", "timed", "timed_round"] as const;

export type LogMode = (typeof LOG_MODES)[number];

const HOLD_NAME =
  /\b(plank|wall sit|hollow hold|dead hang|l-sit|lsit|static hold|isometric|burst|hold)\b/i;
const INTERVAL_NAME = /\b(jump rope|easy bike|interval)\b/i;
const REPS_ONLY_NAME =
  /\b(squat jump|box step-up|lateral bound|side step-over|chin-up|push-up)\b/i;
const ROUND_NAME =
  /\b(bag|pads|jab|cross|hook|teep|kick|clinch|knee|sprawl|shot|guard|shrimp|mount|ground-and-pound|g&p|level change|double-leg|frame)\b/i;

export function isLogMode(value: string | null | undefined): value is LogMode {
  return LOG_MODES.includes(value as LogMode);
}

export function fallbackLogMode(name: string, reps = ""): LogMode {
  if (HOLD_NAME.test(name)) return "timed";
  if (INTERVAL_NAME.test(name)) return "timed";
  if (/\bsec\b/i.test(reps) && !ROUND_NAME.test(name)) return "timed";
  if (ROUND_NAME.test(name)) return "timed_round";
  if (REPS_ONLY_NAME.test(name)) return "reps_only";
  return "load_reps";
}

/** Stored field wins; name / reps heuristics cover old seed rows. */
export function resolveLogMode(input: {
  logMode?: string | null;
  name?: string;
  reps?: string;
}): LogMode {
  if (isLogMode(input.logMode)) return input.logMode;
  return fallbackLogMode(input.name ?? "", input.reps ?? "");
}

export function isDurationMode(mode: LogMode) {
  return mode === "timed" || mode === "timed_round";
}

export function hidesLoad(mode: LogMode) {
  return mode !== "load_reps";
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "3:00", "2:30", "45", "30–45 sec", "20 sec on / 40 sec easy" → seconds. */
export function parseDurationSeconds(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.round(value) : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const clock = raw.match(/(\d+)\s*:\s*(\d{1,2})/);
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }
  const first = raw.match(/(\d+)/);
  if (!first) return null;
  const n = Number(first[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/\bmin(ute)?s?\b/i.test(raw) || n <= 10 && /round/i.test(raw)) {
    return n * 60;
  }
  return n;
}

export function modeColumnLabel(mode: LogMode) {
  if (mode === "timed_round") return "Round";
  if (mode === "timed") return "Hold";
  return "Reps";
}

export function modeHint(mode: LogMode) {
  if (mode === "timed_round") {
    return "Log the round time. Rest between rounds is the pill above — not pounds.";
  }
  if (mode === "timed") {
    return "Log the hold time in seconds. This is not a weight lift.";
  }
  if (mode === "reps_only") {
    return "Bodyweight — log reps only.";
  }
  return "";
}

export function plannedSetLine(input: {
  sets: number;
  reps: string;
  restSeconds: number;
  logMode?: string | null;
  name?: string;
}) {
  const mode = resolveLogMode(input);
  const rest = input.restSeconds > 0 ? `, ${input.restSeconds}s rest` : "";
  if (mode === "timed_round") {
    return `${input.sets} rounds × ${input.reps}${rest}`;
  }
  if (mode === "timed") {
    return `${input.sets} holds × ${input.reps}${rest}`;
  }
  return `${input.sets} sets × ${input.reps}${rest}`;
}
