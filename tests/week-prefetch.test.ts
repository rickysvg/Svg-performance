import { describe, expect, it } from "vitest";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { loggedCountMessage, loggedRepsFromInput } from "@/lib/logged-work";
import {
  freshPrefetchHrefs,
  resetWeekPrefetchState,
  scheduleWeekPrefetch,
  type IdleHost,
} from "@/lib/week-prefetch";

function idleHost() {
  const queued: Array<(() => void) | null> = [];
  const host: IdleHost = {
    request(callback) {
      queued.push(callback);
      return queued.length;
    },
    cancel(id) {
      queued[id - 1] = null;
    },
  };
  return {
    host,
    flush() {
      const index = queued.findIndex((callback) => callback);
      if (index < 0) return;
      const callback = queued[index];
      queued[index] = null;
      callback?.();
    },
  };
}

describe("week prefetch", () => {
  it("waits for idle, skips duplicates, and cancels work that has not started", () => {
    resetWeekPrefetchState();
    const calls: string[] = [];
    const first = idleHost();
    const stop = scheduleWeekPrefetch(["/training?day=a", "/training?day=b", "/training?day=a"], (href) => {
      calls.push(href);
    }, first.host);
    expect(calls).toEqual([]);
    first.flush();
    expect(calls).toEqual(["/training?day=a"]);
    stop();
    first.flush();
    expect(calls).toEqual(["/training?day=a"]);

    const second = idleHost();
    scheduleWeekPrefetch(["/training?day=a", "/training?day=c"], (href) => {
      calls.push(href);
    }, second.host);
    second.flush();
    expect(calls).toEqual(["/training?day=a", "/training?day=c"]);
    expect(freshPrefetchHrefs(["/training?day=c", ""], new Set(["/training?day=c"]))).toEqual([]);
  });
});

describe("distance carries are not rep-capped", () => {
  it("allows 200 m on a carry and still caps a real rep count at 100", () => {
    const carryKey = addedPrescriptionKey({
      exerciseName: "Farmer carry",
      reps: "30 m",
      restSeconds: 45,
    });
    expect(
      loggedCountMessage({
        exerciseName: "Farmer carry",
        reps: 200,
        logMode: "load_timed",
        prescriptionKey: carryKey,
        durationSeconds: null,
      }),
    ).toBeNull();
    expect(
      loggedCountMessage({
        exerciseName: "Farmer carry",
        reps: 5000,
        logMode: "load_timed",
        durationSeconds: null,
      }),
    ).toBeNull();
    expect(
      loggedCountMessage({
        exerciseName: "Farmer carry",
        reps: 5001,
        logMode: "load_timed",
        durationSeconds: null,
      }),
    ).toMatch(/5000/);
    expect(
      loggedCountMessage({
        exerciseName: "Goblet squat",
        reps: 101,
        logMode: "load_reps",
        prescriptionKey: "goblet squat::6",
      }),
    ).toBe("Reps should be between 0 and 100.");
    expect(
      loggedCountMessage({
        exerciseName: "Zercher carry",
        reps: 101,
        logMode: "load_timed",
        durationSeconds: 30,
        prescriptionKey: "zercher carry::30sec",
      }),
    ).toBe("Reps should be between 0 and 100.");
    expect(loggedRepsFromInput("150")).toEqual({ value: 100, error: "Reps max is 100." });
    expect(loggedRepsFromInput("100")).toEqual({ value: 100, error: "" });
  });
});
