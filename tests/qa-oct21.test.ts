import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  getLatestBodyMetricsForUser,
  getRecentBodyFatForUser,
  recordWeightEntryForUser,
} from "@/lib/body-metrics";
import { weekTrainingSnapshot } from "@/lib/weekly-checkin";
import { mealTypeForTime, mealTypeForZonedNow } from "@/lib/nutrition";
import { futureWorkoutPulledBack } from "@/lib/week-plan-swaps";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { getCalendarSchedule, weekSessionTally } from "@/lib/calendar";
import { formatDayParam } from "@/lib/home";
import { getDemoProgram } from "@/lib/programs";
import { completedLocalDayKeys, completedProgramDayIdsOnDays, startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { addZonedDays, mondayOfZoned } from "@/lib/timezone";

const wednesday = new Date("2026-10-21T16:00:00.000Z");

describe("QA Oct 21 rules", () => {
  it("treats 7:28 AM as breakfast and keeps today selectable in the move picker", () => {
    expect(mealTypeForTime(new Date(2026, 9, 21, 7, 28))).toBe("breakfast");
    expect(mealTypeForTime(new Date(2026, 9, 21, 12, 5))).toBe("lunch");
    expect(mealTypeForTime(new Date(2026, 9, 21, 18, 0))).toBe("dinner");
    expect(mealTypeForTime(new Date(2026, 9, 21, 22, 15))).toBe("snack");
    expect(mealTypeForZonedNow(new Date("2026-10-21T13:28:00.000Z"), "America/Denver")).toBe(
      "breakfast",
    );
    expect(mealTypeForZonedNow(new Date("2026-10-21T18:05:00.000Z"), "America/Denver")).toBe("lunch");
    expect(futureWorkoutPulledBack("Thursday:lift", "Wednesday", "Wednesday")).toBe(false);
    expect(futureWorkoutPulledBack("Thursday:lift", "Tuesday", "Wednesday")).toBe(true);
  });

  it("keeps a done set with blank reps done when that exercise is swapped", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
      ],
      ["Squat"],
      {
        name: "Goblet squat",
        sets: 3,
        reps: "8",
        loadText: "",
        logMode: "load_reps",
      },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    expect(merged[0]).toMatchObject({
      exerciseName: "Goblet squat",
      completed: true,
      reps: null,
    });
  });
});

describe("QA Oct 21 saved logs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores home body fat where Progress and check-in read it", async () => {
    const user = await makeUser("qa-oct21-fat@example.com");
    await recordWeightEntryForUser(user.id, {
      value: 180,
      unit: "lb",
      recordedAt: new Date("2026-10-21T14:00:00.000Z"),
      bodyFatPercent: 15.5,
    });
    const recent = await getRecentBodyFatForUser(user.id, 1);
    expect(recent[0]?.value).toBe(15.5);
    const latest = await getLatestBodyMetricsForUser(user.id);
    expect(latest.get("bodyFat")?.value).toBe(15.5);
    expect(latest.get("weight")?.value).toBe(180);
    const snapshot = await weekTrainingSnapshot(
      user.id,
      new Date("2026-10-21T18:00:00.000Z"),
      "America/Denver",
    );
    expect(snapshot.suggestedBodyFatPercent).toBe(15.5);
    expect(snapshot.suggestedWeightLb).toBe(180);
  });

  it("marks Thursday's lift done on the calendar when it was finished earlier in the week", async () => {
    const user = await makeUser("qa-oct21-early@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
        timeZone: "America/Denver",
      },
    });
    const before = await getCalendarSchedule(user.id, wednesday, wednesday);
    const thursday = before.days.find((day) => day.heading.includes("Thursday"));
    const lift = thursday?.activities.find(
      (item) => item.kind === "workout" && item.programDayId && /lift/i.test(item.title),
    );
    expect(lift?.programDayId).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: lift?.programDayId ?? "",
      preferredUnits: "lb",
      timeZone: "America/Denver",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: wednesday,
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
      timeZone: "America/Denver",
    });

    const after = await getCalendarSchedule(user.id, wednesday, wednesday);
    const thursdayAfter = after.days.find((day) => day.heading.includes("Thursday"));
    const finished = thursdayAfter?.activities.find((item) => item.programDayId === lift?.programDayId);
    expect(finished?.status).toBe("complete");
    expect(finished?.subtitle.startsWith("Missed")).toBe(false);
    const monday = mondayOfZoned(wednesday, "America/Denver");
    const logged = await completedLocalDayKeys(
      user.id,
      addZonedDays(monday, -1, "America/Denver"),
      addZonedDays(monday, 8, "America/Denver"),
      "America/Denver",
    );
    const doneIds = await completedProgramDayIdsOnDays(
      user.id,
      after.days.map((day) => formatDayParam(day.date, "America/Denver")),
      "America/Denver",
    );
    expect(doneIds).toContain(lift?.programDayId);
    expect(logged.length).toBeGreaterThan(0);
    expect(weekSessionTally(after.days).done).toBeGreaterThan(0);
  });

  it("keeps a blank done set checked after a later save", async () => {
    const user = await makeUser("qa-oct21-set@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1) ?? program.days[0];
    expect(day?.id).toBeTruthy();
    const draft = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day?.id ?? "",
      preferredUnits: "lb",
    });
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: draft.id,
      title: draft.title,
      performedAt: wednesday,
      notes: "",
      status: "draft",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
        {
          exerciseName: "One-arm row",
          setNumber: 1,
          reps: 8,
          loadValue: 30,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
      ],
    });
    const squat = saved.sets.find((set) => set.exerciseName === "Goblet squat");
    expect(squat?.completed).toBe(true);
    expect(squat?.reps).toBeNull();
  });
});
