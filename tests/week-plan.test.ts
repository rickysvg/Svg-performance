import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { BAG_FOCUS, bagFocusFor } from "@/lib/bag-sessions";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { mesoBlockForWeekIndex, mesoBlockLabel } from "@/lib/mesocycle";
import { APP_TIMEZONE } from "@/lib/timezone";
import {
  buildCoreWeekPlan,
  coreSkeletonSessions,
  planForDate,
  resolvePlanSessions,
  resolveTrainingDays,
  weekdayInAppZone,
  weekStrip,
} from "@/lib/week-plan";
import {
  moveSessionOnPlan,
  parseWeekPlanSwaps,
  pruneWeekPlanSwaps,
  sessionMoveCaution,
  swapSessionsOnPlan,
  swapWeekdays,
  weekStartKey,
} from "@/lib/week-plan-swaps";
import {
  clearCurrentWeekPlanForUser,
  moveWorkoutForUser,
  restoreWeekPlanForUser,
  swapWeekPlanForUser,
  swapWorkoutForUser,
} from "@/lib/week-plan-swap-store";
import { getCalendarSchedule } from "@/lib/calendar";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
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

  it("gives Monday and Wednesday a distinct bag plus a lift, and does not lift every day", () => {
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

  it("keeps Tuesday as mobility and Friday as a lift, not a daily lift", () => {
    const tue = coreSkeletonSessions("Tuesday", "mma");
    expect(tue.map((session) => session.kind)).toEqual(["mobility"]);
    expect(tue.some((session) => session.kind === "strength")).toBe(false);

    const fri = coreSkeletonSessions("Friday", "mma");
    expect(fri[0]?.dayNumber).toBe(BAG_FOCUS.Friday.dayNumber);
    expect(fri[1]).toMatchObject({ kind: "strength" });
    expect(fri.some((session) => session.dayNumber === 10)).toBe(false);

    const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
    const liftDays = week.filter((day) =>
      coreSkeletonSessions(day, "mma").some((session) => session.kind === "strength"),
    );
    expect(liftDays.length).toBeLessThan(7);
    expect(liftDays.length).toBeLessThanOrEqual(4);
  });

  it("keeps mobility on even when the member only marked Mon/Wed/Fri", () => {
    const tue = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        sessionsPerWeek: 3,
      },
      tuesday,
    );
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Mobility");
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

  it("swaps one week’s workouts and leaves the default plan for every other week", () => {
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    };
    const start = weekStartKey(monday, APP_TIMEZONE);
    expect(parseWeekPlanSwaps("nope")).toEqual([]);
    expect(swapWeekdays([], start, "Monday", "Monday")).toEqual([]);

    const once = swapWeekdays([], start, "Monday", "Wednesday");
    expect(once).toEqual([
      {
        weekStart: start,
        sourceByDay: { Monday: "Wednesday", Wednesday: "Monday" },
      },
    ]);
    expect(swapWeekdays(once, start, "Monday", "Wednesday")).toEqual([]);
    expect(pruneWeekPlanSwaps(once, "2026-09-28")).toEqual(once);
    expect(pruneWeekPlanSwaps(once, "2027-02-01")).toEqual([]);

    const plainMonday = planForDate(prefs, monday, APP_TIMEZONE);
    const plainWednesday = planForDate(prefs, wednesday, APP_TIMEZONE);
    const wed = planForDate(prefs, wednesday, APP_TIMEZONE, once);
    expect(wed.weekday).toBe("Wednesday");
    expect(wed.movedFrom).toBe("Monday");
    expect(wed.sessions.map((session) => session.dayNumber)).toEqual(
      plainMonday.sessions.map((session) => session.dayNumber),
    );

    const mon = planForDate(prefs, monday, APP_TIMEZONE, once);
    expect(mon.weekday).toBe("Monday");
    expect(mon.movedFrom).toBe("Wednesday");
    expect(mon.sessions.map((session) => session.dayNumber)).toEqual(
      plainWednesday.sessions.map((session) => session.dayNumber),
    );
    expect(plainMonday.movedFrom).toBeUndefined();

    const nextMonday = new Date(2026, 8, 28, 10, 0, 0);
    const next = planForDate(prefs, nextMonday, APP_TIMEZONE, once);
    expect(next.movedFrom).toBeUndefined();
    expect(next.sessions.map((session) => session.dayNumber)).toEqual(
      planForDate(prefs, nextMonday).sessions.map((session) => session.dayNumber),
    );

    const strip = weekStrip(prefs, monday, APP_TIMEZONE, monday, once);
    expect(strip.find((day) => day.weekday === "Monday")?.movedFrom).toBe("Wednesday");
    expect(strip.find((day) => day.weekday === "Wednesday")?.movedFrom).toBe("Monday");
    expect(strip.find((day) => day.weekday === "Friday")?.movedFrom).toBeUndefined();

    const laterMonday = new Date(2026, 8, 28, 10, 0, 0);
    const pastStrip = weekStrip(prefs, laterMonday, APP_TIMEZONE, monday, [], monday);
    expect(pastStrip.find((day) => day.weekday === "Monday")?.isSelected).toBe(true);
    expect(pastStrip.find((day) => day.weekday === "Monday")?.isToday).toBe(false);
    expect(pastStrip.find((day) => day.weekday === "Monday")?.isPast).toBe(true);
    expect(pastStrip.find((day) => day.weekday === "Wednesday")?.isSelected).toBe(false);

    const ontoSunday = swapWeekdays([], start, "Monday", "Sunday");
    expect(planForDate(prefs, monday, APP_TIMEZONE, ontoSunday).active).toBe(false);
    expect(planForDate(prefs, new Date(2026, 8, 27, 10, 0, 0), APP_TIMEZONE, ontoSunday).active).toBe(
      true,
    );
  });

  it("moves one workout onto another day and leaves the rest of that day", () => {
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    };
    const start = weekStartKey(monday, APP_TIMEZONE);
    const plainMonday = planForDate(prefs, monday, APP_TIMEZONE);
    const plainWednesday = planForDate(prefs, wednesday, APP_TIMEZONE);
    const bagKey = plainMonday.sessions[0]?.sessionKey ?? "";
    expect(bagKey.startsWith("Monday:")).toBe(true);

    const moved = moveSessionOnPlan([], start, bagKey, "Wednesday");
    const mondayAfter = planForDate(prefs, monday, APP_TIMEZONE, moved);
    const wednesdayAfter = planForDate(prefs, wednesday, APP_TIMEZONE, moved);
    expect(mondayAfter.sessions.map((session) => session.sessionKey)).not.toContain(bagKey);
    expect(mondayAfter.sessions).toHaveLength(plainMonday.sessions.length - 1);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).toContain(bagKey);
    expect(wednesdayAfter.sessions).toHaveLength(plainWednesday.sessions.length + 1);
    expect(parseWeekPlanSwaps(JSON.stringify(moved))).toEqual(moved);

    const undone = parseWeekPlanSwaps("[]");
    expect(planForDate(prefs, monday, APP_TIMEZONE, undone).sessions.map((session) => session.sessionKey)).toContain(
      bagKey,
    );

    const friday = new Date(2026, 8, 25, 10, 0, 0);
    const swapped = swapWeekdays(moved, start, "Wednesday", "Friday");
    expect(planForDate(prefs, friday, APP_TIMEZONE, swapped).sessions.map((session) => session.sessionKey)).toContain(
      bagKey,
    );
  });

  it("swaps one session with a session on another day and leaves the rest", () => {
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    };
    const start = weekStartKey(monday, APP_TIMEZONE);
    const plainMonday = planForDate(prefs, monday, APP_TIMEZONE);
    const plainWednesday = planForDate(prefs, wednesday, APP_TIMEZONE);
    const bagKey = plainMonday.sessions[0]?.sessionKey ?? "";
    const mondayLift = plainMonday.sessions[1]?.sessionKey ?? "";
    const wednesdayLift = plainWednesday.sessions.find((session) => session.kind === "strength")?.sessionKey ?? "";
    expect(bagKey).not.toBe(wednesdayLift);

    const swapped = swapSessionsOnPlan([], start, bagKey, wednesdayLift);
    const mondayAfter = planForDate(prefs, monday, APP_TIMEZONE, swapped);
    const wednesdayAfter = planForDate(prefs, wednesday, APP_TIMEZONE, swapped);
    expect(mondayAfter.sessions.map((session) => session.sessionKey)).toContain(wednesdayLift);
    expect(mondayAfter.sessions.map((session) => session.sessionKey)).toContain(mondayLift);
    expect(mondayAfter.sessions.map((session) => session.sessionKey)).not.toContain(bagKey);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).toContain(bagKey);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).not.toContain(wednesdayLift);
    expect(swapSessionsOnPlan(swapped, start, bagKey, wednesdayLift)).toEqual([]);
    expect(swapSessionsOnPlan([], start, bagKey, bagKey)).toEqual([]);
  });

  it("warns gently for a heavy session on class, sparring, or the day before sparring", () => {
    expect(
      sessionMoveCaution({ heavy: true, outside: "sparring", dayName: "Saturday" }),
    ).toMatch(/sparring/i);
    expect(
      sessionMoveCaution({ heavy: false, outside: "sparring", dayName: "Saturday" }),
    ).toMatch(/You can still/);
    expect(
      sessionMoveCaution({ heavy: true, outside: "class", dayName: "Wednesday" }),
    ).toMatch(/class/i);
    expect(
      sessionMoveCaution({ heavy: true, beforeSparring: true, dayName: "Friday" }),
    ).toMatch(/before sparring/i);
    expect(sessionMoveCaution({ heavy: false, outside: "class", dayName: "Wednesday" })).toBeNull();
    expect(sessionMoveCaution({ heavy: true, dayName: "Monday" })).toBeNull();

    const prefs = {
      primaryFocus: "mma",
      trainingFocus: "martial_arts_sc",
      liftDaysPerWeek: 3,
      experienceLevel: "intermediate",
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      outsideTraining: [
        { weekday: "Wednesday" as const, kind: "class" as const, time: "18:00" },
        { weekday: "Saturday" as const, kind: "sparring" as const, time: "11:00" },
      ],
    };
    const week = buildCoreWeekPlan(prefs);
    expect(week.Monday.sessions.find((session) => session.kind === "strength")?.heavy).toBe(true);
    expect(week.Monday.sessions.find((session) => session.kind === "skill")?.heavy).toBe(true);
    expect(week.Friday.sessions.find((session) => session.kind === "skill")?.heavy).toBe(false);
    expect(week.Wednesday.sessions.every((session) => session.heavy !== true)).toBe(true);

    const start = weekStartKey(monday, APP_TIMEZONE);
    const mondayPlan = planForDate(prefs, monday, APP_TIMEZONE);
    const liftKey = mondayPlan.sessions.find((session) => session.kind === "strength")?.sessionKey ?? "";
    expect(liftKey.startsWith("Monday:")).toBe(true);
    const moved = moveSessionOnPlan([], start, liftKey, "Saturday");
    const saturday = new Date(2026, 8, 26, 10, 0, 0);
    const sat = planForDate(prefs, saturday, APP_TIMEZONE, moved);
    expect(sat.outside?.kind).toBe("sparring");
    expect(sat.sessions.map((session) => session.sessionKey)).toContain(liftKey);
    expect(
      planForDate(prefs, monday, APP_TIMEZONE, moved).sessions.map((session) => session.sessionKey),
    ).not.toContain(liftKey);
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

  it("keeps a saved week swap on Home, Train’s plan, and Calendar", async () => {
    const user = await makeUser("swap-week@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Swap",
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
    const start = weekStartKey(monday, APP_TIMEZONE);
    await swapWeekPlanForUser(user.id, start, "Monday", "Wednesday");

    const block = mesoBlockForWeekIndex(bikeWeekIndex(monday, APP_TIMEZONE));
    const today = await getHomeToday(user.id, monday);
    expect(today.plannedSessions[0]?.title).toBe(bagFocusFor("Wednesday", block).label);
    expect(today.plannedSessions[1]?.title).toMatch(/Upper push/i);
    expect(today.weekStrip.find((day) => day.weekday === "Monday")?.movedFrom).toBe("Wednesday");

    const schedule = await getCalendarSchedule(user.id, tuesday);
    const wed = schedule.days.find((day) => day.heading.startsWith("Tomorrow"));
    const wedWorkouts = wed?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(wedWorkouts.some((row) => row.title === bagFocusFor("Monday", block).label)).toBe(true);
    expect(wedWorkouts.some((row) => /Lower body/i.test(row.title))).toBe(true);
    expect(wedWorkouts.some((row) => row.subtitle.includes("Monday’s workout"))).toBe(true);

    const nextMonday = new Date(2026, 8, 28, 10, 0, 0);
    const nextBlock = mesoBlockForWeekIndex(bikeWeekIndex(nextMonday, APP_TIMEZONE));
    const nextWeek = await getHomeToday(user.id, nextMonday);
    expect(nextWeek.plannedSessions[0]?.title).toBe(bagFocusFor("Monday", nextBlock).label);

    await clearCurrentWeekPlanForUser(user.id, monday);
    const restored = await getHomeToday(user.id, monday);
    expect(restored.plannedSessions[0]?.title).toBe(bagFocusFor("Monday", block).label);
    expect(restored.weekStrip.find((day) => day.weekday === "Monday")?.movedFrom).toBeUndefined();
  });

  it("moves one missed workout onto today and restores it", async () => {
    const user = await makeUser("move-one@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Move",
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
    const start = weekStartKey(monday, APP_TIMEZONE);
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: 4,
    };
    const plainMonday = planForDate(prefs, monday);
    const bagKey = plainMonday.sessions[0]?.sessionKey ?? "";
    const bagTitle = plainMonday.sessions[0] ? bagFocusFor("Monday", mesoBlockForWeekIndex(bikeWeekIndex(monday, APP_TIMEZONE))).label : "";

    await expect(moveWorkoutForUser(user.id, bagKey, "Monday", start, wednesday)).rejects.toThrow(
      /today or a later day/,
    );

    await moveWorkoutForUser(user.id, bagKey, "Wednesday", start, wednesday);
    const schedule = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayWork = schedule.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    const wednesdayWork = schedule.days[2]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayWork.some((row) => row.sessionKey === bagKey)).toBe(false);
    expect(mondayWork.length).toBeGreaterThan(0);
    expect(mondayWork[0]?.subtitle).toBe("Missed. Tap Move to do it another day.");
    expect(wednesdayWork.some((row) => row.sessionKey === bagKey)).toBe(true);

    const today = await getHomeToday(user.id, wednesday);
    expect(today.plannedSessions.some((session) => session.title === bagTitle)).toBe(true);

    await restoreWeekPlanForUser(user.id, JSON.stringify([]), wednesday);
    const back = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayAgain = back.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayAgain.some((row) => row.sessionKey === bagKey)).toBe(true);
  });

  it("keeps a finished session in place and still moves the other session that day", async () => {
    const user = await makeUser("move-session@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Session",
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
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: 4,
      experienceLevel: "intermediate",
    };
    const catalog = await findDemoTrainingCatalog();
    const resolved = resolvePlanSessions(planForDate(prefs, monday), catalog);
    const lift = resolved.find((session) => session.kind === "strength");
    const bag = resolved.find((session) => session.kind === "skill");
    expect(lift?.dayId).toBeTruthy();
    expect(lift?.sessionKey).toBeTruthy();
    expect(bag?.sessionKey).toBeTruthy();

    const logged = await startWorkoutFromDay({
      userId: user.id,
      programDayId: lift?.dayId ?? "",
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: logged.id,
      title: logged.title,
      performedAt: monday,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });

    const start = weekStartKey(monday, APP_TIMEZONE);
    await expect(
      moveWorkoutForUser(user.id, lift?.sessionKey ?? "", "Wednesday", start, monday),
    ).rejects.toThrow(/already done/);

    await moveWorkoutForUser(user.id, bag?.sessionKey ?? "", "Wednesday", start, monday);
    const today = await getHomeToday(user.id, wednesday);
    expect(today.plannedSessions.some((session) => session.sessionKey === bag?.sessionKey)).toBe(true);
    expect(today.plannedSessions.some((session) => session.sessionKey === lift?.sessionKey)).toBe(false);

    const mondayHome = await getHomeToday(user.id, monday);
    expect(mondayHome.plannedSessions.some((session) => session.sessionKey === lift?.sessionKey)).toBe(true);

    const wedLift = resolvePlanSessions(planForDate(prefs, wednesday), catalog).find(
      (session) => session.kind === "strength",
    );
    await restoreWeekPlanForUser(user.id, JSON.stringify([]), monday);
    await swapWorkoutForUser(user.id, bag?.sessionKey ?? "", wedLift?.sessionKey ?? "", start, monday);
    const afterSwap = await getHomeToday(user.id, monday);
    expect(afterSwap.plannedSessions.some((session) => session.sessionKey === wedLift?.sessionKey)).toBe(true);
    expect(afterSwap.plannedSessions.some((session) => session.sessionKey === bag?.sessionKey)).toBe(false);
    const wednesdayHome = await getHomeToday(user.id, wednesday);
    expect(wednesdayHome.plannedSessions.some((session) => session.sessionKey === bag?.sessionKey)).toBe(true);
  });
});
