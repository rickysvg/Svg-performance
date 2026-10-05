import { describe, expect, it } from "vitest";
import { encodeWav } from "@/lib/media-output";
import {
  addRestSeconds,
  formatRestClock,
  formatRestPill,
  isRestActive,
  remainingRestSeconds,
  restCueForTick,
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

  it("adds 15 seconds without restarting the clock", () => {
    const now = 3_000_000;
    const timer = startRestTimer("Jab", 45, now);
    const longer = addRestSeconds(timer, 15);
    expect(longer.exerciseName).toBe("Jab");
    expect(remainingRestSeconds(longer, now + 20_000)).toBe(40);
    expect(longer.endsAtMs).toBe(timer.endsAtMs + 15_000);
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

  it("warns on 3, 2, and 1, then completes once at zero", () => {
    expect(restCueForTick(90, 89)).toBeNull();
    expect(restCueForTick(4, 3)).toBe("warning");
    expect(restCueForTick(3, 3)).toBeNull();
    expect(restCueForTick(3, 2)).toBe("warning");
    expect(restCueForTick(2, 1)).toBe("warning");
    expect(restCueForTick(1, 0)).toBe("complete");
    expect(restCueForTick(0, 0)).toBeNull();
    expect(restCueForTick(8, 0)).toBe("complete");
    expect(restCueForTick(6, 2)).toBe("warning");
    expect(restCueForTick(null, 90)).toBeNull();
    expect(restCueForTick(null, 3)).toBe("warning");
  });

  it("builds a playback wav loud enough to survive a headphone buffer", () => {
    const wav = new Uint8Array(
      encodeWav([
        { frequency: 523, seconds: 0.16, gain: 0.7 },
        { frequency: 784, seconds: 0.28, gain: 0.78 },
      ]),
    );
    expect(String.fromCharCode(wav[0]!, wav[1]!, wav[2]!, wav[3]!)).toBe("RIFF");
    expect(String.fromCharCode(wav[8]!, wav[9]!, wav[10]!, wav[11]!)).toBe("WAVE");
    expect(wav.byteLength).toBeGreaterThan(44 + 22050 * 0.4);
  });
});
