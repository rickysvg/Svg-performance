/**
 * Dedicated interval line. Never run this on the Name field.
 * `2x8 @ 15/15 r60` is 2 sets, 8 rounds, 15s/15s, 60s between sets.
 */

export type IntervalShorthand = {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  /** Null when the line did not mention a rest between sets. */
  setRestSeconds: number | null;
};

export type IntervalShorthandResult =
  | { ok: true; value: IntervalShorthand }
  | { ok: false; error: string };

const HINT = "Try 2x8 @ 15/15";

/** Live timer steppers: 10 sets, 15 min work, 10 min rest and set rest. */
export const INTERVAL_SETS_MAX = 10;
export const INTERVAL_WORK_MIN = 5;
export const INTERVAL_WORK_MAX = 15 * 60;
export const INTERVAL_REST_MAX = 10 * 60;
export const INTERVAL_SET_REST_MAX = 10 * 60;
/** A logged interval longer than this is rejected, matching the session clock cap. */
export const INTERVAL_SESSION_MAX_SECONDS = 4 * 60 * 60;
/**
 * Most rounds that can still fit. One 5s effort per round fills 4 hours at
 * this count. A shorter cap (30) rejected rides the session clock still allows.
 */
export const INTERVAL_ROUNDS_MAX = Math.floor(INTERVAL_SESSION_MAX_SECONDS / INTERVAL_WORK_MIN);
/** Bike rides stop at 40 rounds. 41 is not a ride. Bag and pad rounds keep the session cap. */
export const BIKE_ROUNDS_MAX = 40;

const SETS_MAX = INTERVAL_SETS_MAX;
const ROUNDS_MAX = INTERVAL_ROUNDS_MAX;
const WORK_MIN = INTERVAL_WORK_MIN;
const WORK_MAX = INTERVAL_WORK_MAX;
const REST_MAX = INTERVAL_REST_MAX;
const SET_REST_MAX = INTERVAL_SET_REST_MAX;

/**
 * Bike keeps the rest after the last sprint. Bag, pads, sparring, grappling,
 * and shadow stop on the last work interval.
 */
export type IntervalClockKind = "bike" | "round";

export function intervalClockKind(type: string): IntervalClockKind {
  return type === "bike" ? "bike" : "round";
}

/**
 * One continuous round with no rest may run up to the session cap.
 * Every other interval keeps the live timer's 15:00 work cap.
 * The next round still has to fit that work cap and the 4 hour session.
 */
export function canAddIntervalRound(
  structure: IntervalStructure,
  mode: IntervalClockKind = "round",
) {
  const rounds = Math.round(structure.rounds) + 1;
  const roundsMax = mode === "bike" ? BIKE_ROUNDS_MAX : INTERVAL_ROUNDS_MAX;
  if (!inRange(rounds, 1, roundsMax)) return false;
  const workMax = intervalWorkMax({
    sets: structure.sets,
    rounds,
    restSeconds: structure.restSeconds,
  });
  if (structure.workSeconds > workMax) return false;
  const total = intervalConfiguredSeconds(mode, { ...structure, rounds });
  return total <= INTERVAL_SESSION_MAX_SECONDS;
}

export function intervalWorkMax(spec: { sets: number; rounds: number; restSeconds: number }) {
  const sets = Math.max(1, Math.round(spec.sets) || 1);
  const rounds = Math.max(1, Math.round(spec.rounds) || 1);
  const rest = Math.max(0, Math.round(spec.restSeconds) || 0);
  if (sets === 1 && rounds === 1 && rest === 0) return INTERVAL_SESSION_MAX_SECONDS;
  return WORK_MAX;
}

/** `1:05` is a clock. `1:5` is not. `15m` is minutes. A spaced `15 m` is not. */
const DURATION = String.raw`\d+:\d{2}|\d+[sm]?`;
const SET_REST = String.raw`(?:\s*(?:r|\+)\s*(${DURATION})|\s*\/\s*(${DURATION}))?`;
const FULL = new RegExp(
  String.raw`^(\d+)\s*[x×*]\s*(\d+)\s*(?:@|\s)\s*(${DURATION})\s*\/\s*(${DURATION})${SET_REST}$`,
  "i",
);
const SINGLE = new RegExp(
  String.raw`^(\d+)\s*[x×*]\s*(${DURATION})\s*\/\s*(${DURATION})${SET_REST}$`,
  "i",
);

export function parseShorthandDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  const clock = /^(\d+):(\d{2})$/.exec(text);
  if (clock) {
    const seconds = Number(clock[2]);
    if (seconds > 59) return null;
    return Number(clock[1]) * 60 + seconds;
  }
  const minutes = /^(\d+)m$/.exec(text);
  if (minutes) return Number(minutes[1]) * 60;
  const seconds = /^(\d+)s?$/.exec(text);
  if (seconds) return Number(seconds[1]);
  return null;
}

function formatShorthandDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return String(safe);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** Session totals. Under an hour stays M:SS. An hour or more is H:MM:SS, so 4 hours is 4:00:00. */
export function formatIntervalClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function intervalDurationCapMessage(totalSeconds: number) {
  return `That workout is ${formatIntervalClock(totalSeconds)}. Max 4:00:00.`;
}

function fail(): { ok: false; error: string } {
  return { ok: false, error: HINT };
}

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Full configured clock for one interval type.
 * Bike includes the rest after every sprint. Other types stop on the last work interval.
 */
export function intervalConfiguredSeconds(
  kind: IntervalClockKind,
  spec: {
    sets: number;
    rounds: number;
    workSeconds: number;
    restSeconds: number;
    setRestSeconds: number;
  },
) {
  const sets = Math.max(1, Math.round(spec.sets));
  const rounds = Math.max(1, Math.round(spec.rounds));
  const work = Math.max(0, Math.round(spec.workSeconds));
  const rest = Math.max(0, Math.round(spec.restSeconds));
  const setRest = sets > 1 ? Math.max(0, Math.round(spec.setRestSeconds)) : 0;
  if (kind === "bike") {
    const perSet = rest <= 0 ? rounds * work : rounds * (work + rest);
    return sets * perSet + Math.max(0, sets - 1) * setRest;
  }
  let remaining = sets * rounds;
  let total = 0;
  for (let set = 0; set < sets && remaining > 0; set += 1) {
    const inSet = Math.min(rounds, remaining);
    total += inSet * work + Math.max(0, inSet - 1) * rest;
    remaining -= inSet;
    if (remaining > 0) total += setRest;
  }
  return total;
}

type BuiltLine =
  | { ok: false; error: string }
  | { ok: true; value: IntervalShorthand; totalSeconds: number };

function finish(
  mode: IntervalClockKind,
  sets: number,
  rounds: number,
  workRaw: string,
  restRaw: string,
  setRestRaw: string | undefined,
): BuiltLine {
  const workSeconds = parseShorthandDuration(workRaw);
  const restSeconds = parseShorthandDuration(restRaw);
  if (workSeconds == null || restSeconds == null) return fail();
  const setRestSeconds = setRestRaw ? parseShorthandDuration(setRestRaw) : null;
  if (setRestRaw && setRestSeconds == null) return fail();
  if (!inRange(sets, 1, SETS_MAX)) return fail();
  if (mode === "bike" && rounds > BIKE_ROUNDS_MAX) return { ok: false, error: "Rounds stop at 40." };
  if (!inRange(rounds, 1, ROUNDS_MAX)) return fail();
  const workMax = intervalWorkMax({ sets, rounds, restSeconds });
  if (!inRange(workSeconds, WORK_MIN, workMax)) {
    if (workMax === INTERVAL_SESSION_MAX_SECONDS && workSeconds > INTERVAL_SESSION_MAX_SECONDS) {
      return { ok: false, error: intervalDurationCapMessage(workSeconds) };
    }
    return fail();
  }
  if (!inRange(restSeconds, 0, REST_MAX)) return fail();
  if (setRestSeconds != null && !inRange(setRestSeconds, 0, SET_REST_MAX)) return fail();
  const value = { sets, rounds, workSeconds, restSeconds, setRestSeconds };
  return {
    ok: true,
    value,
    totalSeconds: intervalConfiguredSeconds(mode, {
      sets,
      rounds,
      workSeconds,
      restSeconds,
      setRestSeconds: setRestSeconds ?? 0,
    }),
  };
}

function emomBuilt(mode: IntervalClockKind, rounds: number): BuiltLine {
  if (mode === "bike" && rounds > BIKE_ROUNDS_MAX) return { ok: false, error: "Rounds stop at 40." };
  if (!inRange(rounds, 1, ROUNDS_MAX)) return fail();
  const value = { sets: 1, rounds, workSeconds: 60, restSeconds: 0, setRestSeconds: null };
  return {
    ok: true,
    value,
    totalSeconds: intervalConfiguredSeconds(mode, { ...value, setRestSeconds: 0 }),
  };
}

function rejectOverCap(built: BuiltLine): IntervalShorthandResult {
  if (!built.ok) return built;
  if (built.totalSeconds > INTERVAL_SESSION_MAX_SECONDS) {
    return { ok: false, error: intervalDurationCapMessage(built.totalSeconds) };
  }
  return { ok: true, value: built.value };
}

export function parseIntervalShorthand(text: string, mode: IntervalClockKind = "round"): IntervalShorthandResult {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return fail();
  if (/^tabata$/i.test(raw)) {
    return rejectOverCap(finish(mode, 1, 8, "20", "10", undefined));
  }
  const emom = /^emom\s+(\d+)$/i.exec(raw);
  if (emom) return rejectOverCap(emomBuilt(mode, Number(emom[1])));
  const full = FULL.exec(raw);
  if (full) {
    return rejectOverCap(finish(mode, Number(full[1]), Number(full[2]), full[3] ?? "", full[4] ?? "", full[5] || full[6]));
  }
  const single = SINGLE.exec(raw);
  if (single) {
    return rejectOverCap(finish(mode, 1, Number(single[1]), single[2] ?? "", single[3] ?? "", single[4] || single[5]));
  }
  return fail();
}

export function formatIntervalShorthand(spec: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds?: number | null;
}) {
  const work = formatShorthandDuration(spec.workSeconds);
  const rest = formatShorthandDuration(spec.restSeconds);
  const core =
    spec.sets > 1
      ? `${spec.sets}x${spec.rounds} @ ${work}/${rest}`
      : `${spec.rounds}x${work}/${rest}`;
  if (spec.sets > 1 && spec.setRestSeconds != null && spec.setRestSeconds > 0) {
    return `${core} r${Math.round(spec.setRestSeconds)}`;
  }
  return core;
}

/**
 * One member-facing line. Rounds are the intervals inside a set.
 * Sets are the groups. `2 × 8 rounds · 15/15 · 60s between sets`.
 */
export function formatIntervalDisplay(spec: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds?: number | null;
}) {
  const sets = Math.max(1, Math.round(spec.sets) || 1);
  const rounds = Math.max(1, Math.round(spec.rounds) || 1);
  const restSeconds = Math.max(0, Math.round(spec.restSeconds) || 0);
  if (sets === 1 && rounds === 1 && restSeconds === 0) {
    return `Steady ride · ${formatIntervalClock(spec.workSeconds)}`;
  }
  const pair = `${formatShorthandDuration(spec.workSeconds)}/${formatShorthandDuration(restSeconds)}`;
  const roundsLabel = formatIntervalTotal(rounds);
  if (sets > 1) {
    const between =
      spec.setRestSeconds != null && spec.setRestSeconds > 0
        ? ` · ${Math.round(spec.setRestSeconds)}s between sets`
        : "";
    return `${sets} × ${roundsLabel} · ${pair}${between}`;
  }
  return `${roundsLabel} · ${pair}`;
}

export function formatIntervalTotal(totalRounds: number) {
  const count = Math.max(0, Math.round(totalRounds));
  return `${count} ${count === 1 ? "round" : "rounds"}`;
}

/** Button copy. The set-rest suffix stays in the field, not on Save. */
export function formatSessionSummary(spec: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
}) {
  const work = formatShorthandDuration(spec.workSeconds);
  const rest = formatShorthandDuration(spec.restSeconds);
  if (spec.sets > 1) return `${spec.sets}×${spec.rounds} @ ${work}/${rest}`;
  return `${spec.rounds}×${work}/${rest}`;
}

export type IntervalStructure = {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
};

export function clampIntervalStructure(spec: IntervalStructure): IntervalStructure {
  const sets = Math.min(SETS_MAX, Math.max(1, Math.round(spec.sets) || 1));
  const rounds = Math.min(ROUNDS_MAX, Math.max(1, Math.round(spec.rounds) || 1));
  const restSeconds = Math.min(REST_MAX, Math.max(0, Math.round(spec.restSeconds) || 0));
  const workMax = intervalWorkMax({ sets, rounds, restSeconds });
  const workSeconds = Math.min(workMax, Math.max(WORK_MIN, Math.round(spec.workSeconds) || WORK_MIN));
  const setRestSeconds = Math.min(SET_REST_MAX, Math.max(0, Math.round(spec.setRestSeconds) || 0));
  return { sets, rounds, workSeconds, restSeconds, setRestSeconds };
}

function sameStructure(left: IntervalStructure, right: IntervalStructure) {
  return (
    left.sets === right.sets &&
    left.rounds === right.rounds &&
    left.workSeconds === right.workSeconds &&
    left.restSeconds === right.restSeconds &&
    left.setRestSeconds === right.setRestSeconds
  );
}

function interpretShorthand(text: string, current: IntervalStructure, mode: IntervalClockKind) {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return fail();
  const built = /^tabata$/i.test(raw)
    ? finish(mode, 1, 8, "20", "10", undefined)
    : null;
  const parsed = built ?? parseBuilt(raw, mode);
  if (!parsed.ok) return parsed;
  const structure = clampIntervalStructure({
    sets: parsed.value.sets,
    rounds: parsed.value.rounds,
    workSeconds: parsed.value.workSeconds,
    restSeconds: parsed.value.restSeconds,
    setRestSeconds: parsed.value.setRestSeconds ?? current.setRestSeconds,
  });
  const totalSeconds = intervalConfiguredSeconds(mode, structure);
  return { ok: true as const, structure, totalSeconds };
}

function parseBuilt(raw: string, mode: IntervalClockKind): BuiltLine {
  const emom = /^emom\s+(\d+)$/i.exec(raw);
  if (emom) return emomBuilt(mode, Number(emom[1]));
  const full = FULL.exec(raw);
  if (full) {
    return finish(mode, Number(full[1]), Number(full[2]), full[3] ?? "", full[4] ?? "", full[5] || full[6]);
  }
  const single = SINGLE.exec(raw);
  if (single) {
    return finish(mode, 1, Number(single[1]), single[2] ?? "", single[3] ?? "", single[4] || single[5]);
  }
  return fail();
}

/**
 * Whether the field can be saved. A rejected line blocks Save even when the
 * steppers still show the previous structure. `matches` is true when that
 * line is the structure already on the steppers.
 */
export function shorthandLineState(text: string, current: IntervalStructure, mode: IntervalClockKind = "round") {
  const read = interpretShorthand(text, current, mode);
  if (!read.ok) return { error: read.error, matches: false, blocked: true };
  if (read.totalSeconds > INTERVAL_SESSION_MAX_SECONDS) {
    return {
      error: intervalDurationCapMessage(read.totalSeconds),
      matches: sameStructure(read.structure, current),
      blocked: true,
    };
  }
  const matches = sameStructure(read.structure, current);
  return { error: "", matches, blocked: !matches };
}

/** A bad line keeps the steppers. A good line updates them and keeps an omitted set rest. */
export function commitShorthand(text: string, current: IntervalStructure, mode: IntervalClockKind = "round") {
  const read = interpretShorthand(text, current, mode);
  if (!read.ok) return { structure: current, error: read.error };
  if (read.totalSeconds > INTERVAL_SESSION_MAX_SECONDS) {
    return { structure: current, error: intervalDurationCapMessage(read.totalSeconds) };
  }
  return { structure: read.structure, error: "" };
}

/** Digits typed into Done. Empty counts as zero so the message can show while the field is being edited. */
export function draftCount(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return 0;
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function commitStructure(next: IntervalStructure) {
  const structure = clampIntervalStructure(next);
  return { structure, shorthand: formatIntervalShorthand(structure) };
}

/** 5s jumps under a minute, then 15s. Landing on 60 is exact. */
export function stepSeconds(current: number, direction: -1 | 1, min: number, max: number) {
  const safe = Math.round(current);
  let next: number;
  if (direction > 0) {
    const step = safe < 60 ? 5 : 15;
    next = safe + step;
    if (safe < 60 && next > 60) next = 60;
  } else {
    const step = safe <= 60 ? 5 : 15;
    next = safe - step;
  }
  return Math.min(max, Math.max(min, next));
}
