import { describe, expect, it } from "vitest";
import {
  formatRestClock,
  formatRestPill,
  isRestActive,
  remainingRestSeconds,
  startRestTimer,
} from "@/lib/rest-timer";

describe("between-set rest timer", () => {
  it("formats the pill and the header clock", () => {
    expect(formatRestPill(90)).toBe("90s");
    expect(formatRestPill(60)).toBe("60s");
    expect(formatRestClock(90)).toBe("01:30");
    expect(formatRestClock(5)).toBe("00:05");
    expect(formatRestClock(0)).toBe("00:00");
    expect(formatRestClock(-3)).toBe("00:00");
  });

  it("starts a countdown and clears after zero", () => {
    const now = 1_000_000;
    const timer = startRestTimer("Goblet squat", 90, now);
    expect(timer.exerciseName).toBe("Goblet squat");
    expect(timer.durationSeconds).toBe(90);
    expect(remainingRestSeconds(timer, now)).toBe(90);
    expect(remainingRestSeconds(timer, now + 30_000)).toBe(60);
    expect(isRestActive(timer, now + 89_000)).toBe(true);
    expect(remainingRestSeconds(timer, now + 90_000)).toBe(0);
    expect(isRestActive(timer, now + 90_000)).toBe(false);
    expect(isRestActive(null, now)).toBe(false);
  });

  it("replaces the active rest when another exercise starts", () => {
    const now = 2_000_000;
    const first = startRestTimer("Goblet squat", 90, now);
    const second = startRestTimer("Romanian deadlift", 75, now + 5_000);
    expect(second.exerciseName).toBe("Romanian deadlift");
    expect(second.exerciseName).not.toBe(first.exerciseName);
    expect(remainingRestSeconds(second, now + 5_000)).toBe(75);
    expect(isRestActive(second, now + 5_000 + 74_000)).toBe(true);
    expect(isRestActive(second, now + 5_000 + 75_000)).toBe(false);
  });
});
