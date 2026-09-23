import { describe, expect, it } from "vitest";
import {
  fallbackLogMode,
  parseDurationSeconds,
  plannedSetLine,
  resolveLogMode,
} from "@/lib/exercise-log-mode";
import { previousSetLabel } from "@/lib/exercise-media";

describe("exercise log modes", () => {
  it("uses the stored field first, then name heuristics", () => {
    expect(resolveLogMode({ logMode: "timed", name: "Goblet squat" })).toBe("timed");
    expect(fallbackLogMode("Front plank")).toBe("timed");
    expect(fallbackLogMode("Side plank")).toBe("timed");
    expect(fallbackLogMode("Wall sit")).toBe("timed");
    expect(fallbackLogMode("Hollow hold")).toBe("timed");
    expect(fallbackLogMode("Dead hang")).toBe("timed");
    expect(fallbackLogMode("Jab–cross (1–2)")).toBe("timed_round");
    expect(fallbackLogMode("Low kick (roundhouse)")).toBe("timed_round");
    expect(fallbackLogMode("Closed guard hip tilt")).toBe("timed_round");
    expect(fallbackLogMode("Goblet squat")).toBe("load_reps");
    expect(fallbackLogMode("Chin-up, band-assist, or lat pulldown")).toBe("reps_only");
  });

  it("parses clocks and written seconds", () => {
    expect(parseDurationSeconds("3:00")).toBe(180);
    expect(parseDurationSeconds("2:30")).toBe(150);
    expect(parseDurationSeconds("45")).toBe(45);
    expect(parseDurationSeconds("30–45 sec")).toBe(30);
    expect(parseDurationSeconds("2:00 rounds")).toBe(120);
  });

  it("writes hold / round planned lines instead of lbs × reps", () => {
    expect(
      plannedSetLine({
        sets: 3,
        reps: "45–60 sec",
        restSeconds: 30,
        logMode: "timed",
        name: "Front plank",
      }),
    ).toBe("3 holds × 45–60 sec, 30s rest");
    expect(
      plannedSetLine({
        sets: 3,
        reps: "3:00",
        restSeconds: 45,
        logMode: "timed_round",
        name: "Jab–cross (1–2)",
      }),
    ).toBe("3 rounds × 3:00, 45s rest");
  });

  it("labels previous timed sets as hold or round time", () => {
    expect(
      previousSetLabel({
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed",
        durationSeconds: 45,
      }),
    ).toBe("45s hold");
    expect(
      previousSetLabel({
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed_round",
        durationSeconds: 180,
      }),
    ).toBe("180s round");
  });
});
