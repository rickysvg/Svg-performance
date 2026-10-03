import { bikeIntervalReps, bikeSessionForName, isBikeIntervalName } from "@/lib/bike-sessions";
import { percentFromLoadText, rirFromLoadText } from "@/lib/rir";

export const LOG_MODES = ["load_reps", "load_timed", "reps_only", "timed", "timed_round"] as const;

export type LogMode = (typeof LOG_MODES)[number];

const HOLD_NAME =
  /\b(plank|wall sit|hollow hold|dead hang|l-sit|lsit|static hold|isometric|burst|hold)\b/i;
const SHADOW_NAME = /\bshadow(?:\s*-?\s*box(?:ing)?)?\b|\bshadowbox(?:ing)?\b/i;
const WEIGHTED_SHADOW_LOAD = /\b(weighted|weights?|hand[\s-]*weights?)\b/i;
const CARDIO_TIMED_NAME =
  /\b(jump rope|easy bike|interval|burpee|mountain climber|jumping jack|shadowbox|shadow box|high knee|butt kick|mobility|stretch|yoga|jumping|sled|front-rack march|front rack march|banded kettlebell swing)\b/i;
const ROUND_NAME =
  /\b(bag|pads|sparring|grappling|rolling|jab|cross|hook|teep|kick|clinch|knee|sprawl|shot|guard|shrimp|mount|ground-and-pound|g&p|level change|double-leg|frame|boxing)\b/i;
const BODYWEIGHT_COUNT_NAME =
  /\b(chin-up|pull-up|push-up|air squat|sit-up|crunch|lateral bound|side step-over|box step-up|squat jump|broad jump|pike|band pull-apart|face pull|\bdip\b)\b/i;
const LOADED_CARRY_NAME =
  /\b(farmer|suitcase carry|overhead carry|rack carry|waiter carry|yoke|\bcarry\b|weighted hold|loaded hold)\b/i;
const WEIGHTED_LIFT_NAME =
  /\b(goblet|deadlift|rdl|romanian|bench press|overhead press|floor press|one-arm row|\brow\b|kettlebell|dumbbell|barbell|hip hinge|\blunge\b|landmine|cable|pulldown|machine|\bcurl\b|thruster|clean|snatch|jerk|good morning|shrug|split squat|med-?ball|medicine ball)\b/i;
const LOADED_OPTION_NAME = /\b(dumbbell|barbell|kettlebell|bench press|bar )\b/i;

export function isLogMode(value: string | null | undefined): value is LogMode {
  return LOG_MODES.includes(value as LogMode);
}

export function isHoldName(name: string) {
  return HOLD_NAME.test(name);
}

export function isShadowName(name: string) {
  return SHADOW_NAME.test(name);
}

/** "weighted shadow", "shadowbox with weights", "shadowbox round 2 — hand weights". */
export function isWeightedShadowName(name: string) {
  return isShadowName(name) && WEIGHTED_SHADOW_LOAD.test(name);
}

export function isEmptyShadowRound(name: string) {
  return isShadowName(name) && !isWeightedShadowName(name) && !/\bcool/i.test(name);
}

/**
 * Ricky’s rule: only weighted lifts get reps + lbs.
 * Everything else is timed, a skill round, or reps with no load column.
 */
export function fallbackLogMode(name: string, reps = ""): LogMode {
  if (isBikeIntervalName(name)) return "timed_round";
  if (isWeightedShadowName(name)) return "load_timed";
  if (LOADED_CARRY_NAME.test(name)) return "load_timed";
  if (/\bbanded kettlebell swing\b/i.test(name)) return "timed";
  if (isHoldName(name)) return "timed";
  if (CARDIO_TIMED_NAME.test(name)) return "timed";
  if (ROUND_NAME.test(name)) return "timed_round";
  if (BODYWEIGHT_COUNT_NAME.test(name) && !LOADED_OPTION_NAME.test(name)) {
    return "reps_only";
  }
  if (WEIGHTED_LIFT_NAME.test(name)) return "load_reps";
  if (/\bsec\b/i.test(reps) || /^\s*\d+\s*:\s*\d{1,2}/.test(reps)) return "timed";
  return "timed";
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
  return mode === "timed" || mode === "timed_round" || mode === "load_timed";
}

export function hidesLoad(mode: LogMode) {
  return mode !== "load_reps" && mode !== "load_timed";
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
  if (/\bmin(ute)?s?\b/i.test(raw) || (n <= 10 && /round/i.test(raw))) {
    return n * 60;
  }
  return n;
}

export function modeColumnLabel(mode: LogMode) {
  if (mode === "timed_round") return "Round";
  if (mode === "timed" || mode === "load_timed") return "Sec";
  return "Reps";
}

export function modeHint(mode: LogMode, name?: string) {
  if (name && isBikeIntervalName(name)) {
    const session = bikeSessionForName(name);
    if (session && session.restSeconds <= 0 && session.roundsPerSet === 1) {
      return "Start the work-block timer. Mark Done when the clock ends. Timed only — no lbs or reps.";
    }
    if (session && session.restBetweenSetsSeconds <= 0) {
      return "Start the interval timer. Mark Done when the last round ends. Timed only — no lbs or reps.";
    }
    const between = session?.restBetweenSetsSeconds ?? 60;
    return `Mark Done after each round. Rest ${between}s starts automatically. No lbs or reps.`;
  }
  if (mode === "timed_round") {
    return "Log the round time. Rest between rounds is the pill above — not pounds.";
  }
  if (mode === "load_timed") {
    if (name && isWeightedShadowName(name)) {
      return "Log the round in seconds and the hand-weight lbs. Empty-hand shadow stays timed.";
    }
    return "Log seconds and lbs. Loaded carry / hold — no reps.";
  }
  if (mode === "timed") {
    return "Log the work time in seconds. Not a weight lift — no lbs.";
  }
  if (mode === "reps_only") {
    return "Bodyweight — log reps only. No lbs.";
  }
  return "";
}

function carryDurationLabel(reps: string) {
  const raw = reps.trim();
  if (!raw) return "40s";
  return raw.replace(/\s*seconds?\b/i, "s").replace(/\s*sec\b/i, "s").replace(/\s+/g, " ").trim();
}

/** "1–3 lb hand weights" → "1–3". Empty when the prescription has no logged or written weight. */
export function prescribedLbLabel(loadText?: string | null): string | null {
  const match = loadText?.match(/(\d+(?:\s*[–—-]\s*\d+)?(?:\.\d+)?)\s*lb\b/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, "");
}

export type LoggerRowLayout = "bag" | "weighted_shadow" | "bike" | "standard";

/** Gym-floor rows: bag is Round / time / Done, weighted shadow is Seconds / lbs / Done. */
export function loggerRowLayout(mode: LogMode, name = ""): LoggerRowLayout {
  if (isBikeIntervalName(name)) return "bike";
  if (mode === "load_timed" && isWeightedShadowName(name)) return "weighted_shadow";
  if (mode === "timed_round") return "bag";
  return "standard";
}

export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isSingleClockBlock(reps: string) {
  return /^\s*\d+\s*:\s*\d{2}\s*$/.test(reps);
}

export function plannedSetLine(input: {
  sets: number;
  reps: string;
  restSeconds: number;
  logMode?: string | null;
  name?: string;
  loadText?: string | null;
}) {
  const mode = resolveLogMode(input);
  if (isBikeIntervalName(input.name ?? "")) {
    const reps = input.reps || bikeIntervalReps();
    const between = input.restSeconds > 0 ? `, ${input.restSeconds}s between rounds` : "";
    return `${countLabel(input.sets, "round")} · ${reps}${between}`;
  }
  const rest = input.restSeconds > 0 ? `, ${input.restSeconds}s rest` : "";
  const rir = rirFromLoadText(input.loadText);
  const percent = percentFromLoadText(input.loadText);
  const effort = rir ? ` @ ${rir}${percent ? ` (${percent})` : ""}` : "";
  const restOut = rir
    ? input.restSeconds > 0
      ? `, ${input.restSeconds}s rest between sets`
      : ""
    : rest;
  if (mode === "timed_round") {
    return `${countLabel(input.sets, "round")} × ${input.reps}${rest}`;
  }
  if (mode === "load_timed") {
    if (rir) return `${input.sets} × ${carryDurationLabel(input.reps)}${effort}${restOut}`;
    const pounds = prescribedLbLabel(input.loadText);
    const load = pounds ? ` @ ${pounds} lb` : "";
    return `${input.sets} × ${carryDurationLabel(input.reps)}${load}${rest}`;
  }
  if (mode === "timed") {
    if (!rir && input.sets === 1 && input.restSeconds <= 0 && isSingleClockBlock(input.reps)) {
      return `${input.reps.trim()} continuous`;
    }
    const unit = isHoldName(input.name ?? "")
      ? countLabel(input.sets, "hold")
      : countLabel(input.sets, "set");
    return `${unit} × ${input.reps}${effort}${restOut}`;
  }
  return `${countLabel(input.sets, "set")} × ${input.reps}${effort}${restOut}`;
}

/**
 * Logger card subtitle: sets and the prescribed work only.
 * RIR stays on the set and in the How heavy explainer. It is not printed here.
 */
export function loggerCardLine(input: {
  sets: number;
  reps: string;
  restSeconds?: number;
  logMode?: string | null;
  name?: string;
}) {
  const mode = resolveLogMode(input);
  const name = input.name ?? "";
  if (isBikeIntervalName(name)) {
    const reps = input.reps || bikeIntervalReps();
    return `${countLabel(input.sets, "round")} · ${reps}`;
  }
  if (mode === "timed_round") {
    return `${countLabel(input.sets, "round")} × ${input.reps}`;
  }
  if (mode === "load_timed") {
    return `${input.sets} × ${carryDurationLabel(input.reps)}`;
  }
  if (mode === "timed") {
    if (input.sets === 1 && (input.restSeconds ?? 0) <= 0 && isSingleClockBlock(input.reps)) {
      return `${input.reps.trim()} continuous`;
    }
    const unit = isHoldName(name) ? countLabel(input.sets, "hold") : countLabel(input.sets, "set");
    return `${unit} × ${input.reps}`;
  }
  return `${countLabel(input.sets, "set")} × ${input.reps}`;
}
