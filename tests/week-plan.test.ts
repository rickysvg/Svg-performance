import { afterAll, beforeEach, describe, expect, it } from "vitest";

async function startedWithProgram(userId: string) {
  await prisma.profile.update({
    where: { userId },
    data: { onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z") },
  });
}
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { formatDayParam, getHomeToday, parseDayParam } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
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
  futureWorkoutPulledBack,
  moveSessionOnPlan,
  parseWeekPlanSwaps,
  pruneAutoRolledSwaps,
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

  it("gives Monday a lift and Wednesday the bike, and does not lift every day", () => {
    const mon = coreSkeletonSessions("Monday", "mma");
    expect(mon).toHaveLength(1);
    expect(mon[0]).toMatchObject({
      kind: "strength",
      programSlug: "demo-strength-base",
      dayNumber: 1,
    });
    expect(mon.some((session) => session.kind === "skill")).toBe(false);

    const wed = coreSkeletonSessions("Wednesday", "mma");
    expect(wed.map((session) => session.kind)).toEqual(["conditioning", "mobility"]);
    expect(wed[0]?.dayNumber).not.toBe(mon[0]?.dayNumber);
    expect(wed.some((session) => session.kind === "strength")).toBe(false);

    const boxingMon = coreSkeletonSessions("Monday", "boxing");
    expect(boxingMon[0]?.kind).toBe("strength");
    expect(boxingMon[0]?.dayNumber).toBe(1);
    expect(boxingMon.some((session) => session.kind === "skill")).toBe(false);
  });

  it("keeps general-fitness training days on the lift, with no bag session", () => {
    const sessions = coreSkeletonSessions("Monday", "general-fitness");
    expect(sessions.some((session) => session.kind === "skill")).toBe(false);
    expect(sessions.some((session) => session.kind === "strength")).toBe(true);
  });

  it("keeps Tuesday as a lift and Friday as the circuit plus mobility, not a daily lift", () => {
    const tue = coreSkeletonSessions("Tuesday", "mma");
    expect(tue.map((session) => session.kind)).toEqual(["strength"]);
    expect(tue[0]).toMatchObject({ kind: "strength", dayNumber: 2 });

    const fri = coreSkeletonSessions("Friday", "mma");
    expect(fri[0]?.label).toBe("Conditioning");
    expect(fri[0]?.dayNumber).toBe(10);
    expect(fri.map((session) => session.kind)).toEqual(["conditioning", "mobility"]);
    expect(fri.some((session) => session.kind === "strength")).toBe(false);
    expect(fri.some((session) => session.kind === "skill")).toBe(false);

    const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
    const liftDays = week.filter((day) =>
      coreSkeletonSessions(day, "mma").some((session) => session.kind === "strength"),
    );
    expect(liftDays).toEqual(["Monday", "Tuesday", "Thursday"]);
  });

  it("keeps the v2 week even when the member only marked Mon/Wed/Fri", () => {
    const tue = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        sessionsPerWeek: 3,
        experienceLevel: "beginner",
        liftDaysPerWeek: 2,
      },
      tuesday,
    );
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Lift");

    const wed = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        sessionsPerWeek: 3,
      },
      wednesday,
    );
    expect(wed.active).toBe(true);
    expect(wed.summary).toBe("Cardio+Mobility");

    const days = resolveTrainingDays({
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      sessionsPerWeek: 3,
      primaryFocus: "mma",
    });
    expect(days.has("Tuesday")).toBe(true);
    expect(days.has("Thursday")).toBe(true);
    expect(days.has("Sunday")).toBe(true);
    expect(days.has("Saturday")).toBe(true);
  });

  it("builds a dual-day Monday plan for MMA with clickable week-strip dates", () => {
    const week = buildCoreWeekPlan({
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    });
    expect(week.Monday.active).toBe(true);
    expect(week.Monday.summary).toBe("Lift");
    expect(week.Monday.sessions).toHaveLength(1);
    expect(week.Wednesday.summary).toBe("Cardio+Mobility");
    expect(week.Wednesday.sessions[0]?.kind).toBe("conditioning");
    expect(week.Wednesday.sessions[0]?.dayNumber).not.toBe(week.Monday.sessions[0]?.dayNumber);
    expect(week.Sunday.active).toBe(true);
    expect(week.Sunday.summary).toBe("Cardio+Mobility");

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

  it("marks today in America/Denver, not UTC, and does not select another week's Thursday", () => {
    const prefs = { primaryFocus: "mma" as const };
    const zone = "America/Denver";
    // 12:24 AM Mountain on Tue Oct 20. UTC is already 06:24 the same morning.
    const justAfterMidnight = new Date("2026-10-20T06:24:00.000Z");
    const strip = weekStrip(prefs, justAfterMidnight, zone);
    expect(formatDayParam(parseDayParam(undefined, justAfterMidnight, zone), zone)).toBe("2026-10-20");
    expect(strip.find((day) => day.isToday)?.dayParam).toBe("2026-10-20");
    expect(strip.find((day) => day.isToday)?.weekday).toBe("Tuesday");
    expect(strip.find((day) => day.isToday)?.isSelected).toBe(true);
    expect(strip.find((day) => day.weekday === "Thursday")?.isToday).toBe(false);
    expect(strip.find((day) => day.weekday === "Thursday")?.isSelected).toBe(false);

    // 11:30 PM Mountain on Tue Oct 20. UTC has already rolled to Wednesday.
    const lateEvening = new Date("2026-10-21T05:30:00.000Z");
    const late = weekStrip(prefs, lateEvening, zone);
    expect(late.find((day) => day.isToday)?.dayParam).toBe("2026-10-20");
    expect(late.find((day) => day.weekday === "Wednesday")?.isToday).toBe(false);

    // 11:30 PM Mountain on Mon Oct 19. A UTC date would already say Tuesday.
    const stillMonday = weekStrip(prefs, new Date("2026-10-20T05:30:00.000Z"), zone);
    expect(stillMonday.find((day) => day.isToday)?.dayParam).toBe("2026-10-19");
    expect(stillMonday.find((day) => day.weekday === "Tuesday")?.isToday).toBe(false);

    const nextThursday = new Date("2026-10-29T18:00:00.000Z");
    const stale = weekStrip(prefs, justAfterMidnight, zone, nextThursday);
    expect(stale.find((day) => day.weekday === "Thursday")?.dayParam).toBe("2026-10-22");
    expect(stale.find((day) => day.weekday === "Thursday")?.isSelected).toBe(false);
    expect(stale.find((day) => day.isSelected)).toBeUndefined();
    expect(stale.find((day) => day.isToday)?.weekday).toBe("Tuesday");

    const thisThursday = new Date("2026-10-22T18:00:00.000Z");
    const preview = weekStrip(prefs, justAfterMidnight, zone, thisThursday);
    expect(preview.find((day) => day.weekday === "Thursday")?.isSelected).toBe(true);
    expect(preview.find((day) => day.weekday === "Thursday")?.isToday).toBe(false);
    expect(preview.find((day) => day.weekday === "Tuesday")?.isToday).toBe(true);
    expect(preview.find((day) => day.weekday === "Tuesday")?.isSelected).toBe(false);
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
    const sunday = new Date(2026, 8, 27, 10, 0, 0);
    expect(planForDate(prefs, monday, APP_TIMEZONE, ontoSunday).summary).toBe("Cardio+Mobility");
    expect(planForDate(prefs, sunday, APP_TIMEZONE, ontoSunday).summary).toBe("Lift");
    expect(planForDate(prefs, monday, APP_TIMEZONE, ontoSunday).active).toBe(true);
    expect(planForDate(prefs, sunday, APP_TIMEZONE, ontoSunday).active).toBe(true);
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
    expect(mondayAfter.sessions.map((session) => session.kind)).toEqual(["rest"]);
    expect(mondayAfter.summary).toBe("Off");
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
    const friday = new Date(2026, 8, 25, 10, 0, 0);
    const plainFriday = planForDate(prefs, friday, APP_TIMEZONE);
    const plainWednesday = planForDate(prefs, wednesday, APP_TIMEZONE);
    const fridayCircuit = plainFriday.sessions.find((session) => session.kind === "conditioning")?.sessionKey ?? "";
    const fridayMobility = plainFriday.sessions.find((session) => session.kind === "mobility")?.sessionKey ?? "";
    const wednesdayBike = plainWednesday.sessions.find((session) => session.kind === "conditioning")?.sessionKey ?? "";
    const wednesdayMobility = plainWednesday.sessions.find((session) => session.kind === "mobility")?.sessionKey ?? "";
    expect(fridayCircuit).not.toBe(wednesdayBike);
    expect(fridayMobility.startsWith("Friday:")).toBe(true);
    expect(wednesdayBike.startsWith("Wednesday:")).toBe(true);

    const swapped = swapSessionsOnPlan([], start, fridayCircuit, wednesdayBike);
    const fridayAfter = planForDate(prefs, friday, APP_TIMEZONE, swapped);
    const wednesdayAfter = planForDate(prefs, wednesday, APP_TIMEZONE, swapped);
    expect(fridayAfter.sessions.map((session) => session.sessionKey)).toContain(wednesdayBike);
    expect(fridayAfter.sessions.map((session) => session.sessionKey)).toContain(fridayMobility);
    expect(fridayAfter.sessions.map((session) => session.sessionKey)).not.toContain(fridayCircuit);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).toContain(fridayCircuit);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).toContain(wednesdayMobility);
    expect(wednesdayAfter.sessions.map((session) => session.sessionKey)).not.toContain(wednesdayBike);
    expect(swapSessionsOnPlan(swapped, start, fridayCircuit, wednesdayBike)).toEqual([]);
    expect(swapSessionsOnPlan([], start, fridayCircuit, fridayCircuit)).toEqual([]);
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
    expect(week.Monday.sessions.find((session) => session.kind === "skill")).toBeUndefined();
    expect(week.Friday.sessions.find((session) => session.kind === "skill")).toBeUndefined();
    expect(week.Friday.sessions.find((session) => session.label === "Conditioning")?.heavy).toBe(false);
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
    expect(futureWorkoutPulledBack(liftKey, "Tuesday", "Tuesday")).toBe(false);
    const fridayPlan = planForDate(prefs, new Date(2026, 8, 25, 10, 0, 0));
    const fridayBag =
      fridayPlan.sessions.find((session) => session.label === "Conditioning")?.sessionKey ?? "";
    expect(fridayBag.startsWith("Friday:")).toBe(true);
    expect(futureWorkoutPulledBack(fridayBag, "Tuesday", "Tuesday")).toBe(false);
    expect(futureWorkoutPulledBack(fridayBag, "Monday", "Tuesday")).toBe(true);
    const auto = moveSessionOnPlan([], start, fridayBag, "Tuesday").map((row) => ({
      ...row,
      manualSessions: undefined,
    }));
    expect(pruneAutoRolledSwaps(parseWeekPlanSwaps(JSON.stringify(auto)))).toEqual([]);
    expect(pruneAutoRolledSwaps(moveSessionOnPlan([], start, liftKey, "Wednesday"))).toEqual(
      moveSessionOnPlan([], start, liftKey, "Wednesday"),
    );
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

  it("resolves Monday MMA into the lift on Home", async () => {
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
    await startedWithProgram(user.id);
    const catalog = await findDemoTrainingCatalog();
    const today = await getHomeToday(user.id, monday);
    expect(today.plannedSessions.filter((session) => session.href)).toHaveLength(1);
    expect(today.plannedSessions.some((session) => session.kind === "skill")).toBe(false);
    const block = mesoBlockForWeekIndex(bikeWeekIndex(monday, APP_TIMEZONE));
    expect(today.mesoLabel).toBe(mesoBlockLabel(block));
    expect(today.plannedSessions[0]?.title).toMatch(/Full body/i);
    expect(today.suggestedDay?.title).toMatch(/Full body/i);
    expect(today.planSummary).toBe("Lift");
    expect(today.weekStrip).toHaveLength(7);

    const resolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: ["Monday"] }, monday),
      catalog,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.kind).toBe("strength");
    expect(resolved[0]?.dayId).toBeTruthy();

    const wedResolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: ["Wednesday"] }, wednesday),
      catalog,
    );
    expect(wedResolved[0]?.title).toBe("Cardio — bike");
    expect(wedResolved[0]?.day?.title).toMatch(/Alactic|Daru/i);
    expect(wedResolved[0]?.kind).not.toBe("skill");
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
    await startedWithProgram(user.id);
    const start = weekStartKey(monday, APP_TIMEZONE);
    await swapWeekPlanForUser(user.id, start, "Monday", "Wednesday");

    const today = await getHomeToday(user.id, monday);
    expect(today.plannedSessions[0]?.title).toBe("Cardio — bike");
    expect(today.plannedSessions[1]?.title).toMatch(/Mobility/i);
    expect(today.weekStrip.find((day) => day.weekday === "Monday")?.movedFrom).toBe("Wednesday");

    const schedule = await getCalendarSchedule(user.id, tuesday);
    const wed = schedule.days.find((day) => day.heading.startsWith("Tomorrow"));
    const wedWorkouts = wed?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(wedWorkouts.some((row) => row.kind === "workout" && /bag/i.test(row.title))).toBe(false);
    expect(wedWorkouts.some((row) => /Full body/i.test(row.title))).toBe(true);
    expect(wedWorkouts.some((row) => row.subtitle.includes("Monday’s workout"))).toBe(true);

    const nextMonday = new Date(2026, 8, 28, 10, 0, 0);
    const nextWeek = await getHomeToday(user.id, nextMonday);
    expect(nextWeek.plannedSessions[0]?.title).toMatch(/Full body/i);
    expect(nextWeek.plannedSessions.some((session) => session.kind === "skill")).toBe(false);

    await clearCurrentWeekPlanForUser(user.id, monday);
    const restored = await getHomeToday(user.id, monday);
    expect(restored.plannedSessions[0]?.title).toMatch(/Full body/i);
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
    await startedWithProgram(user.id);
    const start = weekStartKey(monday, APP_TIMEZONE);
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: 4,
    };
    const plainMonday = planForDate(prefs, monday);
    const liftKey = plainMonday.sessions[0]?.sessionKey ?? "";
    expect(plainMonday.sessions).toHaveLength(1);

    const before = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayBefore = before.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayBefore.some((row) => row.sessionKey === liftKey)).toBe(true);
    expect(mondayBefore[0]?.subtitle).toBe("Missed. Tap Move to do it another day.");

    await expect(moveWorkoutForUser(user.id, liftKey, "Monday", start, wednesday)).rejects.toThrow(
      /today or a later day/,
    );

    await moveWorkoutForUser(user.id, liftKey, "Wednesday", start, wednesday);
    const schedule = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayWork = schedule.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    const wednesdayWork = schedule.days[2]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayWork.some((row) => row.sessionKey === liftKey)).toBe(false);
    expect(mondayWork).toHaveLength(0);
    expect(wednesdayWork.some((row) => row.sessionKey === liftKey)).toBe(true);

    const today = await getHomeToday(user.id, wednesday);
    expect(today.plannedSessions.some((session) => session.sessionKey === liftKey)).toBe(true);

    await restoreWeekPlanForUser(user.id, JSON.stringify([]), wednesday);
    const back = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayAgain = back.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayAgain.some((row) => row.sessionKey === liftKey)).toBe(true);
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
    await startedWithProgram(user.id);
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: 4,
      experienceLevel: "intermediate",
    };
    const catalog = await findDemoTrainingCatalog();
    const resolved = resolvePlanSessions(planForDate(prefs, wednesday), catalog);
    const bike = resolved.find((session) => session.kind === "conditioning");
    const mobility = resolved.find((session) => session.kind === "mobility");
    expect(bike?.dayId).toBeTruthy();
    expect(bike?.sessionKey).toBeTruthy();
    expect(mobility?.sessionKey).toBeTruthy();

    const logged = await startWorkoutFromDay({
      userId: user.id,
      programDayId: bike?.dayId ?? "",
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: logged.id,
      title: logged.title,
      performedAt: wednesday,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Assault bike intervals",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          durationSeconds: 180,
          completed: true,
        },
      ],
    });

    const friday = new Date(2026, 8, 25, 10, 0, 0);
    const start = weekStartKey(monday, APP_TIMEZONE);
    await expect(
      moveWorkoutForUser(user.id, bike?.sessionKey ?? "", "Friday", start, wednesday),
    ).rejects.toThrow(/already done/);

    await moveWorkoutForUser(user.id, mobility?.sessionKey ?? "", "Friday", start, wednesday);
    const fridayHome = await getHomeToday(user.id, friday);
    expect(fridayHome.plannedSessions.some((session) => session.sessionKey === mobility?.sessionKey)).toBe(true);
    expect(fridayHome.plannedSessions.some((session) => session.sessionKey === bike?.sessionKey)).toBe(false);

    const wednesdayHome = await getHomeToday(user.id, wednesday);
    expect(wednesdayHome.plannedSessions.some((session) => session.sessionKey === bike?.sessionKey)).toBe(true);

    const fridayConditioning = resolvePlanSessions(planForDate(prefs, friday), catalog).find(
      (session) => session.label === "Conditioning",
    );
    await restoreWeekPlanForUser(user.id, JSON.stringify([]), wednesday);
    await swapWorkoutForUser(
      user.id,
      mobility?.sessionKey ?? "",
      fridayConditioning?.sessionKey ?? "",
      start,
      wednesday,
    );
    const afterSwap = await getHomeToday(user.id, wednesday);
    expect(afterSwap.plannedSessions.some((session) => session.sessionKey === fridayConditioning?.sessionKey)).toBe(
      true,
    );
    expect(afterSwap.plannedSessions.some((session) => session.sessionKey === mobility?.sessionKey)).toBe(false);
    const fridayAfter = await getHomeToday(user.id, friday);
    expect(fridayAfter.plannedSessions.some((session) => session.sessionKey === mobility?.sessionKey)).toBe(true);
  });

  it("sends an auto-moved future workout home and still lets today take a later workout", async () => {
    const user = await makeUser("no-autoroll@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Roll",
      goalKey: "stronger-for-class",
      goalNote: "",
      experienceLevel: "intermediate",
      primaryFocus: "mma",
      equipment: ["Heavy bag"],
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      sessionsPerWeek: 5,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });
    await startedWithProgram(user.id);
    const tuesday = new Date(2026, 8, 22, 10, 0, 0);
    const friday = new Date(2026, 8, 25, 10, 0, 0);
    const start = weekStartKey(monday, APP_TIMEZONE);
    const prefs = {
      primaryFocus: "mma",
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      sessionsPerWeek: 5,
      experienceLevel: "intermediate" as const,
    };
    const fridayPlan = planForDate(prefs, friday, APP_TIMEZONE);
    const fridayBag =
      fridayPlan.sessions.find((session) => session.label === "Conditioning")?.sessionKey ?? "";
    const mondayPlan = planForDate(prefs, monday, APP_TIMEZONE);
    const mondayLift = mondayPlan.sessions.find((session) => session.kind === "strength")?.sessionKey ?? "";
    expect(fridayBag.startsWith("Friday:")).toBe(true);
    expect(mondayLift.startsWith("Monday:")).toBe(true);

    const piled = [
      ...moveSessionOnPlan(moveSessionOnPlan([], start, mondayLift, "Tuesday"), start, fridayBag, "Tuesday"),
    ].map((row) => ({ weekStart: row.weekStart, sourceByDay: row.sourceByDay, sessionDays: row.sessionDays }));
    await prisma.profile.update({
      where: { userId: user.id },
      data: { weekPlanSwapsJson: JSON.stringify(piled) },
    });

    const pruned = await getCalendarSchedule(user.id, tuesday, monday);
    const tuesdayBefore = pruned.days[1]?.activities.filter((row) => row.kind === "workout") ?? [];
    const fridayBefore = pruned.days[4]?.activities.filter((row) => row.kind === "workout") ?? [];
    const mondayBefore = pruned.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(tuesdayBefore.some((row) => row.sessionKey === fridayBag)).toBe(false);
    expect(tuesdayBefore.some((row) => row.sessionKey === mondayLift)).toBe(false);
    expect(fridayBefore.some((row) => row.sessionKey === fridayBag)).toBe(true);
    expect(mondayBefore.some((row) => row.sessionKey === mondayLift)).toBe(true);
    expect(tuesdayBefore.some((row) => /Monday’s workout/.test(row.subtitle))).toBe(false);
    expect(tuesdayBefore.some((row) => /Friday’s workout/.test(row.subtitle))).toBe(false);

    await moveWorkoutForUser(user.id, fridayBag, "Tuesday", start, tuesday);
    const schedule = await getCalendarSchedule(user.id, tuesday, monday);
    const tuesdayWork = schedule.days[1]?.activities.filter((row) => row.kind === "workout") ?? [];
    const fridayWork = schedule.days[4]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(tuesdayWork.some((row) => row.sessionKey === fridayBag)).toBe(true);
    expect(fridayWork.some((row) => row.sessionKey === fridayBag)).toBe(false);
    expect(tuesdayWork.some((row) => row.sessionKey === mondayLift)).toBe(false);
  });
});
