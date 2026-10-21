import { describe, expect, it } from "vitest";
import { buildWeekTelemetry, formatTelemetryNumber, trainingLoadForDay } from "@/lib/home-telemetry";

describe("home telemetry buckets", () => {
  const weekKeys = [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ];

  it("sums load and rounds onto Monday-first days and ignores other weeks", () => {
    const result = buildWeekTelemetry({
      weekKeys,
      sessions: [
        { dayKey: "2026-10-12", volume: 1000 },
        { dayKey: "2026-10-12", volume: 250.4 },
        { dayKey: "2026-10-14", volume: 400 },
        { dayKey: "2026-10-05", volume: 9999 },
      ],
      rounds: [
        { dayKey: "2026-10-14", rounds: 5 },
        { dayKey: "2026-10-14", rounds: 3 },
        { dayKey: "2026-10-18", rounds: 4 },
      ],
      streakCurrent: 3,
      streakLongest: 9,
    });

    expect(result.days.map((day) => day.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(result.days[0]).toMatchObject({ load: 1250, bagLoad: 0, sessions: 2, rounds: 0, name: "Monday" });
    expect(result.days[2]).toMatchObject({ load: 400, rounds: 8, sessions: 1 });
    expect(result.days[6]).toMatchObject({ rounds: 4, sessions: 0 });
    expect(result.weekLoad).toBe(1650);
    expect(result.weekRounds).toBe(12);
    expect(result.weekSessions).toBe(3);
    expect(result.streakCurrent).toBe(3);
    expect(result.streakLongest).toBe(9);
  });

  it("adds bagwork load beside lifting volume without folding it into weekLoad", () => {
    const result = buildWeekTelemetry({
      weekKeys,
      sessions: [
        { dayKey: "2026-10-12", volume: 1000 },
        { dayKey: "2026-10-12", volume: 0, bagLoad: 84 },
      ],
      rounds: [],
      streakCurrent: 1,
      streakLongest: 1,
    });
    expect(result.days[0]?.load).toBe(1000);
    expect(result.days[0]?.bagLoad).toBe(84);
    expect(result.weekLoad).toBe(1000);
    expect(trainingLoadForDay(result.days[0]!)).toBe(1084);
  });

  it("compacts large loads for the dash readout", () => {
    expect(formatTelemetryNumber(850)).toBe("850");
    expect(formatTelemetryNumber(1500)).toBe("1.5k");
    expect(formatTelemetryNumber(0)).toBe("0");
  });
});
