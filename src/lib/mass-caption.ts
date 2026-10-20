import { dayKey } from "@/lib/timezone";

export type MassFontId = 1 | 2;

export type MassGauge = {
  /** 0–1 along the sweep. 0 rests at the low end. */
  t: number;
  /** Goal tick, when a goal weight exists. */
  goalT: number | null;
};

export type WeighInPoint = {
  value: number;
  unit: string;
  recordedAt: Date;
};

/** 1 segmented digits with a filled arc. 2 wide italic with a tick sweep. */
export function parseMassFont(raw: string | string[] | undefined): MassFontId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "2") return 2;
  return 1;
}

/**
 * Places the current weight on a sweep. The scale is the recent range, widened
 * to include the goal when one is set. A single reading sits mid-scale.
 */
export function massGaugeScale(input: {
  value: number | null;
  goal: number | null;
  recent: number[];
}): MassGauge {
  if (input.value == null || !Number.isFinite(input.value)) {
    return { t: 0, goalT: null };
  }
  const points = input.recent.filter((n) => Number.isFinite(n));
  points.push(input.value);
  if (input.goal != null && Number.isFinite(input.goal)) points.push(input.goal);
  let low = Math.min(...points);
  let high = Math.max(...points);
  if (high - low < 4) {
    const mid = (high + low) / 2;
    low = mid - 2;
    high = mid + 2;
  } else {
    const pad = (high - low) * 0.08;
    low -= pad;
    high += pad;
  }
  const span = high - low || 1;
  const clamp = (n: number) => Math.min(1, Math.max(0, (n - low) / span));
  return {
    t: clamp(input.value),
    goalT: input.goal != null && Number.isFinite(input.goal) ? clamp(input.goal) : null,
  };
}

function civilIndex(date: Date, timeZone: string) {
  const [year, month, day] = dayKey(date, timeZone).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function formatWeighInDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

function massUnitWord(unit: string) {
  return unit === "lb" ? "lbs" : unit;
}

/** Real last-weigh-in line. Callers pass display units (kg already converted). */
export function massCaption(
  latest: WeighInPoint | null,
  previous: WeighInPoint | null,
  timeZone: string,
) {
  if (!latest) return "NO WEIGH-IN YET";
  const when = formatWeighInDate(latest.recordedAt, timeZone).toUpperCase();
  if (!previous) return `LAST WEIGH-IN · ${when}`;
  const delta = Math.round((latest.value - previous.value) * 10) / 10;
  const amount = Math.abs(delta).toFixed(1);
  const mark = delta < 0 ? "▼" : delta > 0 ? "▲" : "—";
  const days = civilIndex(latest.recordedAt, timeZone) - civilIndex(previous.recordedAt, timeZone);
  const versus =
    days >= 6 && days <= 8
      ? "VS LAST WEEK"
      : `VS ${formatWeighInDate(previous.recordedAt, timeZone).toUpperCase()}`;
  return `${mark} ${amount} ${massUnitWord(latest.unit).toUpperCase()} ${versus}`;
}
