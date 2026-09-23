import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import {
  buildCalendarDays,
  formatCalendarHeading,
  getCalendarSchedule,
  ordinalDay,
  resolveTrainingWeekdays,
} from "@/lib/calendar";

const tuesday = new Date(2026, 8, 22, 10, 0, 0);

describe("calendar schedule list", () => {
  it("formats Today, Tomorrow, then weekday headings with ordinals", () => {
    expect(ordinalDay(22)).toBe("22nd");
    expect(ordinalDay(23)).toBe("23rd");
    expect(ordinalDay(1)).toBe("1st");
    expect(ordinalDay(11)).toBe("11th");
    expect(formatCalendarHeading(tuesday, tuesday)).toBe("Today, September 22nd");
    expect(formatCalendarHeading(new Date(2026, 8, 23), tuesday)).toBe(
      "Tomorrow, September 23rd",
    );
    expect(formatCalendarHeading(new Date(2026, 8, 24), tuesday)).toBe(
      "Thursday, September 24th",
    );
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

    expect(days[0]?.heading).toBe("Today, September 22nd");
    expect(days[0]?.isToday).toBe(true);
    expect(days[0]?.activities.filter((row) => row.kind === "workout")).toEqual([]);

    const tomorrow = days[1];
    expect(tomorrow?.heading).toBe("Tomorrow, September 23rd");
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
    expect(workouts.every((row) => row.href.startsWith("/training/"))).toBe(true);
    expect(workouts.some((row) => /bag|clinch|ground-and-pound|sprawl/i.test(row.title))).toBe(
      true,
    );
    expect(workouts.some((row) => program.days.some((day) => row.href === `/training/${day.id}`))).toBe(
      true,
    );

    const firstDay = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: firstDay.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date(2026, 8, 23, 12, 0, 0),
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

    const after = await getCalendarSchedule(user.id, tuesday);
    const wed = after.days.find((day) => day.heading.startsWith("Tomorrow"));
    expect(wed?.activities.some((row) => row.kind === "workout" && row.status === "complete")).toBe(
      true,
    );
  });
});
