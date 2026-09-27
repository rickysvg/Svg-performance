import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countBagRounds,
  countGrapplingRounds,
  countPadRounds,
  countSparringRounds,
  evaluateBadges,
  isBagRound,
  isGrapplingRound,
  isPadRound,
  isSparringRound,
  type BadgeSetLike,
} from "@/lib/badges";

function round(name: string, at = "2026-09-01T12:00:00.000Z"): BadgeSetLike {
  return {
    exerciseName: name,
    loadValue: null,
    loadUnit: "lb",
    durationSeconds: 180,
    logMode: "timed_round",
    completed: true,
    performedAt: new Date(at),
  };
}

describe("martial arts round counting", () => {
  it("splits pad, bag, sparring, and grappling rounds", () => {
    expect(isPadRound("Pad rounds", "timed_round")).toBe(true);
    expect(isPadRound("Thai pads", "timed_round")).toBe(true);
    expect(isPadRound("Heavy bag rounds", "timed_round")).toBe(false);
    expect(isBagRound("Heavy bag rounds", "timed_round")).toBe(true);
    expect(isBagRound("1-2-3 bag rounds", "timed_round")).toBe(true);
    expect(isBagRound("Pad rounds", "timed_round")).toBe(false);
    expect(isSparringRound("Sparring rounds", "timed_round")).toBe(true);
    expect(isGrapplingRound("Grappling rounds", "timed_round")).toBe(true);
    expect(isGrapplingRound("Rolling rounds", "timed_round")).toBe(true);
    expect(isPadRound("Sparring rounds", "timed_round")).toBe(false);
    expect(isBagRound("Grappling rounds", "timed_round")).toBe(false);

    const sets = [
      ...Array.from({ length: 3 }, () => round("Pad rounds")),
      ...Array.from({ length: 5 }, () => round("Heavy bag rounds")),
      ...Array.from({ length: 2 }, () => round("Sparring rounds")),
      ...Array.from({ length: 4 }, () => round("Grappling rounds")),
    ];
    expect(countPadRounds(sets)).toBe(3);
    expect(countBagRounds(sets)).toBe(5);
    expect(countSparringRounds(sets)).toBe(2);
    expect(countGrapplingRounds(sets)).toBe(4);

    const badges = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      sets,
    });
    expect(badges.find((row) => row.id === "pads_250")?.progressCurrent).toBe(3);
    expect(badges.find((row) => row.id === "bag_250")?.progressCurrent).toBe(5);
    expect(badges.find((row) => row.id === "sparring_50")?.progressCurrent).toBe(2);
    expect(badges.find((row) => row.id === "grappling_50")?.progressCurrent).toBe(4);
  });

  it("does not count bag work toward pads_250", () => {
    const sets = Array.from({ length: 250 }, () => round("Heavy bag"));
    const badges = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      sets,
    });
    expect(badges.find((row) => row.id === "pads_250")?.earned).toBe(false);
    expect(badges.find((row) => row.id === "bag_250")?.earned).toBe(true);
  });

  it("lets athletes log sparring and grappling rounds from the logger and timer", () => {
    const logger = fs.readFileSync(path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"), "utf8");
    const timer = fs.readFileSync(path.join(process.cwd(), "src/components/timer/RoundTimer.tsx"), "utf8");
    const modes = fs.readFileSync(path.join(process.cwd(), "src/lib/round-timer.ts"), "utf8");
    expect(logger).toContain("Sparring rounds");
    expect(logger).toContain("Grappling rounds");
    expect(timer).toContain("grappling");
    expect(timer).toContain("startRoundLogAction");
    expect(timer.toLowerCase()).not.toContain("bout");
    expect(modes).toContain("grappling");
    expect(modes.toLowerCase()).not.toContain("bout");
  });
});
