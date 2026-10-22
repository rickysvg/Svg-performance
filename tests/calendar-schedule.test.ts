import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import {
  completedProgramDayIdsOnDay,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
  type WorkoutSetInput,
} from "@/lib/workouts";
import { APP_TIMEZONE, addZonedDays } from "@/lib/timezone";
import {
  buildCalendarDays,
  formatCalendarHeading,
  getCalendarSchedule,
  listWeekDates,
  ordinalDay,
  resolveTrainingWeekdays,
  weekSessionTally,
} from "@/lib/calendar";

const tuesday = new Date(2026, 8, 22, 10, 0, 0);

/** Log a set that belongs to the started plan. A mismatched name must not finish the day. */
function tickedPlannedSet(session: {
  sets: { exerciseName: string; setNumber: number; logMode?: string | null }[];
}) {
  const planned = session.sets.find((set) => set.logMode === "load_reps") ?? session.sets[0];
  const weighted = !planned?.logMode || planned.logMode === "load_reps";
  return {
    exerciseName: planned?.exerciseName || "Goblet squat",
    setNumber: planned?.setNumber || 1,
    reps: weighted ? 8 : null,
    loadValue: weighted ? 40 : null,
    loadUnit: "lb" as const,
    durationSeconds: weighted ? null : 60,
    completed: true,
  };
}

function knownLogMode(value: string | null | undefined): WorkoutSetInput["logMode"] {
  if (
    value === "load_reps" ||
    value === "load_timed" ||
    value === "reps_only" ||
    value === "timed" ||
    value === "timed_round"
  ) {
    return value;
  }
  return undefined;
}

function finishEverySet(session: {
  sets: { exerciseName: string; setNumber: number; logMode?: string | null }[];
}): WorkoutSetInput[] {
  return session.sets.map((set) => {
    const mode = set.logMode ?? "load_reps";
    const timed = mode === "timed" || mode === "timed_round" || mode === "load_timed";
    return {
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: timed ? null : 8,
      loadValue: mode === "reps_only" || mode === "timed" || mode === "timed_round" ? null : 40,
      loadUnit: "lb" as const,
      logMode: knownLogMode(set.logMode),
      durationSeconds: timed ? 60 : null,
      completed: true,
    };
  });
}

describe("calendar schedule list", () => {
  it("formats Today, Tomorrow, then weekday headings with ordinals", () => {
    expect(ordinalDay(22)).toBe("22nd");
    expect(ordinalDay(23)).toBe("23rd");
    expect(ordinalDay(1)).toBe("1st");
    expect(ordinalDay(11)).toBe("11th");
    expect(formatCalendarHeading(tuesday, tuesday)).toBe("Today · Tuesday, September 22nd");
    expect(formatCalendarHeading(new Date(2026, 8, 23, 10, 0, 0), tuesday)).toBe(
      "Tomorrow · Wednesday, September 23rd",
    );
    expect(formatCalendarHeading(new Date(2026, 8, 24, 10, 0, 0), tuesday)).toBe(
      "Thursday, September 24th",
    );
  });

  it("names today and tomorrow in the member timezone", () => {
    // Thursday 00:30 in Sydney is still Wednesday afternoon in Denver.
    const instant = new Date("2026-10-15T00:30:00+11:00");
    expect(formatCalendarHeading(instant, instant, "Australia/Sydney")).toBe(
      "Today · Thursday, October 15th",
    );
    expect(formatCalendarHeading(instant, instant, "America/Denver")).toBe(
      "Today · Wednesday, October 14th",
    );
    expect(
      formatCalendarHeading(addZonedDays(instant, 1, "Australia/Sydney"), instant, "Australia/Sydney"),
    ).toBe("Tomorrow · Friday, October 16th");
    expect(
      formatCalendarHeading(addZonedDays(instant, 2, "Australia/Sydney"), instant, "Australia/Sydney"),
    ).toBe("Saturday, October 17th");
  });

  it("defaults training days to Mon/Wed/Fri and keeps member availability when set", () => {
    expect(resolveTrainingWeekdays([])).toEqual(["Monday", "Wednesday", "Friday"]);
    expect(resolveTrainingWeekdays(["Saturday", "Sunday"])).toEqual(["Saturday", "Sunday"]);
  });

  it("places DEMO workouts on training days and leaves rest days empty", () => {
    const days = buildCalendarDays({
      now: tuesday,
      programDays: [
        { id: "d1", title: "Day 1 — Lower body + power", dayNumber: 1 },
        { id: "d2", title: "Day 2 — Upper body + grip", dayNumber: 2 },
        { id: "d3", title: "Day 3 — Hinge, pull, and conditioning", dayNumber: 3 },
      ],
      availability: ["Monday", "Wednesday", "Friday"],
      completedOnDay: new Set(),
      startDayNumber: 1,
      includeReport: true,
      challenge: { title: "DEMO — Show up this month", complete: false },
    });

    expect(days[0]?.heading).toBe("Today · Tuesday, September 22nd");
    expect(days[0]?.isToday).toBe(true);
    expect(days[0]?.activities.filter((row) => row.kind === "workout")).toEqual([]);

    const tomorrow = days[1];
    expect(tomorrow?.heading).toBe("Tomorrow · Wednesday, September 23rd");
    expect(tomorrow?.activities[0]).toMatchObject({
      kind: "workout",
      title: "Day 1 — Lower body + power",
      subtitle: "Complete your scheduled workout.",
      href: "/training/d1",
      status: "scheduled",
    });

    expect(days[2]?.activities.filter((row) => row.kind === "workout")).toEqual([]);
    expect(days[3]?.activities[0]?.title).toBe("Day 2 — Upper body + grip");
    expect(days[3]?.activities[0]?.href).toBe("/training/d2");

    const sunday = days.find((day) => day.heading.startsWith("Sunday"));
    expect(sunday?.activities.some((row) => row.kind === "report" && row.href === "/report")).toBe(
      true,
    );
    const saturday = days.find((day) => day.heading.startsWith("Saturday"));
    expect(saturday?.activities.some((row) => row.kind === "challenge")).toBe(true);
  });

  it("marks a workout complete when the member already logged that local day", () => {
    const days = buildCalendarDays({
      now: tuesday,
      programDays: [{ id: "d1", title: "Day 1 — Lower body + power", dayNumber: 1 }],
      availability: ["Wednesday"],
      completedOnDay: new Set(["2026-09-23"]),
      includeReport: false,
    });
    expect(days[1]?.activities[0]).toMatchObject({
      status: "complete",
      subtitle: "Workout logged. Open to review or run it again.",
    });
  });
});

describe("calendar schedule loader", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("loads DEMO day cards that open the training day overview for that member", async () => {
    const user = await makeUser("calendar@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const program = await getDemoProgram();
    const schedule = await getCalendarSchedule(user.id, tuesday);
    const workouts = schedule.days.flatMap((day) =>
      day.activities.filter((row) => row.kind === "workout"),
    );
    expect(workouts.length).toBeGreaterThan(0);
    expect(
      workouts.every(
        (row) =>
          row.href.startsWith("/training/") ||
          row.href.startsWith("/mobility/") ||
          row.href.startsWith("/timer"),
      ),
    ).toBe(true);
    expect(workouts.some((row) => /bag|clinch|ground-and-pound|sprawl/i.test(row.title))).toBe(
      false,
    );
    expect(workouts.some((row) => /full body|circuit|bike|mobility/i.test(row.title))).toBe(true);
    expect(workouts.some((row) => program.days.some((day) => row.href === `/training/${day.id}`))).toBe(
      true,
    );
    const wednesday = schedule.days.find((day) => day.heading.startsWith("Tomorrow"));
    const wedWorkouts = wednesday?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(wedWorkouts.length).toBe(2);

    const target = wedWorkouts.find((row) => row.programDayId);
    expect(target?.programDayId).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: target?.programDayId ?? "",
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date(2026, 8, 23, 12, 0, 0),
      notes: "",
      status: "complete",
      sets: finishEverySet(session),
    });

    const after = await getCalendarSchedule(user.id, tuesday);
    const wed = after.days.find((day) => day.heading.startsWith("Tomorrow"));
    const afterWork = wed?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(afterWork.find((row) => row.programDayId === target?.programDayId)?.status).toBe("complete");
    expect(afterWork.some((row) => row.programDayId !== target?.programDayId && row.status === "scheduled")).toBe(
      true,
    );
    const tally = weekSessionTally(after.days);
    expect(tally.done).toBe(1);
    expect(tally.total).toBeGreaterThan(1);
  });

  it("does not mark Done when only one planned set is saved", async () => {
    const user = await makeUser("calendar-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const schedule = await getCalendarSchedule(user.id, tuesday);
    let picked: {
      session: Awaited<ReturnType<typeof startWorkoutFromDay>>;
      performedAt: Date;
      programDayId: string;
    } | null = null;
    for (const day of schedule.days) {
      for (const activity of day.activities) {
        if (activity.kind !== "workout" || !activity.programDayId) continue;
        const started = await startWorkoutFromDay({
          userId: user.id,
          programDayId: activity.programDayId,
          preferredUnits: "lb",
        });
        if ((started.plannedSetCount ?? 0) > 1) {
          picked = { session: started, performedAt: day.date, programDayId: activity.programDayId };
          break;
        }
        await prisma.workoutSession.delete({ where: { id: started.id } });
      }
      if (picked) break;
    }
    expect(picked).toBeTruthy();
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: picked!.session.id,
      title: picked!.session.title,
      performedAt: picked!.performedAt,
      notes: "",
      status: "complete",
      sets: [tickedPlannedSet(picked!.session)],
    });

    const after = await getCalendarSchedule(user.id, tuesday);
    const logged = after.days
      .flatMap((day) => day.activities)
      .find((row) => row.kind === "workout" && row.programDayId === picked!.programDayId);
    expect(logged?.status).toBe("scheduled");
    expect(logged?.subtitle.startsWith("Partial")).toBe(true);
    expect(logged?.subtitle).not.toContain("Logged this day");
    expect(weekSessionTally(after.days).done).toBe(0);
    expect(
      await completedProgramDayIdsOnDay(user.id, [picked!.programDayId], picked!.performedAt, APP_TIMEZONE),
    ).toEqual([]);

    await prisma.workoutSession.update({
      where: { id: picked!.session.id },
      data: { plannedSetCount: null },
    });
    const legacy = await getCalendarSchedule(user.id, tuesday);
    const legacyRow = legacy.days
      .flatMap((day) => day.activities)
      .find((row) => row.kind === "workout" && row.programDayId === picked!.programDayId);
    expect(legacyRow?.status).toBe("scheduled");
    expect(legacyRow?.subtitle.startsWith("Partial")).toBe(true);
    expect(
      await completedProgramDayIdsOnDay(user.id, [picked!.programDayId], picked!.performedAt, APP_TIMEZONE),
    ).toEqual([]);
  });

  it("lists the whole week, including a logged past day and a missed day", async () => {
    const user = await makeUser("calendar-history@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const monday = new Date(2026, 8, 21, 10, 0, 0);
    const wednesday = new Date(2026, 8, 23, 10, 0, 0);
    expect(listWeekDates(wednesday)).toHaveLength(7);

    const before = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayBefore =
      before.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    const loggedDayId = mondayBefore.find((row) => row.programDayId)?.programDayId;
    expect(loggedDayId).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: loggedDayId ?? "",
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: monday,
      notes: "",
      status: "complete",
      sets: finishEverySet(session),
    });

    const schedule = await getCalendarSchedule(user.id, wednesday, monday);
    expect(schedule.days).toHaveLength(7);
    expect(schedule.days[0]?.heading.startsWith("Monday")).toBe(true);
    expect(schedule.days[0]?.isToday).toBe(false);
    const mondayWorkouts =
      schedule.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(mondayWorkouts).toHaveLength(1);
    const logged = mondayWorkouts.filter((row) => row.programDayId === loggedDayId);
    expect(logged).toHaveLength(1);
    expect(logged.every((row) => row.status === "complete")).toBe(true);
    expect(logged[0]?.subtitle).toContain("Logged this day");
    expect(mondayWorkouts.some((row) => row.status === "scheduled")).toBe(false);

    const tuesdayRow = schedule.days[1];
    const tuesdayWorkouts = tuesdayRow?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(tuesdayWorkouts.length).toBeGreaterThan(0);
    expect(tuesdayWorkouts.every((row) => row.status === "scheduled")).toBe(true);
    expect(tuesdayWorkouts[0]?.subtitle).toContain("Missed");
    const workouts = schedule.days.flatMap((day) => day.activities.filter((row) => row.kind === "workout"));
    expect(workouts.some((row) => row.subtitle.includes("Core week plan."))).toBe(false);
    expect(workouts.some((row) => row.subtitle.includes("DEMO"))).toBe(false);
  });

  it("links a logged Monday workout after its catalog id is gone, including a UTC-midnight stamp", async () => {
    const user = await makeUser("monday-link@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
        timeZone: "America/Denver",
      },
    });
    const monday = new Date(2026, 8, 21, 10, 0, 0);
    const wednesday = new Date(2026, 8, 23, 10, 0, 0);
    const before = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayBefore = before.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    const loggedDayId = mondayBefore.find((row) => row.programDayId)?.programDayId ?? "";
    expect(loggedDayId).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: loggedDayId,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date("2026-09-21T00:00:00.000Z"),
      notes: "",
      status: "draft",
      sets: [tickedPlannedSet(session)],
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { programDayId: null },
    });

    const schedule = await getCalendarSchedule(user.id, wednesday, monday);
    const mondayWorkouts = schedule.days[0]?.activities.filter((row) => row.kind === "workout") ?? [];
    const logged = mondayWorkouts.filter((row) => row.programDayId === loggedDayId);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((row) => row.status === "complete")).toBe(false);
    expect(logged.some((row) => row.subtitle.startsWith("Partial"))).toBe(true);
    expect(logged.some((row) => row.setCountLabel?.startsWith("1/"))).toBe(true);
    const tally = weekSessionTally(schedule.days);
    expect(tally.done).toBe(0);
    const linked = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(linked.status).toBe("partial");
    expect(linked.programDayId).toBe(loggedDayId);

    const sundayWork = schedule.days[6]?.activities.filter((row) => row.kind === "workout") ?? [];
    expect(sundayWork.every((row) => row.status !== "complete")).toBe(true);
  });
});
