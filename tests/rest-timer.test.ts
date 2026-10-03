import { describe, expect, it } from "vitest";
import {
  addRestSeconds,
  formatRestClock,
  formatRestPill,
  isRestActive,
  REST_ALARM,
  remainingRestSeconds,
  startRestTimer,
} from "@/lib/rest-timer";

describe("between-set rest timer", () => {
  it("uses an alarm loud enough to cut through gym music", () => {
    expect(REST_ALARM.gain).toBeGreaterThanOrEqual(0.25);
    expect(REST_ALARM.tones.length).toBeGreaterThanOrEqual(3);
    expect(REST_ALARM.vibrate.length).toBeGreaterThanOrEqual(3);
    expect(REST_ALARM.vibrate.some((pulse, index) => index % 2 === 1 && pulse > 0)).toBe(true);
  });

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

  it("adds 15 seconds without restarting the clock", () => {
    const now = 3_000_000;
    const timer = startRestTimer("Jab", 45, now);
    const longer = addRestSeconds(timer, 15);
    expect(longer.exerciseName).toBe("Jab");
    expect(remainingRestSeconds(longer, now + 20_000)).toBe(40);
    expect(longer.endsAtMs).toBe(timer.endsAtMs + 15_000);
  });

  it("subtracts 15 seconds from the same end time", () => {
    const now = 4_000_000;
    const timer = startRestTimer("Jab", 45, now);
    const shorter = addRestSeconds(timer, -15);
    expect(shorter.endsAtMs).toBe(timer.endsAtMs - 15_000);
    expect(remainingRestSeconds(shorter, now + 10_000)).toBe(20);
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
