import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  completedLocalDayKeys,
  startWorkoutFromDay,
} from "@/lib/workouts";
import { completedSessionIdsByLocalDay } from "@/lib/chip-completion";
import { getCalendarSchedule } from "@/lib/calendar";
import {
  calendarPlanDoses,
  calendarScaleContext,
  calendarScaleLoadCount,
  calendarScaledCatalog,
  scaledPlanByProgramDay,
} from "@/lib/plan-doses";
import {
  offPlanSessionDone,
  prescribedSetTotal,
  sessionCountsAsPlannedCompletion,
} from "@/lib/logged-work";
import { planWeekIndex } from "@/lib/week-plan";
import { APP_TIMEZONE, addZonedDays, dayKey } from "@/lib/timezone";

describe("scaled dose agreement", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("treats a finished swap as done and a short original log as partial", () => {
    const plan = ["Goblet squat", "Bench press"];
    expect(
      offPlanSessionDone(
        {
          status: "complete",
          plannedSetCount: null,
          sets: [
            { exerciseName: "Landmine press", completed: true, reps: 8, loadValue: 40 },
            { exerciseName: "Landmine press", completed: true, reps: 8, loadValue: 40 },
          ],
        },
        12,
        plan,
      ),
    ).toBe(true);
    expect(
      offPlanSessionDone(
        {
          status: "complete",
          plannedSetCount: null,
          sets: [{ exerciseName: "Goblet squat", completed: true, reps: 8, loadValue: 40 }],
        },
        12,
        plan,
      ),
    ).toBe(false);
    expect(
      offPlanSessionDone(
        {
          status: "complete",
          plannedSetCount: 4,
          sets: [
            { exerciseName: "Landmine press", completed: true, reps: 8, loadValue: 40 },
            { exerciseName: "Landmine press", completed: false, reps: 8, loadValue: 40 },
          ],
        },
        12,
        plan,
      ),
    ).toBe(false);
  });

  it("shares one scaled-catalog load across the calendar and the check marks", async () => {
    await resetDatabase();
    const user = await makeUser("scale-cache@example.com");
    const now = new Date(2026, 9, 22, 10, 0, 0);
    const before = calendarScaleLoadCount();
    const [doses, scale] = await Promise.all([
      calendarPlanDoses(user.id, now),
      calendarScaleContext(user.id, now),
      getCalendarSchedule(user.id, now),
    ]);
    expect(calendarScaleLoadCount() - before).toBe(1);
    expect(doses).toBe(scale.planByDay);
    expect(doses.size).toBeGreaterThan(0);
  });

  it("keeps the chip check on the calendar scaled dose when the stored count is missing", async () => {
    await resetDatabase();
    const user = await makeUser("scaled-check@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        experienceLevel: "advanced",
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const anchor = new Date(2026, 9, 22, 10, 0, 0);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    const catalog = await findDemoTrainingCatalog();
    const plans = scaledPlanByProgramDay(
      calendarScaledCatalog(catalog, {
        experienceLevel: profile.experienceLevel,
        competitionStatus: profile.competitionStatus,
        weightAccess: profile.weightAccess,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        now: anchor,
        timeZone: APP_TIMEZONE,
        camp: null,
      }),
    );
    const weekIndex = planWeekIndex(anchor, APP_TIMEZONE, profile.onboardingCompletedAt);
    let picked: { programDayId: string; sessionId: string; raw: number } | null = null;
    for (const programDay of [...(catalog.strength?.days ?? []), ...(catalog.skill?.days ?? [])]) {
      const plan = plans.get(programDay.id);
      const raw = prescribedSetTotal(programDay.exercises);
      const rawNames = programDay.exercises.map((exercise) => exercise.name.trim()).filter(Boolean);
      if (!plan || plan.dose <= raw || raw < 1) continue;
      if (!rawNames.every((name) => plan.names.includes(name))) continue;
      const started = await startWorkoutFromDay({
        userId: user.id,
        programDayId: programDay.id,
        preferredUnits: "lb",
        now: anchor,
        timeZone: APP_TIMEZONE,
        planAnchor: profile.onboardingCompletedAt,
        scale: {
          experienceLevel: "advanced",
          competitionStatus: profile.competitionStatus,
          weightAccess: profile.weightAccess,
          weekIndex,
        },
      });
      const pools = new Map<string, string[]>();
      for (const set of started.sets) {
        const list = pools.get(set.exerciseName) ?? [];
        list.push(set.id);
        pools.set(set.exerciseName, list);
      }
      const chosen: string[] = [];
      let namesFit = true;
      for (const name of rawNames) {
        const id = pools.get(name)?.shift();
        if (!id) {
          namesFit = false;
          break;
        }
        chosen.push(id);
      }
      for (const set of started.sets) {
        if (chosen.length >= raw) break;
        if (!chosen.includes(set.id)) chosen.push(set.id);
      }
      if (!namesFit || chosen.length < raw || chosen.length >= plan.dose) {
        await prisma.workoutSession.delete({ where: { id: started.id } });
        continue;
      }
      await prisma.workoutSet.updateMany({
        where: { workoutSessionId: started.id },
        data: { completed: false, reps: null, loadValue: null, durationSeconds: null },
      });
      await prisma.workoutSet.updateMany({
        where: { id: { in: chosen } },
        data: { completed: true, reps: 8, loadValue: 40 },
      });
      await prisma.workoutSession.update({
        where: { id: started.id },
        data: { status: "complete", plannedSetCount: null, performedAt: anchor },
      });
      picked = { programDayId: programDay.id, sessionId: started.id, raw };
      break;
    }
    expect(picked).toBeTruthy();
    const stored = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: picked!.sessionId },
      include: { sets: true, programDay: { include: { exercises: true } } },
    });
    expect(
      sessionCountsAsPlannedCompletion(
        { ...stored, plannedSetCount: null },
        stored.programDay?.exercises.map((exercise) => exercise.name) ?? [],
        picked!.raw,
      ),
    ).toBe(true);

    const day = dayKey(anchor, APP_TIMEZONE);
    const from = addZonedDays(anchor, -1, APP_TIMEZONE);
    const to = addZonedDays(anchor, 2, APP_TIMEZONE);
    const schedule = await getCalendarSchedule(user.id, anchor);
    const card = schedule.days
      .flatMap((item) => item.activities)
      .find((item) => item.kind === "workout" && item.programDayId === picked!.programDayId);
    expect(card?.status).not.toBe("complete");
    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE, anchor);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE, anchor);
    expect(keys.includes(day)).toBe(false);
    expect((chips[day] ?? []).includes(picked!.programDayId)).toBe(false);
  });

  it("does not call a finished off-plan swap Partial", async () => {
    await resetDatabase();
    const user = await makeUser("offplan-swap@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const thursday = new Date(2026, 9, 22, 15, 0, 0);
    const tuesday = new Date(2026, 9, 20, 11, 0, 0);
    const before = await getCalendarSchedule(user.id, thursday, tuesday);
    const mondayKey = dayKey(new Date(2026, 9, 19, 10, 0, 0), APP_TIMEZONE);
    const monday = before.days.find((day) => dayKey(day.date, APP_TIMEZONE) === mondayKey);
    const lift = monday?.activities.find((item) => item.kind === "workout" && item.programDayId);
    expect(lift?.programDayId).toBeTruthy();
    const programDay = await prisma.programDay.findUniqueOrThrow({
      where: { id: lift!.programDayId! },
      include: { exercises: true },
    });
    const catalogDose = prescribedSetTotal(programDay.exercises);
    expect(catalogDose).toBeGreaterThan(2);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: programDay.id,
        title: "Swapped lift",
        performedAt: tuesday,
        status: "complete",
        plannedSetCount: null,
        sets: {
          create: [1, 2].map((setNumber) => ({
            exerciseName: "Swap kettlebell swing",
            setNumber,
            reps: 10,
            loadValue: 35,
            completed: true,
          })),
        },
      },
    });
    const after = await getCalendarSchedule(user.id, thursday, tuesday);
    const tuesdayKey = dayKey(tuesday, APP_TIMEZONE);
    const card = after.days
      .find((day) => dayKey(day.date, APP_TIMEZONE) === tuesdayKey)
      ?.activities.find((item) => item.kind === "workout" && item.programDayId === programDay.id);
    expect(card?.subtitle.startsWith("Logged this day")).toBe(true);
    expect(card?.subtitle.startsWith("Partial")).toBe(false);
    expect(card?.status).toBe("complete");
  });
});
