import { describe, expect, it } from "vitest";
import { massCaption, massGaugeScale } from "@/lib/mass-caption";

const tz = "America/Denver";

describe("mass caption", () => {
  it("stays empty of filler when nothing is logged", () => {
    expect(massCaption(null, null, tz)).toBe("NO WEIGH-IN YET");
  });

  it("names the only weigh-in date", () => {
    expect(
      massCaption({ value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") }, null, tz),
    ).toBe("LAST WEIGH-IN · OCT 18");
  });

  it("shows the drop versus last week when the previous log is about seven days earlier", () => {
    expect(
      massCaption(
        { value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 174.6, unit: "lb", recordedAt: new Date("2026-10-11T18:00:00Z") },
        tz,
      ),
    ).toBe("▼ 1.4 LBS VS LAST WEEK");
  });

  it("uses the previous date when the gap is not a week", () => {
    expect(
      massCaption(
        { value: 173.2, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 176.4, unit: "lb", recordedAt: new Date("2026-09-01T18:00:00Z") },
        tz,
      ),
    ).toBe("▼ 3.2 LBS VS SEP 1");
  });

  it("marks a gain with an up tick", () => {
    expect(
      massCaption(
        { value: 174, unit: "lb", recordedAt: new Date("2026-10-18T18:00:00Z") },
        { value: 173.4, unit: "lb", recordedAt: new Date("2026-10-11T18:00:00Z") },
        tz,
      ),
    ).toBe("▲ 0.6 LBS VS LAST WEEK");
  });

  it("puts the current weight on the sweep and rests when empty", () => {
    expect(massGaugeScale({ value: null, goal: 170, recent: [] })).toEqual({ t: 0, goalT: null });
    const gauge = massGaugeScale({ value: 173.2, goal: 170, recent: [176.4, 173.2] });
    expect(gauge.t).toBeGreaterThan(0.4);
    expect(gauge.t).toBeLessThan(0.8);
    expect(gauge.goalT).toBeLessThan(gauge.t);
  });
});
