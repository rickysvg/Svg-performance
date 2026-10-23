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

const SETS_MAX = 10;
const ROUNDS_MAX = 50;
const WORK_MIN = 5;
const WORK_MAX = 3600;
const REST_MAX = 3600;
const SET_REST_MAX = 600;

const DURATION = String.raw`\d+:\d{1,2}|\d+\s*[sm]?`;
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
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
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

function fail(): IntervalShorthandResult {
  return { ok: false, error: HINT };
}

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function finish(
  sets: number,
  rounds: number,
  workRaw: string,
  restRaw: string,
  setRestRaw: string | undefined,
): IntervalShorthandResult {
  const workSeconds = parseShorthandDuration(workRaw);
  const restSeconds = parseShorthandDuration(restRaw);
  if (workSeconds == null || restSeconds == null) return fail();
  const setRestSeconds = setRestRaw ? parseShorthandDuration(setRestRaw) : null;
  if (setRestRaw && setRestSeconds == null) return fail();
  if (!inRange(sets, 1, SETS_MAX)) return fail();
  if (!inRange(rounds, 1, ROUNDS_MAX)) return fail();
  if (!inRange(workSeconds, WORK_MIN, WORK_MAX)) return fail();
  if (!inRange(restSeconds, 0, REST_MAX)) return fail();
  if (setRestSeconds != null && !inRange(setRestSeconds, 0, SET_REST_MAX)) return fail();
  return {
    ok: true,
    value: { sets, rounds, workSeconds, restSeconds, setRestSeconds },
  };
}

export function parseIntervalShorthand(text: string): IntervalShorthandResult {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return fail();
  if (/^tabata$/i.test(raw)) {
    return finish(1, 8, "20", "10", undefined);
  }
  const emom = /^emom\s+(\d+)$/i.exec(raw);
  if (emom) {
    const rounds = Number(emom[1]);
    if (!inRange(rounds, 1, ROUNDS_MAX)) return fail();
    return {
      ok: true,
      value: { sets: 1, rounds, workSeconds: 60, restSeconds: 0, setRestSeconds: null },
    };
  }
  const full = FULL.exec(raw);
  if (full) {
    return finish(Number(full[1]), Number(full[2]), full[3] ?? "", full[4] ?? "", full[5] || full[6]);
  }
  const single = SINGLE.exec(raw);
  if (single) {
    return finish(1, Number(single[1]), single[2] ?? "", single[3] ?? "", single[4] || single[5]);
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
  const workSeconds = Math.min(WORK_MAX, Math.max(WORK_MIN, Math.round(spec.workSeconds) || WORK_MIN));
  const restSeconds = Math.min(REST_MAX, Math.max(0, Math.round(spec.restSeconds) || 0));
  const setRestSeconds = Math.min(SET_REST_MAX, Math.max(0, Math.round(spec.setRestSeconds) || 0));
  return { sets, rounds, workSeconds, restSeconds, setRestSeconds };
}

/** A bad line keeps the steppers. A good line updates them and keeps an omitted set rest. */
export function commitShorthand(text: string, current: IntervalStructure) {
  const parsed = parseIntervalShorthand(text);
  if (!parsed.ok) return { structure: current, error: parsed.error };
  return {
    structure: clampIntervalStructure({
      sets: parsed.value.sets,
      rounds: parsed.value.rounds,
      workSeconds: parsed.value.workSeconds,
      restSeconds: parsed.value.restSeconds,
      setRestSeconds: parsed.value.setRestSeconds ?? current.setRestSeconds,
    }),
    error: "",
  };
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
