import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BAG_ROUND_COUNTS_ADVANCED_LONG, bagFocusFor, isAdvancedLongBagDay } from "@/lib/bag-sessions";
import { findSkillProgram } from "@/lib/programs";
import { prisma } from "@/lib/prisma";
import {
  bagFocusLines,
  formatBagRoundNotes,
  SHADOW_EMPTY_NAME,
  SHADOW_WEIGHTED_NAME,
} from "@/lib/bag-themes";
import { hidesLoad } from "@/lib/exercise-log-mode";
import {
  MESO_BLOCKS,
  mesoBlockForWeekIndex,
  mesoBlockLabel,
  strengthDaysForWeek,
} from "@/lib/mesocycle";
import { coreSkeletonSessions } from "@/lib/week-plan";
import { scaleExercise } from "@/lib/training-scale";
import { resetDatabase } from "./helpers";

const BAG_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

describe("3-week mesocycle", () => {
  it("maps week index 0, 1, 2, 3 onto blocks A, B, C, A", () => {
    expect(mesoBlockForWeekIndex(0)).toBe("A");
    expect(mesoBlockForWeekIndex(1)).toBe("B");
    expect(mesoBlockForWeekIndex(2)).toBe("C");
    expect(mesoBlockForWeekIndex(3)).toBe("A");
    expect(mesoBlockForWeekIndex(-1)).toBe("C");
    expect(mesoBlockLabel("A")).toMatch(/Block A/);
    expect(mesoBlockLabel("B")).toMatch(/Level changes/);
    expect(mesoBlockLabel("C")).toMatch(/Traps/);
  });

  it("keeps the weekday skeleton and swaps bag and lift day numbers by block", () => {
    const monA = coreSkeletonSessions("Monday", "mma", 0);
    const wedA = coreSkeletonSessions("Wednesday", "mma", 0);
    const monB = coreSkeletonSessions("Monday", "mma", 1);
    const monC = coreSkeletonSessions("Monday", "mma", 2);
    const monAgain = coreSkeletonSessions("Monday", "mma", 3);

    expect(monA.map((session) => session.kind)).toEqual(["skill", "strength"]);
    expect(monA[0]?.dayNumber).toBe(bagFocusFor("Monday", "A").dayNumber);
    expect(wedA[0]?.dayNumber).toBe(bagFocusFor("Wednesday", "A").dayNumber);
    expect(monA[0]?.dayNumber).not.toBe(wedA[0]?.dayNumber);
    expect(monA[0]?.label).not.toBe(wedA[0]?.label);
    expect(monB[0]?.dayNumber).toBe(7);
    expect(monC[0]?.dayNumber).toBe(13);
    expect(monAgain[0]?.dayNumber).toBe(monA[0]?.dayNumber);
    expect(monB[1]?.dayNumber).toBe(strengthDaysForWeek(1).monday);
    expect(monB[1]?.dayNumber).not.toBe(monA[1]?.dayNumber);

    const tue = coreSkeletonSessions("Tuesday", "mma", 1);
    const thu = coreSkeletonSessions("Thursday", "mma", 1);
    expect(tue.map((session) => session.kind)).toEqual(["skill", "strength", "conditioning"]);
    expect(thu[1]?.dayNumber).toBe(strengthDaysForWeek(1).thursday);
    expect(thu[2]?.kind).toBe("conditioning");
    expect(coreSkeletonSessions("Friday", "mma", 2)[1]?.dayNumber).toBe(strengthDaysForWeek(2).friday);
  });

  it("writes a distinct themed round list for every weekday and block", () => {
    const labels = new Set<string>();
    for (const block of MESO_BLOCKS) {
      for (const weekday of BAG_WEEKDAYS) {
        const plan = bagFocusFor(weekday, block);
        labels.add(plan.label);
        const needed = isAdvancedLongBagDay(plan.dayNumber) ? BAG_ROUND_COUNTS_ADVANCED_LONG : 10;
        expect(plan.rounds.length).toBeGreaterThanOrEqual(needed);
        expect(plan.rounds[0]?.toLowerCase()).not.toMatch(/freestyle/);
        expect(plan.bagName.toLowerCase()).toMatch(/bag rounds/);
        if (weekday !== "Saturday") {
          expect(plan.technique?.name.length).toBeGreaterThan(0);
        }
      }
      expect(bagFocusFor("Monday", block).theme).not.toBe(bagFocusFor("Wednesday", block).theme);
    }
    expect(labels.size).toBe(18);
  });

  it("splits stored bag notes into one line per focus round", () => {
    const notes = formatBagRoundNotes(["Touch jab only.", "Double jab."]);
    expect(bagFocusLines(notes)).toEqual({
      rounds: ["R1 Touch jab only.", "R2 Double jab."],
      credit: true,
    });
    expect(bagFocusLines("Hold a dumbbell at your chest.")).toBeNull();
  });
});

describe("weighted shadow on seeded bag days", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores an empty-hand round and a hand-weight round that keeps lbs", async () => {
    const skill = await findSkillProgram();
    expect(skill?.days.length).toBe(18);
    for (const day of skill?.days ?? []) {
      const names = day.exercises.map((row) => row.name);
      expect(names).toContain(SHADOW_EMPTY_NAME);
      expect(names).toContain(SHADOW_WEIGHTED_NAME);
      const weighted = day.exercises.find((row) => row.name === SHADOW_WEIGHTED_NAME);
      const empty = day.exercises.find((row) => row.name === SHADOW_EMPTY_NAME);
      expect(empty?.logMode).toBe("timed");
      expect(weighted?.logMode).toBe("load_timed");
      expect(weighted?.reps).toMatch(/3:00/);
      expect(hidesLoad("load_timed")).toBe(false);
      const bag = day.exercises.find((row) => /bag rounds/i.test(row.name));
      expect(bag?.notes).toMatch(/R1 /);
      expect(bag?.notes).toMatch(/Bazooka Joe/);
      expect(bag?.notes.toLowerCase()).not.toMatch(/\bbout\b/);
    }

    const scaled = scaleExercise(
      {
        name: SHADOW_WEIGHTED_NAME,
        sets: 1,
        reps: "3:00",
        loadText: "1–3 lb hand weights",
        restSeconds: 45,
        logMode: "load_timed",
      },
      { band: "intermediate", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(scaled.logMode).toBe("load_timed");
    expect(scaled.sets).toBe(1);
    expect(scaled.reps).toBe("3:00");
    expect(scaled.reps).not.toMatch(/35–45 sec/);
  });
});
