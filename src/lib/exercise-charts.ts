import { convertLoad, isLoadUnit, type LoadUnit, volumeInUnit } from "@/lib/units";
import { APP_TIMEZONE, addZonedDays, dayKey, mondayOfZoned, startOfZonedDay } from "@/lib/timezone";

export const FREE_CHART_WEEKS = 12;
export const CHART_RANGES = ["4w", "12w", "1y", "all"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export type ChartSetLike = {
  exerciseName: string;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  completed?: boolean;
  performedAt: Date;
};

export type ChartPoint = {
  weekKey: string;
  label: string;
  value: number;
  volume: number;
  at: Date;
};

export function isChartRange(value: string | null | undefined): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange);
}

export function isPaidChartRange(range: ChartRange) {
  return range === "1y" || range === "all";
}

export function chartRangeStart(range: ChartRange, now = new Date(), timeZone = APP_TIMEZONE) {
  const today = startOfZonedDay(now, timeZone);
  if (range === "4w") return addZonedDays(today, -28, timeZone);
  if (range === "12w") return addZonedDays(today, -FREE_CHART_WEEKS * 7, timeZone);
  if (range === "1y") return addZonedDays(today, -365, timeZone);
  return null;
}

export function freeHistoryStart(now = new Date(), timeZone = APP_TIMEZONE) {
  return addZonedDays(startOfZonedDay(now, timeZone), -FREE_CHART_WEEKS * 7, timeZone);
}

export function applyFreeHistoryCutoff<T extends { at: Date }>(
  points: T[],
  now = new Date(),
  paid = false,
  timeZone = APP_TIMEZONE,
) {
  if (paid) {
    return { visible: points, hiddenCount: 0, cutoff: null as Date | null };
  }
  const cutoff = freeHistoryStart(now, timeZone);
  const visible = points.filter((point) => point.at.getTime() >= cutoff.getTime());
  return { visible, hiddenCount: points.length - visible.length, cutoff };
}

function mondayKey(date: Date, timeZone: string) {
  return dayKey(mondayOfZoned(date, timeZone), timeZone);
}

export function weeklyBestLoad(
  sets: ChartSetLike[],
  exerciseName: string,
  displayUnit: LoadUnit,
  timeZone = APP_TIMEZONE,
): ChartPoint[] {
  const wanted = exerciseName.trim().toLowerCase();
  const weeks = new Map<string, ChartPoint>();

  for (const set of sets) {
    if (set.completed === false) continue;
    if (set.exerciseName.trim().toLowerCase() !== wanted) continue;
    if (set.loadValue == null || !isLoadUnit(set.loadUnit)) continue;
    const load = Math.round(convertLoad(set.loadValue, set.loadUnit, displayUnit) * 10) / 10;
    const volume = volumeInUnit(set.reps, set.loadValue, set.loadUnit, displayUnit);
    const weekKey = mondayKey(set.performedAt, timeZone);
    const current = weeks.get(weekKey);
    if (!current || load > current.value) {
      weeks.set(weekKey, {
        weekKey,
        label: weekKey.slice(5),
        value: load,
        volume: Math.round(volume),
        at: set.performedAt,
      });
    } else {
      current.volume += Math.round(volume);
    }
  }

  return [...weeks.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

export function labelChartWeeks(points: ChartPoint[]) {
  return points.map((point, index) => ({
    ...point,
    label: `W${index + 1}`,
  }));
}

export function resolveChartWindow(input: {
  range: ChartRange;
  paid: boolean;
  now?: Date;
  timeZone?: string;
}) {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const now = input.now ?? new Date();
  const locked = isPaidChartRange(input.range) && !input.paid;
  const range: ChartRange = locked ? "12w" : input.range;
  return {
    range,
    requested: input.range,
    locked,
    start: chartRangeStart(range, now, timeZone),
    freeCutoff: input.paid ? null : freeHistoryStart(now, timeZone),
  };
}

export function filterChartPoints(
  points: ChartPoint[],
  start: Date | null,
  now = new Date(),
  paid = false,
  timeZone = APP_TIMEZONE,
) {
  const afterStart = start
    ? points.filter((point) => point.at.getTime() >= start.getTime())
    : points;
  return applyFreeHistoryCutoff(afterStart, now, paid, timeZone);
}
