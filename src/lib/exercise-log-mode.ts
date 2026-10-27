import { bikeIntervalReps, bikeSessionForName, isBikeIntervalName, parseBikeIntervalReps } from "@/lib/bike-sessions";
import { formatIntervalDisplay } from "@/lib/interval-shorthand";
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
  /\b(chin-up|pull-up|push-up|air squat|sit-up|crunch|lateral bound|side step-over|box step-up|squat jump|broad jump|pike|\bdip\b)\b/i;
/**
 * Bodyweight patterns the lift regex would otherwise treat as loaded
 * (sissy squat, curl-up, a band-assisted pull-up).
 */
const UNLOADED_BODYWEIGHT_EXCEPTION =
  /\b(sissy squat|stability-ball leg curl|stability ball leg curl|reverse nordic|mcgill curl-up|plyo bulgarian|band-assisted pull-up|assisted pull-up|assisted chin-up)\b/i;
/** Gym staples whose names omit “dumbbell” or “cable” but still track a load. */
const LOADED_STAPLE_NAME =
  /\b(pushdowns?|triceps extensions?|skull crushers?|leg[-\s]?press|calf raises?|hip thrusts?|woodchops?|pallof|pec-?deck|arnold|block pulls?|step-?ups?|wall balls?|devil press|man makers?|harness|medicine[-\s]?balls?)\b/i;
/** Conditioning pieces logged in seconds, even when the name says “row” or “machine”. */
const TIMED_IMPLEMENT_NAME = /\b(sleds?|prowlers?|rowing machines?|rowing ergs?|rowers?)\b/i;
/** Bands, cables, dumbbells, and the pulls/presses that use them. Pounds stay on. */
const LOADED_GEAR_NAME =
  /\b(bands?|banded|cables?|dumbbells?|barbells?|kettlebells?|pulldowns?|pull-?aparts?|face pulls?|machines?|landmines?|trap-?bars?|med-?balls?|medicine[-\s]?balls?|ez-?bars?|smith|plates?)\b/i;
const DURATION_REPS =
  /\b(sec|secs|seconds?|min|mins|minutes?)\b|\d+\s*:\s*\d|\d+\s*s(?:ec(?:ond)?s?)?\b/i;
const DISTANCE_REPS = /\b(meters?|metres?|yards?)\b|\d+\s*m\b|\d+\s*yd\b/i;
const LOADED_CARRY_NAME =
  /\b(farmer|suitcase carry|overhead carry|rack carry|waiter carry|yoke|\bcarry\b|weighted hold|loaded hold)\b/i;
const WEIGHTED_LIFT_NAME =
  /\b(goblet|deadlift|rdl|romanian|bench press|overhead press|push press|floor press|one-arm row|\brow\b|kettlebell|dumbbell|barbell|hip hinge|\blunge\b|landmine|cable|pulldown|machine|\bcurl\b|thruster|clean|snatch|jerk|good morning|shrug|split squat|zercher|sandbag|\bsquat\b|med-?ball|medicine ball)\b/i;
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

/** "6", "6 / side", "8–12", "× 6". Clocks, seconds, and meter carries are not reps. */
export function prescriptionIsRepCount(reps: string) {
  const raw = reps.trim();
  if (!raw) return false;
  if (DURATION_REPS.test(raw) || DISTANCE_REPS.test(raw)) return false;
  return /\d/.test(raw);
}

function loadedMovementName(name: string) {
  return (
    LOADED_GEAR_NAME.test(name) ||
    LOADED_CARRY_NAME.test(name) ||
    WEIGHTED_LIFT_NAME.test(name) ||
    LOADED_STAPLE_NAME.test(name) ||
    /\bweighted\b/i.test(name)
  );
}

/** Air squat, push-up, chin-up, and the named bodyweight exceptions. Gear in the name keeps the load. */
function unloadedRepName(name: string) {
  if (UNLOADED_BODYWEIGHT_EXCEPTION.test(name)) return true;
  if (!BODYWEIGHT_COUNT_NAME.test(name)) return false;
  if (LOADED_OPTION_NAME.test(name) || LOADED_GEAR_NAME.test(name) || /\bweighted\b/i.test(name)) return false;
  return true;
}

function tracksLoad(name: string) {
  if (unloadedRepName(name)) return false;
  return loadedMovementName(name);
}

/**
 * Pounds on lifts and loaded accessories (bands, cables, dumbbells, pulls, presses).
 * A written “bodyweight” or “no lbs” line does not remove that column.
 * True timed braces and unloaded jumps stay without a fake weight.
 */
export function fallbackLogMode(name: string, reps = ""): LogMode {
  if (isBikeIntervalName(name)) return "timed_round";
  if (isWeightedShadowName(name)) return "load_timed";
  if (TIMED_IMPLEMENT_NAME.test(name)) return "timed";
  if (LOADED_CARRY_NAME.test(name)) {
    return prescriptionIsRepCount(reps) ? "load_reps" : "load_timed";
  }
  // A written rep count logs reps even when the name looks like a hold or a flow.
  // Unloaded patterns (air squat, push-up) stay reps-only ahead of the squat/curl regex.
  if (prescriptionIsRepCount(reps)) {
    return tracksLoad(name) ? "load_reps" : "reps_only";
  }
  if (/\bbanded kettlebell swing\b/i.test(name)) return "timed";
  if (isHoldName(name) && tracksLoad(name)) return "load_timed";
  if (isHoldName(name)) return "timed";
  if (ROUND_NAME.test(name)) return "timed_round";
  if (DURATION_REPS.test(reps)) return tracksLoad(name) ? "load_timed" : "timed";
  if (CARDIO_TIMED_NAME.test(name)) return "timed";
  if (LOADED_GEAR_NAME.test(name)) return "load_reps";
  if (BODYWEIGHT_COUNT_NAME.test(name) && !LOADED_OPTION_NAME.test(name)) {
    return "reps_only";
  }
  if (WEIGHTED_LIFT_NAME.test(name)) return "load_reps";
  return "timed";
}

/**
 * Stored mode wins, except a stale `reps_only` on loaded gear.
 * Old seeds marked band pull-aparts and pulldowns as bodyweight. The name puts pounds back.
 */
export function resolveLogMode(input: {
  logMode?: string | null;
  name?: string;
  reps?: string;
}): LogMode {
  const reps = input.reps ?? "";
  const inferred = fallbackLogMode(input.name ?? "", reps);
  if (!isLogMode(input.logMode)) return inferred;
  // A stored rep column on a hold written as "45s" or "10 sec / side" is seconds.
  if (
    (input.logMode === "reps_only" || input.logMode === "load_reps") &&
    (DURATION_REPS.test(reps) || DISTANCE_REPS.test(reps)) &&
    !prescriptionIsRepCount(reps) &&
    (inferred === "timed" || inferred === "load_timed")
  ) {
    return inferred;
  }
  if (input.logMode === "reps_only" && (inferred === "load_reps" || inferred === "load_timed")) {
    return inferred;
  }
  // A stored "timed" mode from an old seed still has to show Reps when the dose is a count.
  if (
    (input.logMode === "timed" || input.logMode === "timed_round") &&
    prescriptionIsRepCount(input.reps ?? "") &&
    (inferred === "reps_only" || inferred === "load_reps")
  ) {
    return inferred;
  }
  return input.logMode;
}

/**
 * A save that posts reps or seconds, even when the stored mode is a stale "timed".
 * Omitted numbers keep the stored mode. Goblet squat stored as timed stays timed.
 */
export function resolveLoggedSetMode(input: {
  logMode?: string | null;
  name?: string;
  reps?: number | null;
  durationSeconds?: number | null;
}): LogMode {
  const reps =
    typeof input.reps === "number" && Number.isFinite(input.reps)
      ? String(input.reps)
      : typeof input.durationSeconds === "number" && input.durationSeconds > 0
        ? `${input.durationSeconds} sec`
        : "";
  return resolveLogMode({ logMode: input.logMode, name: input.name, reps });
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
  if (!raw || raw.startsWith("-")) return null;
  const colons = raw.match(/:/g)?.length ?? 0;
  if (colons > 2) return null;
  if (colons === 2) {
    const hms = /^(\d+)\s*:\s*(\d{1,2})\s*:\s*(\d{1,2})$/.exec(raw);
    if (!hms) return null;
    const minutes = Number(hms[2]);
    const seconds = Number(hms[3]);
    if (minutes > 59 || seconds > 59) return null;
    const total = Number(hms[1]) * 3600 + minutes * 60 + seconds;
    return total > 0 ? total : null;
  }
  const clock = /^(\d+)\s*:\s*(\d{1,2})$/.exec(raw);
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

/** Hide the machine tag that keeps a chosen bike workout with a saved session. */
function visibleBikeReps(reps: string) {
  return reps.replace(/\s*·\s*bw\s+[a-z0-9.-]+\s*$/i, "").replace(/^\s*bw\s+[a-z0-9.-]+\s*$/i, "").trim();
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
    const reps = visibleBikeReps(input.reps || bikeIntervalReps());
    const parsed = parseBikeIntervalReps(reps);
    const camp = input.loadText?.match(/Camp [a-z-]+: same bike, [a-z]+ dose\./i)?.[0] ?? "";
    const line = parsed
      ? formatIntervalDisplay({
          sets: input.sets,
          rounds: parsed.roundsPerSet,
          workSeconds: parsed.workSeconds,
          restSeconds: parsed.restSeconds,
          setRestSeconds: input.restSeconds,
        })
      : `${countLabel(input.sets, "set")} · ${reps}`;
    return camp ? `${line}. ${camp}` : line;
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
 * Logger card subtitle: sets, prescribed work, then the RIR cue.
 * Percent and rest stay off this line. Previous, Reps, and Lbs do not print RIR.
 */
export function loggerCardLine(input: {
  sets: number;
  reps: string;
  restSeconds?: number;
  logMode?: string | null;
  name?: string;
  loadText?: string | null;
}) {
  const mode = resolveLogMode(input);
  const name = input.name ?? "";
  const rir = rirFromLoadText(input.loadText);
  const effort = rir ? ` @ ${rir}` : "";
  if (isBikeIntervalName(name)) {
    const reps = visibleBikeReps(input.reps || bikeIntervalReps());
    // A stored choice already names the sets and rounds. Prefixing the logged
    // row count turned "2 × 8 rounds · 15/15" into "16 rounds · 2 × 8 rounds".
    if (/\brounds?\b/i.test(reps) || /^steady ride/i.test(reps)) return `${reps}${effort}`;
    return `${countLabel(input.sets, "round")} · ${reps}${effort}`;
  }
  if (mode === "timed_round") {
    return `${countLabel(input.sets, "round")} × ${input.reps}${effort}`;
  }
  if (mode === "load_timed") {
    return `${input.sets} × ${carryDurationLabel(input.reps)}${effort}`;
  }
  if (mode === "timed") {
    if (!rir && input.sets === 1 && (input.restSeconds ?? 0) <= 0 && isSingleClockBlock(input.reps)) {
      return `${input.reps.trim()} continuous`;
    }
    const unit = isHoldName(name) ? countLabel(input.sets, "hold") : countLabel(input.sets, "set");
    return `${unit} × ${input.reps}${effort}`;
  }
  return `${countLabel(input.sets, "set")} × ${input.reps}${effort}`;
}
