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
    expect(fallbackLogMode("Romanian deadlift")).toBe("load_reps");
    expect(fallbackLogMode("Overhead press")).toBe("load_reps");
    expect(fallbackLogMode("One-arm row")).toBe("load_reps");
    expect(fallbackLogMode("Farmer carry")).toBe("load_timed");
    expect(fallbackLogMode("Suitcase carry")).toBe("load_timed");
    expect(fallbackLogMode("Overhead carry")).toBe("load_timed");
    expect(fallbackLogMode("Rack carry")).toBe("load_timed");
    expect(fallbackLogMode("Weighted hold")).toBe("load_timed");
    expect(fallbackLogMode("Kettlebell swing or hip hinge")).toBe("load_reps");
    expect(fallbackLogMode("Reverse lunge")).toBe("load_reps");
    expect(fallbackLogMode("Push-up or dumbbell bench press")).toBe("load_reps");
    expect(fallbackLogMode("Chin-up, band-assist, or lat pulldown")).toBe("reps_only");
    expect(fallbackLogMode("Band pull-apart or face pull")).toBe("reps_only");
    expect(fallbackLogMode("Squat jump or box step-up")).toBe("reps_only");
    expect(fallbackLogMode("Lateral bound or side step-over")).toBe("reps_only");
    expect(fallbackLogMode("Jump rope or easy bike intervals")).toBe("timed");
    expect(fallbackLogMode("Assault bike intervals")).toBe("timed_round");
    expect(fallbackLogMode("Daru alactic power bike")).toBe("timed_round");
    expect(fallbackLogMode("Farmer's carry")).toBe("load_timed");
    expect(fallbackLogMode("Sled push")).toBe("timed");
    expect(fallbackLogMode("Banded kettlebell swing")).toBe("timed");
    expect(fallbackLogMode("Neck extension hold")).toBe("timed");
    expect(fallbackLogMode("Floor press")).toBe("load_reps");
    expect(fallbackLogMode("Trap-bar deadlift")).toBe("load_reps");
    expect(fallbackLogMode("Rotational med-ball throw")).toBe("load_reps");
    expect(fallbackLogMode("Mountain climbers")).toBe("timed");
    expect(fallbackLogMode("Burpees")).toBe("timed");
    expect(fallbackLogMode("Unknown mobility flow")).toBe("timed");
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
        sets: 8,
        reps: "20 sec on / 40 sec easy",
        restSeconds: 0,
        logMode: "timed",
        name: "Jump rope or easy bike intervals",
      }),
    ).toBe("8 sets × 20 sec on / 40 sec easy");
    expect(
      plannedSetLine({
        sets: 3,
        reps: "3:00",
        restSeconds: 45,
        logMode: "timed_round",
        name: "Jab–cross (1–2)",
      }),
    ).toBe("3 rounds × 3:00, 45s rest");
    expect(
      plannedSetLine({
        sets: 4,
        reps: "15s work / 15s rest × 8",
        restSeconds: 60,
        logMode: "timed_round",
        name: "Assault bike intervals",
      }),
    ).toBe("4 rounds · 15s work / 15s rest × 8, 60s between rounds");
    expect(
      plannedSetLine({
        sets: 3,
        reps: "30–40 sec",
        restSeconds: 90,
        logMode: "load_timed",
        name: "Farmer carry",
      }),
    ).toBe("3 × 30–40s @ lbs, 90s rest");
  });

  it("uses singular units for one set and labels a single timed clock as continuous", () => {
    expect(
      plannedSetLine({
        sets: 1,
        reps: "10s work / 50s rest × 4",
        restSeconds: 0,
        logMode: "timed_round",
        name: "Daru alactic power bike",
      }),
    ).toBe("1 round · 10s work / 50s rest × 4");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "15:00",
        restSeconds: 0,
        logMode: "timed",
        name: "Sled hamstring drag",
      }),
    ).toBe("15:00 continuous");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "10:00",
        restSeconds: 0,
        logMode: "timed",
        name: "Sled hamstring drag",
      }),
    ).toBe("10:00 continuous");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "45–60 sec",
        restSeconds: 30,
        logMode: "timed",
        name: "Front plank",
      }),
    ).toBe("1 hold × 45–60 sec, 30s rest");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "20 sec on / 40 sec easy",
        restSeconds: 0,
        logMode: "timed",
        name: "Jump rope or easy bike intervals",
      }),
    ).toBe("1 set × 20 sec on / 40 sec easy");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "3:00",
        restSeconds: 45,
        logMode: "timed_round",
        name: "Jab–cross (1–2)",
      }),
    ).toBe("1 round × 3:00, 45s rest");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "8",
        restSeconds: 90,
        logMode: "load_reps",
      }),
    ).toBe("1 set × 8, 90s rest");
    expect(
      plannedSetLine({
        sets: 5,
        reps: "15s work / 15s rest × 8",
        restSeconds: 60,
        logMode: "timed_round",
        name: "Assault bike intervals",
      }),
    ).toBe("5 rounds · 15s work / 15s rest × 8, 60s between rounds");
    expect(
      plannedSetLine({
        sets: 5,
        reps: "25 sec",
        restSeconds: 60,
        logMode: "timed",
        name: "Sled push",
      }),
    ).toBe("5 sets × 25 sec, 60s rest");
    expect(
      plannedSetLine({
        sets: 1,
        reps: "15:00",
        restSeconds: 90,
        logMode: "timed",
        name: "Sled hamstring drag",
      }),
    ).toBe("1 set × 15:00, 90s rest");
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
    expect(
      previousSetLabel({
        reps: null,
        loadValue: 70,
        loadUnit: "lb",
        logMode: "load_timed",
        durationSeconds: 40,
      }),
    ).toBe("40s × 70lb");
  });
});
