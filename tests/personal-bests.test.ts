import { describe, expect, it } from "vitest";
import {
  detectNewPrs,
  epley1rm,
  type DatedSetLike,
} from "@/lib/personal-bests";

const day = (iso: string) => new Date(iso);

function lift(
  name: string,
  load: number,
  reps: number,
  at: string,
  unit: "lb" | "kg" = "lb",
): DatedSetLike {
  return {
    exerciseName: name,
    reps,
    loadValue: load,
    loadUnit: unit,
    logMode: "load_reps",
    completed: true,
    performedAt: day(at),
  };
}

function interval(name: string, seconds: number, at: string): DatedSetLike {
  return {
    exerciseName: name,
    reps: null,
    loadValue: null,
    loadUnit: "lb",
    durationSeconds: seconds,
    logMode: "timed_round",
    completed: true,
    performedAt: day(at),
  };
}

function hold(name: string, seconds: number, at: string): DatedSetLike {
  return {
    exerciseName: name,
    reps: null,
    loadValue: null,
    loadUnit: "lb",
    durationSeconds: seconds,
    logMode: "timed",
    completed: true,
    performedAt: day(at),
  };
}

describe("personal record detection", () => {
  it("uses Epley estimated 1RM", () => {
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(100, 5)).toBe(116.7);
  });

  it("detects a heavier load as a heaviest PR", () => {
    const prior = [lift("Trap bar deadlift", 380, 3, "2026-09-01T12:00:00Z")];
    const next = [lift("Trap bar deadlift", 400, 3, "2026-09-22T12:00:00Z")];
    const prs = detectNewPrs(prior, next, "lb");
    expect(prs.some((row) => row.kind === "heaviest" && row.value === 400)).toBe(true);
    expect(prs.find((row) => row.kind === "heaviest")?.headline).toMatch(/400/);
  });

  it("detects more reps at the same weight", () => {
    const prior = [lift("Goblet squat", 40, 8, "2026-09-01T12:00:00Z", "lb")];
    const next = [lift("Goblet squat", 40, 12, "2026-09-22T12:00:00Z", "lb")];
    const prs = detectNewPrs(prior, next, "lb");
    expect(prs.some((row) => row.kind === "reps_at_weight" && row.value === 12)).toBe(true);
  });

  it("detects a higher estimated 1RM", () => {
    const prior = [lift("Bench press", 175, 3, "2026-09-01T12:00:00Z")];
    const next = [lift("Bench press", 155, 10, "2026-09-22T12:00:00Z")];
    const prs = detectNewPrs(prior, next, "lb");
    const e1 = prs.find((row) => row.kind === "e1rm");
    expect(e1).toBeTruthy();
    expect(e1!.value).toBeGreaterThan(epley1rm(175, 3));
  });

  it("detects a longer timed hold", () => {
    const prior = [hold("Front plank hold", 90, "2026-09-01T12:00:00Z")];
    const next = [hold("Front plank hold", 160, "2026-09-22T12:00:00Z")];
    const prs = detectNewPrs(prior, next, "lb");
    expect(prs.some((row) => row.kind === "longest" && row.value === 160)).toBe(true);
    expect(prs.find((row) => row.kind === "longest")?.headline).toBe("2:40");
  });

  it("tracks most rounds for bike intervals and never calls them a hold", () => {
    const prior = [
      interval("Assault bike 15/15", 15, "2026-09-01T12:00:00Z"),
      interval("Assault bike 15/15", 15, "2026-09-01T12:00:00Z"),
      interval("Assault bike 15/15", 15, "2026-09-01T12:00:00Z"),
    ];
    const next = [
      interval("Assault bike 15/15", 15, "2026-09-22T12:00:00Z"),
      interval("Assault bike 15/15", 15, "2026-09-22T12:00:00Z"),
      interval("Assault bike 15/15", 15, "2026-09-22T12:00:00Z"),
      interval("Assault bike 15/15", 15, "2026-09-22T12:00:00Z"),
    ];
    const prs = detectNewPrs(prior, next, "lb");
    expect(prs.some((row) => row.kind === "longest")).toBe(false);
    const rounds = prs.find((row) => row.kind === "most_rounds");
    expect(rounds?.value).toBe(4);
    expect(rounds?.headline).toBe("4 rounds");
  });

  it("does not treat bag interval work as a longest hold", () => {
    const next = [
      interval("Pad rounds", 180, "2026-09-22T12:00:00Z"),
      interval("Pad rounds", 180, "2026-09-22T12:00:00Z"),
    ];
    const prs = detectNewPrs([], next, "lb");
    expect(prs.some((row) => row.kind === "longest")).toBe(false);
    expect(prs.find((row) => row.kind === "most_rounds")?.value).toBe(2);
  });

  it("converts stored kg lifts into the athlete's lb preference", () => {
    const prior = [lift("Trap bar deadlift", 170, 3, "2026-09-01T12:00:00Z", "kg")];
    const next = [lift("Trap bar deadlift", 180, 3, "2026-09-22T12:00:00Z", "kg")];
    const prs = detectNewPrs(prior, next, "lb");
    const heavy = prs.find((row) => row.kind === "heaviest");
    expect(heavy?.unit).toBe("lb");
    expect(heavy?.headline.toLowerCase()).toContain("lb");
    expect(heavy?.detail.toLowerCase()).toContain("lb");
    expect(heavy?.detail.toLowerCase()).not.toContain("kg");
  });

  it("does not flag a repeat or a lighter set", () => {
    const prior = [lift("Trap bar deadlift", 400, 3, "2026-09-01T12:00:00Z")];
    const same = [lift("Trap bar deadlift", 400, 3, "2026-09-22T12:00:00Z")];
    const lighter = [lift("Trap bar deadlift", 375, 3, "2026-09-22T12:00:00Z")];
    expect(detectNewPrs(prior, same, "lb").filter((row) => row.kind === "heaviest")).toEqual([]);
    expect(detectNewPrs(prior, lighter, "lb").filter((row) => row.kind === "heaviest")).toEqual([]);
  });
});
