import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { applyRepsEntries, loggedCountMessage, loggedRepsFromInput, nextRepsEntry, repsCapMessage } from "@/lib/logged-work";
import {
  WEEK_PREFETCH_STALE_MS,
  freshPrefetchHrefs,
  prefetchWeekRoute,
  resetWeekPrefetchState,
  scheduleWeekPrefetch,
  type PrefetchTask,
  type TimerHost,
} from "@/lib/week-prefetch";

function manualClock(start = 0) {
  let now = start;
  type Item = { at: number; cb: () => void; dead: boolean };
  const items: Item[] = [];
  const timers: TimerHost = {
    schedule(ms, callback) {
      const item: Item = { at: now + ms, cb: callback, dead: false };
      items.push(item);
      return () => {
        item.dead = true;
      };
    },
  };
  return {
    timers,
    now: () => now,
    set(ms: number) {
      now = ms;
    },
    async advance(ms: number) {
      const target = now + ms;
      for (let guard = 0; guard < 20; guard += 1) {
        const next = items.filter((item) => !item.dead && item.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at;
        next.dead = true;
        next.cb();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = target;
    },
  };
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

describe("week prefetch", () => {
  afterEach(() => {
    resetWeekPrefetchState();
  });

  it("waits, prefetches one week at a time, and skips a week that is still fresh", async () => {
    const clock = manualClock();
    const calls: string[] = [];
    const gates: Array<(completed: boolean) => void> = [];
    const stop = scheduleWeekPrefetch(
      ["/training?day=a", "/training?day=b", "/training?day=a"],
      (href) => {
        calls.push(href);
        let resolve: (completed: boolean) => void = () => undefined;
        const done = new Promise<boolean>((settle) => {
          resolve = settle;
        });
        gates.push(resolve);
        return { done, cancel: () => resolve(false) };
      },
      { delayMs: 1500, now: clock.now, timers: clock.timers },
    );

    expect(calls).toEqual([]);
    await clock.advance(1499);
    expect(calls).toEqual([]);
    await clock.advance(1);
    expect(calls).toEqual(["/training?day=a"]);
    await clock.advance(5000);
    expect(calls).toEqual(["/training?day=a"]);

    gates[0]?.(true);
    await flush();
    expect(calls).toEqual(["/training?day=a", "/training?day=b"]);
    stop();

    const again: string[] = [];
    scheduleWeekPrefetch(["/training?day=a", "/training?day=c"], (href) => {
      again.push(href);
      return { done: Promise.resolve(true), cancel() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(again).toEqual(["/training?day=c"]);
    expect(freshPrefetchHrefs(["/training?day=c", ""], clock.now())).toEqual([]);
  });

  it("stops the chain without aborting, and a rejection is fetched again", async () => {
    const clock = manualClock();
    const calls: string[] = [];
    const cancels: string[] = [];
    const stop = scheduleWeekPrefetch(["/training?day=a", "/training?day=b"], (href) => {
      calls.push(href);
      let resolve: (completed: boolean) => void = () => undefined;
      const done = new Promise<boolean>((settle) => {
        resolve = settle;
      });
      return {
        done,
        cancel() {
          cancels.push(href);
          resolve(false);
        },
      };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });

    await clock.advance(1500);
    expect(calls).toEqual(["/training?day=a"]);
    stop();
    expect(cancels).toEqual(["/training?day=a"]);
    await flush();
    await clock.advance(5000);
    expect(calls).toEqual(["/training?day=a"]);
    expect(freshPrefetchHrefs(["/training?day=a"], clock.now())).toEqual(["/training?day=a"]);

    const retried: string[] = [];
    scheduleWeekPrefetch(["/training?day=a", "/training?day=b"], (href) => {
      retried.push(href);
      const failed = href.endsWith("a");
      return { done: Promise.resolve(!failed), cancel() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(retried).toEqual(["/training?day=a", "/training?day=b"]);
    expect(freshPrefetchHrefs(["/training?day=a", "/training?day=b"], clock.now())).toEqual(["/training?day=a"]);
  });

  it("prefetches a week again once the client cache window has passed", async () => {
    const clock = manualClock();
    const calls: string[] = [];
    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), cancel() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(calls).toEqual(["/training?day=a"]);

    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), cancel() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    expect(calls).toEqual(["/training?day=a"]);

    clock.set(clock.now() + WEEK_PREFETCH_STALE_MS);
    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), cancel() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(calls).toEqual(["/training?day=a", "/training?day=a"]);
  });

  it("does not abort, wrap fetch, or remember a rejected prefetch", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/week-prefetch.ts"), "utf8");
    expect(source).not.toContain("AbortController");
    expect(source).not.toMatch(/window\.fetch\s*=/);
    expect(source).not.toContain("next/dist");

    const clock = manualClock();
    const calls: string[] = [];
    const task = prefetchWeekRoute(
      {
        prefetch(href, options) {
          calls.push(href);
          expect(options).toEqual({ kind: "full" });
        },
      },
      "/training?day=a",
      { gapMs: 1500, timers: clock.timers },
    );
    expect(calls).toEqual(["/training?day=a"]);
    let settled: boolean | "pending" = "pending";
    void task.done.then((ok) => {
      settled = ok;
    });
    await clock.advance(1499);
    expect(settled).toBe("pending");
    task.cancel();
    await flush();
    expect(settled).toBe(false);
    expect(calls).toEqual(["/training?day=a"]);

    const rejected = prefetchWeekRoute(
      {
        prefetch() {
          throw new Error("prefetch failed");
        },
      },
      "/training?day=b",
      { timers: clock.timers },
    );
    await expect(rejected.done).resolves.toBe(false);

    const remembered: string[] = [];
    scheduleWeekPrefetch(["/training?day=b"], (href) => {
      remembered.push(href);
      const result: PrefetchTask = { done: Promise.resolve(false), cancel() {} };
      return result;
    }, { delayMs: 0, now: clock.now, timers: clock.timers });
    await clock.advance(0);
    await flush();
    expect(remembered).toEqual(["/training?day=b"]);
    expect(freshPrefetchHrefs(["/training?day=b"], clock.now())).toEqual(["/training?day=b"]);
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
    expect(loggedRepsFromInput("99")).toEqual({ value: 99, error: "" });
    expect(repsCapMessage("1000")).toBe("Reps max is 100.");
    expect(repsCapMessage("100")).toBe("");
    expect(repsCapMessage("100.")).toBe("");
  });

  it("applies 150 then 99 immediately and hides the note at 100", () => {
    expect(nextRepsEntry("150")).toEqual({
      reps: 100,
      error: "Reps max is 100.",
      display: "100",
    });
    expect(applyRepsEntries(["150", "99"])).toEqual({
      reps: 99,
      error: "",
      display: "99",
    });
    expect(applyRepsEntries(["150", "100"])).toEqual({
      reps: 100,
      error: "",
      display: "100",
    });
    expect(repsCapMessage("100")).toBe("");
    expect(repsCapMessage("99")).toBe("");
  });
});
