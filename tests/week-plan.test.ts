import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  buildCoreWeekPlan,
  coreSkeletonSessions,
  planForDate,
  resolvePlanSessions,
  resolveTrainingDays,
  weekdayInAppZone,
} from "@/lib/week-plan";
import { makeUser, resetDatabase } from "./helpers";

const monday = new Date(2026, 8, 21, 10, 0, 0);
const thursday = new Date(2026, 8, 24, 10, 0, 0);
const tuesday = new Date(2026, 8, 22, 10, 0, 0);

describe("Core weekday planner", () => {
  it("uses local civil weekdays", () => {
    expect(weekdayInAppZone(monday)).toBe("Monday");
    expect(weekdayInAppZone(thursday)).toBe("Thursday");
  });

  it("gives striking Monday bag + strength", () => {
    const sessions = coreSkeletonSessions("Monday", "mma");
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      kind: "skill",
      programSlug: "demo-combat-skills",
      dayNumber: 1,
    });
    expect(sessions[1]).toMatchObject({
      kind: "strength",
      programSlug: "demo-strength-base",
      dayNumber: 2,
    });

    const boxing = coreSkeletonSessions("Monday", "boxing");
    expect(boxing[0]).toMatchObject({ kind: "skill", dayNumber: 3 });
    expect(boxing[1]).toMatchObject({ kind: "strength", dayNumber: 2 });
  });

  it("keeps general-fitness Monday on strength only — no bag", () => {
    const sessions = coreSkeletonSessions("Monday", "general-fitness");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.kind).toBe("strength");
    expect(sessions[0]?.programSlug).toBe("demo-strength-base");
    expect(sessions.some((session) => session.kind === "skill")).toBe(false);
  });

  it("puts Assault Bike on Tuesday and Thursday for every focus", () => {
    expect(coreSkeletonSessions("Tuesday", "mma")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: 4,
    });
    expect(coreSkeletonSessions("Thursday", "wrestling")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: 7,
    });
    expect(coreSkeletonSessions("Thursday", "jiu-jitsu")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: 7,
    });
    expect(coreSkeletonSessions("Thursday", "general-fitness")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: 7,
    });
    expect(coreSkeletonSessions("Friday", "mma")[0]).toMatchObject({
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
    expect(tue.summary).toBe("Bike");
    expect(tue.skipReason).toBeUndefined();

    const days = resolveTrainingDays({
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      sessionsPerWeek: 3,
    });
    expect([...days]).toEqual(["Monday", "Wednesday", "Friday"]);
    expect(days.has("Saturday")).toBe(false);
  });

  it("builds a dual-day Monday plan for MMA", () => {
    const week = buildCoreWeekPlan({
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    });
    expect(week.Monday.active).toBe(true);
    expect(week.Monday.summary).toBe("Bag+Lift");
    expect(week.Monday.sessions).toHaveLength(2);
    expect(week.Sunday.active).toBe(false);
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
    expect(today.plannedSessions[0]?.title).toMatch(/Heavy bag — hands to low kicks/i);
    expect(today.plannedSessions[1]?.title).toMatch(/Upper body/i);
    expect(today.suggestedDay?.title).toMatch(/Heavy bag/i);
    expect(today.planSummary).toBe("Bag+Lift");
    expect(today.weekStrip).toHaveLength(7);

    const resolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: ["Monday"] }, monday),
      catalog,
    );
    expect(resolved[0]?.dayId).toBeTruthy();
    expect(resolved[1]?.dayId).toBeTruthy();
  });
});
