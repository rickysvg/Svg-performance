import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bikeTimerHref,
  isBikePlanSession,
  isBikeTimerHref,
  timerEntryModeFromText,
} from "@/lib/timer-session";

describe("timer session routing", () => {
  it("sends bike sessions to the bike clock and other rounds to their mode", () => {
    expect(timerEntryModeFromText("Cardio — bike")).toBe("bike");
    expect(timerEntryModeFromText("Assault bike intervals")).toBe("bike");
    expect(timerEntryModeFromText("Jump rope or easy bike intervals")).toBeNull();
    expect(timerEntryModeFromText("Sparring rounds")).toBe("sparring");
    expect(timerEntryModeFromText("Pad rounds")).toBe("pads");
    expect(timerEntryModeFromText("Grappling rounds")).toBe("grappling");
    expect(timerEntryModeFromText("Heavy bag rounds")).toBe("bag");
    expect(timerEntryModeFromText("Full body strength")).toBeNull();
    expect(
      isBikePlanSession({
        title: "Cardio — bike",
        label: "Cardio — bike",
        day: { title: "Day 5 — Daru Alactic Power", focus: "Daru alactic power bike", exercises: [] },
      }),
    ).toBe(true);
    expect(isBikePlanSession({ title: "Easy cardio", label: "Easy cardio" })).toBe(false);
    expect(bikeTimerHref("day-1")).toBe("/timer?mode=bike&day=day-1");
    expect(isBikeTimerHref("/timer?mode=bike&day=day-1")).toBe(true);
    expect(isBikeTimerHref("/timer")).toBe(false);
  });

  it("keeps the frozen session clock off the server clock until mount", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    const timer = source.slice(source.indexOf("function SessionTimer"), source.indexOf("export function WorkoutLogForm"));
    expect(timer).toContain("useSyncExternalStore");
    expect(timer).not.toContain("useState(() => Date.now())");
    expect(timer).toContain("resolveSessionElapsed");
    expect(timer).toContain("elapsedSeconds");
  });

  it("titles the bike clock Bike and picks seconds on the generic timer", () => {
    const clock = fs.readFileSync(
      path.join(process.cwd(), "src/components/timer/BikeClockScreen.tsx"),
      "utf8",
    );
    const timer = fs.readFileSync(path.join(process.cwd(), "src/components/timer/RoundTimer.tsx"), "utf8");
    const picks = fs.readFileSync(
      path.join(process.cwd(), "src/components/timer/TimerDurationFields.tsx"),
      "utf8",
    );
    expect(clock).toContain("data-timer-title");
    expect(clock).toContain(">Bike<");
    expect(clock).not.toContain("Sparring");
    expect(timer).toContain("TimerDurationFields");
    expect(timer).not.toContain("Work min");
    expect(picks).toContain("data-timer-pick={field}");
    expect(picks).toContain("formatDurationPick");
    expect(picks).toContain("data-timer-picker-option");
  });
});
