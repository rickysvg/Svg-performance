import { describe, expect, it } from "vitest";
import {
  daySessionOrdinal,
  formatWorkoutCompleteDate,
  workoutCompleteSessionLine,
} from "@/lib/workout-complete";

const zone = "America/Denver";

describe("finish screen session number", () => {
  it("does not count another day's session, and drops the number when today has one", () => {
    const monday = new Date("2026-11-16T16:00:00.000Z");
    const tuesday = new Date("2026-11-17T16:00:00.000Z");
    const sessions = [
      { id: "monday", performedAt: monday },
      { id: "tuesday", performedAt: tuesday },
    ];
    expect(daySessionOrdinal("tuesday", sessions, zone)).toBeNull();
    const line = workoutCompleteSessionLine(
      formatWorkoutCompleteDate(tuesday, zone),
      daySessionOrdinal("tuesday", sessions, zone),
    );
    expect(line).toBe("TUE NOV 17");
    expect(line).not.toContain("Session");
  });

  it("numbers only that calendar day's sessions, first to last", () => {
    const monday = new Date("2026-11-16T16:00:00.000Z");
    const first = new Date("2026-11-17T15:00:00.000Z");
    const second = new Date("2026-11-17T21:00:00.000Z");
    const sessions = [
      { id: "second", performedAt: second },
      { id: "monday", performedAt: monday },
      { id: "first", performedAt: first },
    ];
    expect(daySessionOrdinal("first", sessions, zone)).toBe(1);
    expect(daySessionOrdinal("second", sessions, zone)).toBe(2);
    expect(
      workoutCompleteSessionLine(formatWorkoutCompleteDate(first, zone), 1),
    ).toBe("TUE NOV 17 · Session 1");
    expect(
      workoutCompleteSessionLine(formatWorkoutCompleteDate(second, zone), 2),
    ).toBe("TUE NOV 17 · Session 2");
  });
});
