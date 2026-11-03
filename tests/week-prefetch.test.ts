import { afterEach, describe, expect, it } from "vitest";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { bindRepsCapInput, loggedCountMessage, loggedRepsFromInput, repsCapMessage } from "@/lib/logged-work";
import {
  WEEK_PREFETCH_STALE_MS,
  freshPrefetchHrefs,
  prefetchWeekRoute,
  resetWeekPrefetchState,
  scheduleWeekPrefetch,
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
        return { done, abort: () => resolve(false) };
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
      return { done: Promise.resolve(true), abort() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(again).toEqual(["/training?day=c"]);
    expect(freshPrefetchHrefs(["/training?day=c", ""], clock.now())).toEqual([]);
  });

  it("aborts the in-flight prefetch and does not start the next week", async () => {
    const clock = manualClock();
    const calls: string[] = [];
    const aborts: string[] = [];
    const stop = scheduleWeekPrefetch(["/training?day=a", "/training?day=b"], (href) => {
      calls.push(href);
      let resolve: (completed: boolean) => void = () => undefined;
      const done = new Promise<boolean>((settle) => {
        resolve = settle;
      });
      return {
        done,
        abort() {
          aborts.push(href);
          resolve(false);
        },
      };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });

    await clock.advance(1500);
    expect(calls).toEqual(["/training?day=a"]);
    stop();
    expect(aborts).toEqual(["/training?day=a"]);
    await flush();
    await clock.advance(5000);
    expect(calls).toEqual(["/training?day=a"]);
  });

  it("prefetches a week again once the client cache window has passed", async () => {
    const clock = manualClock();
    const calls: string[] = [];
    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), abort() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(calls).toEqual(["/training?day=a"]);

    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), abort() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    expect(calls).toEqual(["/training?day=a"]);

    clock.set(clock.now() + WEEK_PREFETCH_STALE_MS);
    scheduleWeekPrefetch(["/training?day=a"], (href) => {
      calls.push(href);
      return { done: Promise.resolve(true), abort() {} };
    }, { delayMs: 1500, now: clock.now, timers: clock.timers });
    await clock.advance(1500);
    await flush();
    expect(calls).toEqual(["/training?day=a", "/training?day=a"]);
  });

  it("waits for the full week body, and abort drops a follow-up prefetch", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const pending: Array<{
      init: RequestInit;
      push: (chunk: Uint8Array | null) => void;
    }> = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      let push: (chunk: Uint8Array | null) => void = () => undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          push = (chunk) => {
            if (chunk == null) controller.close();
            else controller.enqueue(chunk);
          };
        },
      });
      pending.push({ init: init ?? {}, push });
      return new Response(body, { status: 200, headers: { "content-type": "text/x-component" } });
    };
    const win = {
      location: { origin: "http://localhost:3000" },
      fetch: fakeFetch,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
    (globalThis as { window: typeof win }).window = win;
    const href = "/training?day=2026-11-10";
    try {
      let settled = false;
      const task = prefetchWeekRoute(
        {
          prefetch(target) {
            void win.fetch(target, {
              headers: { rsc: "1", "next-router-prefetch": "1" },
              priority: "low",
            }).then(async (response) => {
              const reader = response.body?.getReader();
              if (!reader) return;
              while (!(await reader.read()).done) {
                /* drain */
              }
            });
            queueMicrotask(() => {
              void win.fetch(target, { headers: { rsc: "1" }, priority: "low" }).then(async (response) => {
                const reader = response.body?.getReader();
                if (!reader) return;
                while (!(await reader.read()).done) {
                  /* drain */
                }
              });
            });
          },
        },
        href,
      );
      void task.done.then(() => {
        settled = true;
      });
      await flush();
      expect(pending).toHaveLength(2);
      pending[0]?.push(new Uint8Array([1]));
      pending[0]?.push(null);
      await flush();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(settled).toBe(false);

      pending[1]?.push(new Uint8Array([2]));
      pending[1]?.push(null);
      await expect(task.done).resolves.toBe(true);

      const follow = prefetchWeekRoute(
        {
          prefetch(target) {
            void win.fetch(target, { headers: { rsc: "1" }, priority: "low" });
          },
        },
        href,
      );
      await flush();
      const open = pending.length;
      follow.abort();
      await expect(follow.done).resolves.toBe(false);
      await expect(
        win.fetch(href, { headers: { rsc: "1" }, priority: "low" }),
      ).rejects.toThrow(/abort/i);
      const navigation = await win.fetch(href, { headers: { rsc: "1" }, priority: "auto" });
      expect(navigation.ok).toBe(true);
      expect(pending.length).toBe(open + 1);
    } finally {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window: unknown }).window = previousWindow;
    }
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

  it("hides the cap note when the field is set back to 100", () => {
    let notice = repsCapMessage("150");
    const listeners = new Set<() => void>();
    const node = {
      value: "150",
      addEventListener(_type: string, listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_type: string, listener: () => void) {
        listeners.delete(listener);
      },
    };
    bindRepsCapInput(node, () => {
      notice = "";
    });
    expect(notice).toBe("Reps max is 100.");
    node.value = "100";
    for (const listener of listeners) listener();
    expect(notice).toBe("");
    notice = repsCapMessage("101");
    node.value = "101";
    for (const listener of listeners) listener();
    expect(notice).toBe("Reps max is 100.");
    node.value = "99";
    for (const listener of listeners) listener();
    expect(notice).toBe("");
  });
});
