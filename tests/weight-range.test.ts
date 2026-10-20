import { describe, expect, it } from "vitest";
import { filterWeightRange, weightValuesSince, type WeightSeriesPoint } from "@/lib/weight-series";

function point(id: string, iso: string, value: number): WeightSeriesPoint {
  return { id, label: id, value, unit: "lb", recordedAt: iso };
}

describe("weight range", () => {
  const now = new Date("2026-10-20T18:00:00Z");
  const points = [
    point("old", "2026-06-01T18:00:00Z", 190),
    point("d40", "2026-09-10T18:00:00Z", 188),
    point("d10", "2026-10-10T18:00:00Z", 186),
    point("d2", "2026-10-18T18:00:00Z", 185.4),
  ];

  it("keeps the last week, month, quarter, and every entry", () => {
    expect(filterWeightRange(points, "7", now).map((row) => row.id)).toEqual(["d2"]);
    expect(filterWeightRange(points, "30", now).map((row) => row.id)).toEqual(["d10", "d2"]);
    expect(filterWeightRange(points, "90", now).map((row) => row.id)).toEqual(["d40", "d10", "d2"]);
    expect(filterWeightRange(points, "all", now)).toHaveLength(4);
  });

  it("keeps the last seven days of weigh-ins, oldest first", () => {
    const values = weightValuesSince(
      [
        { value: 190, recordedAt: new Date("2026-07-20T18:00:00Z") },
        { value: 186.2, recordedAt: new Date("2026-10-10T18:00:00Z") },
        { value: 185.4, recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 98, recordedAt: new Date("2026-10-20T16:00:00Z") },
      ],
      now,
    );
    expect(values).toEqual([185.4, 98]);
  });
});
