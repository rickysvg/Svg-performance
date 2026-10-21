import { describe, expect, it } from "vitest";
import { bodyFatReadout, formatBodyFatDelta, homeTrainingReadout } from "@/lib/home-side-stats";

describe("home side stats", () => {
  it("reads the latest body fat and the change versus the previous entry", () => {
    expect(bodyFatReadout(null, null)).toEqual({ value: null, delta: null, direction: "none" });
    expect(bodyFatReadout(14.2, null)).toEqual({ value: 14.2, delta: null, direction: "none" });
    expect(bodyFatReadout(14.24, 14.8)).toEqual({ value: 14.2, delta: -0.6, direction: "down" });
    expect(bodyFatReadout(15, 14.2)).toEqual({ value: 15, delta: 0.8, direction: "up" });
    expect(bodyFatReadout(14, 14)).toEqual({ value: 14, delta: 0, direction: "flat" });
    expect(formatBodyFatDelta(-0.6)).toBe("▼ 0.6");
    expect(formatBodyFatDelta(0.8)).toBe("▲ 0.8");
    expect(formatBodyFatDelta(0)).toBe("— 0.0");
  });

  it("shows days to fight for an active camp, otherwise the training streak", () => {
    expect(
      homeTrainingReadout({
        campStatus: null,
        fightDateKey: null,
        todayKey: "2026-10-21",
        streakDays: 4,
      }),
    ).toEqual({ mode: "streak", days: 4 });

    expect(
      homeTrainingReadout({
        campStatus: "active",
        fightDateKey: "2026-11-08",
        todayKey: "2026-10-21",
        streakDays: 4,
      }),
    ).toEqual({ mode: "fight", days: 18 });

    expect(
      homeTrainingReadout({
        campStatus: "active",
        fightDateKey: "2026-10-21",
        todayKey: "2026-10-21",
        streakDays: 2,
      }),
    ).toEqual({ mode: "fight", days: 0 });

    expect(
      homeTrainingReadout({
        campStatus: "active",
        fightDateKey: "2026-10-01",
        todayKey: "2026-10-21",
        streakDays: 3,
      }),
    ).toEqual({ mode: "streak", days: 3 });

    expect(
      homeTrainingReadout({
        campStatus: "cancelled",
        fightDateKey: "2026-11-08",
        todayKey: "2026-10-21",
        streakDays: 6,
      }),
    ).toEqual({ mode: "streak", days: 6 });

    expect(
      homeTrainingReadout({
        campStatus: "active",
        fightDateKey: "not-a-date",
        todayKey: "2026-10-21",
        streakDays: 1,
      }),
    ).toEqual({ mode: "streak", days: 1 });
  });
});
