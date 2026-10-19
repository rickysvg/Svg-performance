import { dayKey } from "@/lib/timezone";

export type MassFontId = 1 | 2 | 3 | 4;

export type WeighInPoint = {
  value: number;
  unit: string;
  recordedAt: Date;
};

/** 1 is the face already on the number. 2 Anton, 3 Orbitron, 4 condensed italic. */
export function parseMassFont(raw: string | string[] | undefined): MassFontId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "2" || value === "3" || value === "4") return Number(value) as MassFontId;
  return 1;
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
  if (!latest) return "No weigh-in yet";
  const when = formatWeighInDate(latest.recordedAt, timeZone);
  if (!previous) return `Last weigh-in · ${when}`;
  const delta = Math.round((latest.value - previous.value) * 10) / 10;
  const signed = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  const days = civilIndex(latest.recordedAt, timeZone) - civilIndex(previous.recordedAt, timeZone);
  const versus =
    days >= 6 && days <= 8 ? "vs last week" : `vs ${formatWeighInDate(previous.recordedAt, timeZone)}`;
  return `${signed} ${massUnitWord(latest.unit)} ${versus}`;
}
