import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addZonedDays, zonedCivilToUtc } from "@/lib/timezone";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { BIKE_SESSIONS, bikeEnergyCopy } from "@/lib/bike-sessions";
import {
  DELOAD_EVERY_WEEKS,
  TESTING_EVERY_WEEKS,
  deloadSetCount,
  isDeloadWeek,
  isDeloadWeekIndex,
  isTestingWeek,
  isTestingWeekIndex,
} from "@/lib/training-cycle";
import { planForDate, weekdayInAppZone } from "@/lib/week-plan";
import { readinessIsLow, readinessSuggestion } from "@/lib/readiness";
import { plyoBlockFor } from "@/lib/training-emphasis";
import { planHasFeature } from "@/lib/plans";
import {
  FREE_ROUTINE_IDS,
  MOBILITY_ROUTINES,
  collectCreditUrls,
  expandPlaySteps,
  flexibilityWeekNumber,
  getMobilityRoutine,
  kickGapOver10,
  sideGapOver10,
} from "@/lib/mobility";
import { checkInGaps, previousMobilityLogs, saveMobilitySession } from "@/lib/mobility-store";
import { makeUser, resetDatabase } from "./helpers";

const prefs = {
  primaryFocus: "mma",
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
};

function mondayAfterEpoch(weeks: number, timeZone = "America/Denver") {
  const epoch = zonedCivilToUtc(2026, 1, 5, timeZone);
  return addZonedDays(epoch, weeks * 7, timeZone);
}

describe("deload and testing weeks", () => {
  it("deload lands on every 4th week and testing on every 8th", () => {
    expect(DELOAD_EVERY_WEEKS).toBe(4);
    expect(TESTING_EVERY_WEEKS).toBeGreaterThanOrEqual(8);
    expect(TESTING_EVERY_WEEKS).toBeLessThanOrEqual(12);
    for (const index of [0, 1, 2, 3, 4, 7, 8, 11]) {
      expect(isDeloadWeekIndex(index)).toBe(index % 4 === 3);
      expect(isTestingWeekIndex(index)).toBe(index % 8 === 0);
    }
    const deloadMonday = mondayAfterEpoch(3);
    const normalMonday = mondayAfterEpoch(1);
    const testMonday = mondayAfterEpoch(8);
    expect(bikeWeekIndex(deloadMonday, "America/Denver") % 4).toBe(3);
    expect(isDeloadWeek(deloadMonday, "America/Denver")).toBe(true);
    expect(isDeloadWeek(normalMonday, "America/Denver")).toBe(false);
    expect(isTestingWeek(testMonday, "America/Denver")).toBe(true);
    expect(isTestingWeek(normalMonday, "America/Denver")).toBe(false);
    expect(deloadSetCount(5)).toBe(3);
    expect(deloadSetCount(1)).toBe(1);
  });

  it("uses the athlete time zone around a Monday boundary", () => {
    const instant = new Date("2026-09-28T05:30:00.000Z");
    expect(weekdayInAppZone(instant, "America/Denver")).toBe("Sunday");
    expect(weekdayInAppZone(instant, "Australia/Sydney")).toBe("Monday");
    const denver = bikeWeekIndex(instant, "America/Denver");
    const sydney = bikeWeekIndex(instant, "Australia/Sydney");
    expect(sydney).not.toBe(denver);
    expect(isDeloadWeek(instant, "America/Denver")).toBe(isDeloadWeekIndex(denver));
    expect(isTestingWeek(instant, "Australia/Sydney")).toBe(isTestingWeekIndex(sydney));
    expect(planForDate(prefs, instant, "America/Denver").weekday).toBe("Sunday");
    expect(planForDate(prefs, instant, "Australia/Sydney").weekday).toBe("Monday");
    expect(planForDate(prefs, instant, "America/Denver").sessions[0]?.kind).toBe("rest");
  });

  it("does not rewrite the written plan when readiness is low", () => {
    const low = { sleep: 1, soreness: 2, energy: 2 };
    expect(readinessIsLow(low)).toBe(true);
    expect(readinessSuggestion(low)).toMatch(/does not change|stays as it is/i);
    const before = planForDate(prefs, mondayAfterEpoch(1), "America/Denver");
    expect(before.summary).toBe("Bag+Lift");
    expect(before.sessions).toHaveLength(2);
    expect(readinessSuggestion({ sleep: 5, soreness: 5, energy: 4 })).toBeNull();
  });
});

describe("bike zones, plyo emphasis, and mobility gating", () => {
  it("tags all six bike sessions as Aerobic Base, Threshold, or Sprint", () => {
    expect(BIKE_SESSIONS).toHaveLength(6);
    const labels = new Set(BIKE_SESSIONS.map((session) => bikeEnergyCopy(session.energyZone).label));
    expect(labels).toEqual(new Set(["Aerobic Base", "Threshold", "Sprint"]));
    expect(bikeEnergyCopy("aerobic-base").guide).toMatch(/130/);
    expect(bikeEnergyCopy("sprint").guide).toMatch(/max/i);
  });

  it("shifts accessories for strikers and grapplers without dropping the landing drill", () => {
    const striker = plyoBlockFor("striker").map((row) => row.name);
    const grappler = plyoBlockFor("grappler").map((row) => row.name);
    expect(striker[0]).toMatch(/land/i);
    expect(grappler[0]).toMatch(/land/i);
    expect(striker[1]).toMatch(/pogo/i);
    expect(grappler[1]).toMatch(/pogo/i);
    expect(striker.join(" ")).toMatch(/Lunge to a high knee/);
    expect(striker.join(" ")).toMatch(/Jump squats/);
    expect(grappler.join(" ")).toMatch(/Farmer carry/);
    expect(striker).not.toEqual(grappler);
  });

  it("keeps two routines and the warm-up free, and the progression on Performance", () => {
    expect(FREE_ROUTINE_IDS).toEqual(expect.arrayContaining(["kickers-hips", "cooldown", "daily-warmup"]));
    expect(getMobilityRoutine("split-builder")?.access).toBe("pro");
    expect(planHasFeature("member_access", "mobility_pro")).toBe(false);
    expect(planHasFeature("performance", "mobility_pro")).toBe(true);
    expect(planHasFeature("fighter_conditioning", "mobility_pro")).toBe(true);
    const blob = JSON.stringify(MOBILITY_ROUTINES);
    expect(blob.toLowerCase()).not.toMatch(/\bbouts?\b/);
    const banned = ["HiCnRk1_z5Q", "5kM-o61Z14I", "freeletics.com", "h_VjN6bzgwU"];
    for (const url of collectCreditUrls()) {
      for (const id of banned) expect(url).not.toContain(id);
    }
    const steps = expandPlaySteps(getMobilityRoutine("kickers-hips")!);
    expect(steps.some((step) => step.side === "left")).toBe(true);
    expect(steps.some((step) => step.side === "right")).toBe(true);
    expect(steps[0]?.nextName).toBeTruthy();
  });

  it("flags a left/right gap over 10% and walks the 6-week cycle", () => {
    expect(sideGapOver10(10, 12)).toBe(true);
    expect(sideGapOver10(10, 10.5)).toBe(false);
    expect(kickGapOver10("belt", "head")).toBe(true);
    expect(kickGapOver10("head", "head")).toBe(false);
    expect(
      checkInGaps({
        frontSplitLeft: 20,
        frontSplitRight: 10,
        hipLeft: 2,
        hipRight: 2,
        ankleLeft: 8,
        ankleRight: 8,
        kickFrontLeft: "chest",
        kickFrontRight: "chest",
        kickSideLeft: "belt",
        kickSideRight: "belt",
      }).frontSplit,
    ).toBe(true);
    const anchor = zonedCivilToUtc(2026, 9, 7, "America/Denver");
    expect(flexibilityWeekNumber(anchor, anchor, "America/Denver")).toBe(1);
    expect(
      flexibilityWeekNumber(anchor, addZonedDays(anchor, 14, "America/Denver"), "America/Denver"),
    ).toBe(3);
    expect(
      flexibilityWeekNumber(anchor, addZonedDays(anchor, 42, "America/Denver"), "America/Denver"),
    ).toBe(1);
  });
});

describe("mobility logging", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores a session with empty-capable fields, then shows it as previous", async () => {
    const user = await makeUser("mobility-log@example.com");
    const first = await saveMobilitySession({
      userId: user.id,
      routineId: "kickers-hips",
      painFlag: true,
      effort: 3,
      sets: [
        {
          exerciseKey: "front-raise",
          side: "left",
          holdSeconds: 12,
          reps: 10,
          sets: 2,
          depthValue: null,
          depthUnit: "in",
          heightMark: "chest",
          painFlag: false,
        },
      ],
    });
    expect(first.painFlag).toBe(true);
    expect(first.durationSeconds).toBeGreaterThanOrEqual(8 * 60);
    expect(first.sets[0]?.holdSeconds).toBe(12);
    const previous = await previousMobilityLogs(user.id, "kickers-hips");
    expect(previous.get("front-raise|left")?.reps).toBe(10);
    expect(previous.get("front-raise|right")).toBeUndefined();

    const empty = await saveMobilitySession({
      userId: user.id,
      routineId: "cooldown",
      sets: [
        {
          exerciseKey: "couch",
          side: "right",
          holdSeconds: null,
          reps: null,
          sets: null,
          depthValue: null,
          depthUnit: "",
          heightMark: "",
          painFlag: false,
        },
      ],
    });
    expect(empty.sets[0]?.holdSeconds).toBeNull();
    expect(empty.painFlag).toBe(false);
  });
});
