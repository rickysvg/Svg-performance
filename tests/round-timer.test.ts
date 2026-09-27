import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTimerTimeline,
  configForPreset,
  formatTimerClock,
  parseStoredCustom,
  parseStoredTimerPrefs,
  resolveTimer,
  shouldPlayPhaseBell,
  shouldPlayWarningBeep,
  TIMER_CUSTOM_STORAGE_KEY,
} from "@/lib/round-timer";

const CONFIG_3X3 = configForPreset("3x3");

describe("round timer phase math", () => {
  it("builds work/rest slots and skips rest after the last round", () => {
    const timeline = buildTimerTimeline({ rounds: 3, workSeconds: 180, restSeconds: 60 });
    expect(timeline).toEqual([
      { phase: "work", round: 1, durationSeconds: 180 },
      { phase: "rest", round: 1, durationSeconds: 60 },
      { phase: "work", round: 2, durationSeconds: 180 },
      { phase: "rest", round: 2, durationSeconds: 60 },
      { phase: "work", round: 3, durationSeconds: 180 },
    ]);
    expect(timeline.some((slot) => slot.phase === "rest" && slot.round === 3)).toBe(false);
  });

  it("stays idle until a start timestamp exists", () => {
    const resolved = resolveTimer({
      config: CONFIG_3X3,
      startedAtMs: null,
      nowMs: 10_000,
    });
    expect(resolved.phase).toBe("idle");
    expect(resolved.round).toBe(1);
    expect(resolved.remainingSeconds).toBe(180);
    expect(resolved.phaseProgress).toBe(0);
    expect(resolved.nextLabel).toMatch(/Rest 1:00 · then round 2/);
  });

  it("walks work → rest → work from timestamps without interval drift", () => {
    const startedAtMs = 1_000_000;
    const work = resolveTimer({
      config: CONFIG_3X3,
      startedAtMs,
      nowMs: startedAtMs + 66_000,
    });
    expect(work.phase).toBe("work");
    expect(work.round).toBe(1);
    expect(work.remainingSeconds).toBe(114);
    expect(work.nextLabel).toMatch(/then round 2/);

    const rest = resolveTimer({
      config: CONFIG_3X3,
      startedAtMs,
      nowMs: startedAtMs + 180_000 + 1_000,
    });
    expect(rest.phase).toBe("rest");
    expect(rest.round).toBe(1);
    expect(rest.remainingSeconds).toBe(59);
    expect(rest.nextLabel).toBe("Round 2");

    const roundTwo = resolveTimer({
      config: CONFIG_3X3,
      startedAtMs,
      nowMs: startedAtMs + 240_000,
    });
    expect(roundTwo.phase).toBe("work");
    expect(roundTwo.round).toBe(2);
    expect(roundTwo.remainingSeconds).toBe(180);
  });

  it("freezes while paused and resumes from accumulated pause time", () => {
    const startedAtMs = 5_000;
    const pausedAtMs = startedAtMs + 20_000;
    const paused = resolveTimer({
      config: { rounds: 2, workSeconds: 60, restSeconds: 30 },
      startedAtMs,
      pausedAtMs,
      nowMs: pausedAtMs + 40_000,
    });
    expect(paused.phase).toBe("work");
    expect(paused.remainingSeconds).toBe(40);

    const resumed = resolveTimer({
      config: { rounds: 2, workSeconds: 60, restSeconds: 30 },
      startedAtMs,
      pausedAtMs: null,
      pauseAccumulatedMs: 40_000,
      nowMs: pausedAtMs + 40_000 + 5_000,
    });
    expect(resumed.phase).toBe("work");
    expect(resumed.remainingSeconds).toBe(35);
  });

  it("marks the session done after the last work block", () => {
    const startedAtMs = 0;
    const totalMs = (180 + 60 + 180 + 60 + 180) * 1000;
    const done = resolveTimer({
      config: CONFIG_3X3,
      startedAtMs,
      nowMs: totalMs,
    });
    expect(done.phase).toBe("done");
    expect(done.remainingSeconds).toBe(0);
    expect(done.round).toBe(3);
    expect(done.nextLabel).toBe("Rounds complete");
    expect(done.sessionProgress).toBe(1);
  });

  it("recomputes the same phase after a long background gap", () => {
    const startedAtMs = 8_000;
    const beforeLock = resolveTimer({
      config: configForPreset("5x5"),
      startedAtMs,
      nowMs: startedAtMs + 12_000,
    });
    const afterResume = resolveTimer({
      config: configForPreset("5x5"),
      startedAtMs,
      nowMs: startedAtMs + 12_000,
    });
    expect(afterResume).toEqual(beforeLock);
    expect(formatTimerClock(afterResume.remainingSeconds)).toBe("4:48");
  });

  it("beeps at 10 seconds and rings on work/rest edges", () => {
    expect(shouldPlayWarningBeep(11, 10)).toBe(true);
    expect(shouldPlayWarningBeep(10, 9)).toBe(false);
    expect(shouldPlayWarningBeep(12, 11)).toBe(false);
    expect(shouldPlayPhaseBell("work", "rest")).toBe(true);
    expect(shouldPlayPhaseBell("rest", "work")).toBe(true);
    expect(shouldPlayPhaseBell("work", "done")).toBe(true);
    expect(shouldPlayPhaseBell("idle", "work")).toBe(true);
    expect(shouldPlayPhaseBell("work", "work")).toBe(false);
  });

  it("restores last custom settings and never uses the word bout", () => {
    expect(parseStoredCustom(null)).toEqual({
      rounds: 3,
      workSeconds: 180,
      restSeconds: 60,
    });
    expect(
      parseStoredCustom(JSON.stringify({ rounds: 8, workSeconds: 120, restSeconds: 45 })),
    ).toEqual({ rounds: 8, workSeconds: 120, restSeconds: 45 });
    const prefs = parseStoredTimerPrefs(
      JSON.stringify({ mode: "pads", preset: "custom", warningBeep: false, custom: { rounds: 4 } }),
    );
    expect(prefs.mode).toBe("pads");
    expect(prefs.preset).toBe("custom");
    expect(prefs.warningBeep).toBe(false);
    expect(prefs.bell).toBe(true);
    expect(prefs.custom.rounds).toBe(4);

    const files = [
      "src/lib/round-timer.ts",
      "src/components/timer/RoundTimer.tsx",
      "src/app/(member)/timer/page.tsx",
    ];
    for (const rel of files) {
      const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(text.toLowerCase()).not.toContain("bout");
      expect(text).toContain(rel.includes("round-timer.ts") ? TIMER_CUSTOM_STORAGE_KEY : "Round");
    }
  });
});
