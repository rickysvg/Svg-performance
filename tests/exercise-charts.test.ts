import { describe, expect, it } from "vitest";
import {
  applyFreeHistoryCutoff,
  filterChartPoints,
  FREE_CHART_WEEKS,
  resolveChartWindow,
  weeklyBestLoad,
  type ChartPoint,
} from "@/lib/exercise-charts";
import { addZonedDays } from "@/lib/timezone";

const tz = "America/Denver";
const now = new Date("2026-09-22T18:00:00.000Z");

function point(weeksAgo: number, value: number): ChartPoint {
  const at = addZonedDays(now, -weeksAgo * 7, tz);
  return {
    weekKey: `w${weeksAgo}`,
    label: `W${weeksAgo}`,
    value,
    volume: value * 3,
    at,
  };
}

describe("12-week free chart cutoff", () => {
  it("keeps a point inside 12 weeks for the free plan", () => {
    const points = [point(11, 150), point(0, 180)];
    const { visible, hiddenCount } = applyFreeHistoryCutoff(points, now, false, tz);
    expect(visible).toHaveLength(2);
    expect(hiddenCount).toBe(0);
  });

  it("hides a point older than 12 weeks on the free plan", () => {
    const points = [point(13, 140), point(2, 170)];
    const { visible, hiddenCount } = applyFreeHistoryCutoff(points, now, false, tz);
    expect(visible.map((row) => row.value)).toEqual([170]);
    expect(hiddenCount).toBe(1);
  });

  it("keeps older points on a paid plan", () => {
    const points = [point(20, 140), point(2, 170)];
    const { visible, hiddenCount } = applyFreeHistoryCutoff(points, now, true, tz);
    expect(visible).toHaveLength(2);
    expect(hiddenCount).toBe(0);
  });

  it("locks 1Y and All for the free plan and falls back to 12 weeks", () => {
    const year = resolveChartWindow({ range: "1y", paid: false, now, timeZone: tz });
    const all = resolveChartWindow({ range: "all", paid: false, now, timeZone: tz });
    const free12 = resolveChartWindow({ range: "12w", paid: false, now, timeZone: tz });
    expect(year.locked).toBe(true);
    expect(all.locked).toBe(true);
    expect(year.range).toBe("12w");
    expect(free12.locked).toBe(false);
    expect(FREE_CHART_WEEKS).toBe(12);
  });

  it("unlocks longer ranges on a paid plan", () => {
    const year = resolveChartWindow({ range: "1y", paid: true, now, timeZone: tz });
    expect(year.locked).toBe(false);
    expect(year.range).toBe("1y");
  });

  it("filters weekly bests through the free cutoff", () => {
    const old = addZonedDays(now, -13 * 7, tz);
    const recent = addZonedDays(now, -2 * 7, tz);
    const series = weeklyBestLoad(
      [
        {
          exerciseName: "Trap bar deadlift",
          reps: 3,
          loadValue: 150,
          loadUnit: "kg",
          completed: true,
          performedAt: old,
        },
        {
          exerciseName: "Trap bar deadlift",
          reps: 3,
          loadValue: 180,
          loadUnit: "kg",
          completed: true,
          performedAt: recent,
        },
      ],
      "Trap bar deadlift",
      "kg",
      tz,
    );
    const free = filterChartPoints(series, null, now, false, tz);
    const paid = filterChartPoints(series, null, now, true, tz);
    expect(free.visible).toHaveLength(1);
    expect(free.visible[0]?.value).toBe(180);
    expect(paid.visible).toHaveLength(2);
  });
});
