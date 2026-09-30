import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { BAG_FOCUS, bagFocusFor } from "@/lib/bag-sessions";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { mesoBlockForWeekIndex, mesoBlockLabel } from "@/lib/mesocycle";
import { APP_TIMEZONE } from "@/lib/timezone";
import { THU_STRENGTH_DAY_NUMBER } from "@/lib/daru-exercises";
import {
  buildCoreWeekPlan,
  coreSkeletonSessions,
  planForDate,
  resolvePlanSessions,
  resolveTrainingDays,
  weekdayInAppZone,
  weekStrip,
} from "@/lib/week-plan";
import { makeUser, resetDatabase } from "./helpers";

const monday = new Date(2026, 8, 21, 10, 0, 0);
const thursday = new Date(2026, 8, 24, 10, 0, 0);
const tuesday = new Date(2026, 8, 22, 10, 0, 0);
const wednesday = new Date(2026, 8, 23, 10, 0, 0);

describe("Core weekday planner", () => {
  it("uses local civil weekdays", () => {
    expect(weekdayInAppZone(monday)).toBe("Monday");
    expect(weekdayInAppZone(thursday)).toBe("Thursday");
  });

  it("uses the athlete zone, not the host clock, around UTC midnight", () => {
    const fridayEveningUtc = new Date("2026-09-25T16:00:00.000Z");
    expect(weekdayInAppZone(fridayEveningUtc, "Australia/Sydney")).toBe("Saturday");
    expect(weekdayInAppZone(fridayEveningUtc, "America/Denver")).toBe("Friday");
    expect(weekdayInAppZone(fridayEveningUtc, "Europe/London")).toBe("Friday");
    expect(
      planForDate(
        { primaryFocus: "mma", weeklyAvailability: ["Monday", "Wednesday", "Friday"] },
        fridayEveningUtc,
        "Australia/Sydney",
      ).weekday,
    ).toBe("Saturday");
  });

  it("gives every Mon–Fri training day a distinct bag + rotating lift", () => {
    const mon = coreSkeletonSessions("Monday", "mma");
    expect(mon[0]).toMatchObject({
      kind: "skill",
      programSlug: "demo-combat-skills",
      dayNumber: BAG_FOCUS.Monday.dayNumber,
    });
    expect(mon[1]).toMatchObject({
      kind: "strength",
      programSlug: "demo-strength-base",
      dayNumber: 1,
    });

    const wed = coreSkeletonSessions("Wednesday", "mma");
    expect(wed[0]?.dayNumber).toBe(BAG_FOCUS.Wednesday.dayNumber);
    expect(wed[0]?.dayNumber).not.toBe(mon[0]?.dayNumber);
    expect(wed[1]).toMatchObject({ kind: "strength", dayNumber: 3 });

    const boxingMon = coreSkeletonSessions("Monday", "boxing");
    expect(boxingMon[0]?.dayNumber).toBe(BAG_FOCUS.Monday.dayNumber);
  });

  it("puts bag on general-fitness training days too", () => {
    const sessions = coreSkeletonSessions("Monday", "general-fitness");
    expect(sessions.some((session) => session.kind === "skill")).toBe(true);
    expect(sessions.some((session) => session.kind === "strength")).toBe(true);
  });

  it("stacks bag + pull + bike on Tuesday and bag + posterior + bike on Thursday", () => {
    const tue = coreSkeletonSessions("Tuesday", "mma");
    expect(tue).toHaveLength(3);
    expect(tue[0]?.kind).toBe("skill");
    expect(tue[1]).toMatchObject({ kind: "strength", dayNumber: 2 });
    expect(tue[2]).toMatchObject({ kind: "conditioning", dayNumber: 4 });

    const thu = coreSkeletonSessions("Thursday", "wrestling");
    expect(thu).toHaveLength(3);
    expect(thu[0]?.dayNumber).toBe(BAG_FOCUS.Thursday.dayNumber);
    expect(thu[1]).toMatchObject({ kind: "strength", dayNumber: THU_STRENGTH_DAY_NUMBER });
    expect(thu[2]).toMatchObject({ kind: "conditioning", dayNumber: 7 });

    expect(coreSkeletonSessions("Friday", "mma")[0]?.dayNumber).toBe(BAG_FOCUS.Friday.dayNumber);
    expect(coreSkeletonSessions("Friday", "mma")[1]).toMatchObject({
      kind: "conditioning",
      dayNumber: 10,
    });
  });

  it("keeps Saturday compressed off and still always-on Bike Tue/Thu", () => {
    const tue = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        sessionsPerWeek: 3,
      },
      tuesday,
    );
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Bag+Lift+Bike");
    expect(tue.skipReason).toBeUndefined();

    const days = resolveTrainingDays({
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      sessionsPerWeek: 3,
    });
    expect([...days]).toEqual(["Monday", "Wednesday", "Friday"]);
    expect(days.has("Saturday")).toBe(false);
  });

  it("builds a dual-day Monday plan for MMA with clickable week-strip dates", () => {
    const week = buildCoreWeekPlan({
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    });
    expect(week.Monday.active).toBe(true);
    expect(week.Monday.summary).toBe("Bag+Lift");
    expect(week.Monday.sessions).toHaveLength(2);
    expect(week.Wednesday.summary).toBe("Bag+Lift");
    expect(week.Wednesday.sessions[0]?.dayNumber).not.toBe(week.Monday.sessions[0]?.dayNumber);
    expect(week.Sunday.active).toBe(false);

    const strip = weekStrip(
      { primaryFocus: "mma", weeklyAvailability: ["Monday", "Wednesday", "Friday"] },
      monday,
      undefined,
      wednesday,
    );
    expect(strip.find((day) => day.weekday === "Wednesday")?.isSelected).toBe(true);
    expect(strip.find((day) => day.weekday === "Monday")?.isToday).toBe(true);
    expect(strip.every((day) => Boolean(day.dayParam))).toBe(true);
  });
});

describe("Core planner on Home", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("resolves Monday MMA into two catalog sessions on Home", async () => {
    const user = await makeUser("mma-monday@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "MMA",
      goalKey: "stronger-for-class",
      goalNote: "",
      experienceLevel: "intermediate",
      primaryFocus: "mma",
      equipment: ["Heavy bag"],
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: 4,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });
    const catalog = await findDemoTrainingCatalog();
    const today = await getHomeToday(user.id, monday);
    expect(today.plannedSessions.filter((session) => session.href)).toHaveLength(2);
    const block = mesoBlockForWeekIndex(bikeWeekIndex(monday, APP_TIMEZONE));
    expect(today.mesoLabel).toBe(mesoBlockLabel(block));
    expect(today.plannedSessions[0]?.title).toBe(bagFocusFor("Monday", block).label);
    expect(today.plannedSessions[1]?.title).toMatch(/Lower body/i);
    expect(today.suggestedDay?.title).toBe(bagFocusFor("Monday", block).label);
    expect(today.planSummary).toBe("Bag+Lift");
    expect(today.weekStrip).toHaveLength(7);

    const resolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: ["Monday"] }, monday),
      catalog,
    );
    expect(resolved[0]?.dayId).toBeTruthy();
    expect(resolved[1]?.dayId).toBeTruthy();

    const wedResolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: ["Wednesday"] }, wednesday),
      catalog,
    );
    const wedBlock = mesoBlockForWeekIndex(bikeWeekIndex(wednesday, APP_TIMEZONE));
    expect(wedResolved[0]?.title).toBe(bagFocusFor("Wednesday", wedBlock).label);
    expect(wedResolved[0]?.title).not.toBe(bagFocusFor("Monday", wedBlock).label);
    expect(wedResolved[0]?.dayId).not.toBe(resolved[0]?.dayId);
  });
});
