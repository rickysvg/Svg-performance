import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  completedLocalDayKeys,
  reopenCompletedWorkoutForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { completedSessionIdsByLocalDay, partialLocalDayKeys } from "@/lib/chip-completion";
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
    ).toBe(false);
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
        2,
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

  it("keeps a short off-plan swap Partial on the calendar and the chip", async () => {
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
    expect(card?.subtitle.startsWith("Partial")).toBe(true);
    expect(card?.status).not.toBe("complete");
    const from = addZonedDays(tuesday, -1, APP_TIMEZONE);
    const to = addZonedDays(tuesday, 2, APP_TIMEZONE);
    const planByDay = await calendarPlanDoses(user.id, thursday);
    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE, thursday);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE, thursday);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, planByDay);
    expect(keys.includes(tuesdayKey)).toBe(false);
    expect((chips[tuesdayKey] ?? []).includes(programDay.id)).toBe(false);
    expect(partials.includes(tuesdayKey)).toBe(true);
  });

  it("calls a swap Logged only when the ticked sets cover the scaled dose", async () => {
    await resetDatabase();
    const user = await makeUser("offplan-swap-done@example.com");
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
    const doses = await calendarPlanDoses(user.id, thursday);
    const dose = doses.get(lift!.programDayId!)?.dose ?? 0;
    expect(dose).toBeGreaterThan(2);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: lift!.programDayId!,
        title: "Swapped lift",
        performedAt: tuesday,
        status: "complete",
        plannedSetCount: null,
        sets: {
          create: Array.from({ length: dose }, (_, index) => ({
            exerciseName: "Swap kettlebell swing",
            setNumber: (index % 20) + 1,
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
      ?.activities.find((item) => item.kind === "workout" && item.programDayId === lift!.programDayId);
    expect(card?.subtitle.startsWith("Logged this day")).toBe(true);
    expect(card?.status).toBe("complete");
    const from = addZonedDays(tuesday, -1, APP_TIMEZONE);
    const to = addZonedDays(tuesday, 2, APP_TIMEZONE);
    const planByDay = await calendarPlanDoses(user.id, thursday);
    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE, thursday);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE, thursday);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, planByDay);
    expect(keys.includes(tuesdayKey)).toBe(true);
    expect((chips[tuesdayKey] ?? []).includes(lift!.programDayId!)).toBe(true);
    expect(partials.includes(tuesdayKey)).toBe(false);
  });

  it("reads an old log as Logged when the ticked sets cover the scaled dose", async () => {
    await resetDatabase();
    const user = await makeUser("scaled-logged@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        experienceLevel: "beginner",
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
    let picked: { programDayId: string; raw: number; dose: number } | null = null;
    for (const programDay of [...(catalog.strength?.days ?? []), ...(catalog.skill?.days ?? [])]) {
      const plan = plans.get(programDay.id);
      const raw = prescribedSetTotal(programDay.exercises);
      if (!plan || plan.dose <= 0 || plan.dose >= raw || plan.names.length === 0) continue;
      picked = { programDayId: programDay.id, raw, dose: plan.dose };
      break;
    }
    expect(picked).toBeTruthy();
    const plan = plans.get(picked!.programDayId)!;
    const perName = new Map<string, number>();
    for (const name of plan.names) perName.set(name, (perName.get(name) ?? 0) + 1);
    const rows: { exerciseName: string; setNumber: number; reps: number; loadValue: number; completed: boolean }[] = [];
    for (const name of plan.names) {
      const count = Math.max(1, perName.get(name) ?? 1);
      for (let index = 0; index < count; index += 1) {
        rows.push({
          exerciseName: name,
          setNumber: index + 1,
          reps: 8,
          loadValue: 40,
          completed: true,
        });
      }
    }
    while (rows.length < plan.dose) {
      const name = plan.names[rows.length % plan.names.length]!;
      rows.push({
        exerciseName: name,
        setNumber: rows.filter((row) => row.exerciseName === name).length + 1,
        reps: 8,
        loadValue: 40,
        completed: true,
      });
    }
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: picked!.programDayId,
        title: "Old scaled log",
        performedAt: anchor,
        status: "complete",
        plannedSetCount: null,
        sets: { create: rows.slice(0, plan.dose) },
      },
    });
    const stored = await prisma.workoutSession.findFirstOrThrow({
      where: { userId: user.id },
      include: { sets: true, programDay: { include: { exercises: true } } },
    });
    expect(
      sessionCountsAsPlannedCompletion(
        stored,
        stored.programDay?.exercises.map((exercise) => exercise.name) ?? [],
        picked!.raw,
      ),
    ).toBe(false);
    const day = dayKey(anchor, APP_TIMEZONE);
    const from = addZonedDays(anchor, -1, APP_TIMEZONE);
    const to = addZonedDays(anchor, 2, APP_TIMEZONE);
    const schedule = await getCalendarSchedule(user.id, anchor);
    const card = schedule.days
      .find((item) => dayKey(item.date, APP_TIMEZONE) === day)
      ?.activities.find((item) => item.kind === "workout" && item.programDayId === picked!.programDayId);
    expect(card?.status).toBe("complete");
    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE, anchor);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE, anchor);
    expect(keys.includes(day)).toBe(true);
    expect((chips[day] ?? []).includes(picked!.programDayId)).toBe(true);
  });

  it("shows today's one-set lift as partial when the saved name is off the scaled plan", async () => {
    await resetDatabase();
    const user = await makeUser("today-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const thursday = new Date(2026, 9, 22, 10, 0, 0);
    const before = await getCalendarSchedule(user.id, thursday);
    const today = before.days.find((day) => day.isToday);
    const lift = today?.activities.find(
      (item) => item.kind === "workout" && item.programDayId && /Lift 3/i.test(item.title),
    );
    expect(lift?.programDayId).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: lift!.programDayId!,
      preferredUnits: "lb",
      now: thursday,
      timeZone: APP_TIMEZONE,
    });
    const planned = started.plannedSetCount ?? started.sets.length;
    expect(planned).toBeGreaterThan(1);
    const first = started.sets[0]!;
    await prisma.workoutSet.deleteMany({
      where: { workoutSessionId: started.id, id: { not: first.id } },
    });
    await prisma.workoutSet.update({
      where: { id: first.id },
      data: { exerciseName: "Swap kettlebell swing", completed: true, reps: 8, loadValue: null },
    });
    await prisma.workoutSession.update({
      where: { id: started.id },
      data: { status: "complete", plannedSetCount: planned, performedAt: thursday },
    });
    const after = await getCalendarSchedule(user.id, thursday);
    const card = after.days
      .find((day) => day.isToday)
      ?.activities.find((item) => item.kind === "workout" && item.programDayId === lift!.programDayId);
    expect(card?.setCountLabel).toMatch(/^1\/\d+ sets$/);
    expect(card?.setCountLabel?.endsWith(" sets") && !card.setCountLabel.includes("/")).toBe(false);
    expect(card?.subtitle.startsWith("Partial")).toBe(true);
    expect(card?.status).not.toBe("complete");
    const day = dayKey(thursday, APP_TIMEZONE);
    const from = addZonedDays(thursday, -1, APP_TIMEZONE);
    const to = addZonedDays(thursday, 2, APP_TIMEZONE);
    const planByDay = await calendarPlanDoses(user.id, thursday);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, planByDay);
    expect(partials.includes(day)).toBe(true);
  });

  it("keeps every planned exercise on a one-set save and resumes the full logger", async () => {
    await resetDatabase();
    const user = await makeUser("partial-save@example.com");
    const catalog = await findDemoTrainingCatalog();
    const day = catalog.strength?.days.find((row) => /Lift 3/i.test(row.title));
    expect(day?.id).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const planned = started.plannedSetCount ?? started.sets.length;
    const names = new Set(started.sets.map((set) => set.exerciseName));
    expect(names.size).toBeGreaterThan(1);
    const first = started.sets[0]!;
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: first.exerciseName,
          setNumber: first.setNumber,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
          prescriptionKey: first.prescriptionKey,
        },
      ],
    });
    expect(new Set(saved.sets.map((set) => set.exerciseName))).toEqual(names);
    expect(saved.sets.length).toBe(started.sets.length);
    expect(saved.plannedSetCount).toBe(planned);
    const reopened = await reopenCompletedWorkoutForUser(user.id, saved.id);
    expect(reopened.status).toBe("draft");
    const page = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/(member)/training/log/[sessionId]/page.tsx", "utf8"),
    );
    const form = await import("node:fs").then((fs) =>
      fs.readFileSync("src/components/training/WorkoutLogForm.tsx", "utf8"),
    );
    expect(page).toContain("Resume workout");
    expect(form).toContain('session.status !== "complete"');
    expect(form).toContain("data-move-up");
    expect(form).toContain("<ExerciseCardMenu");
  });

  it("saves a ticked set that only has the plan reps and an empty load", async () => {
    await resetDatabase();
    const user = await makeUser("bodyweight-tick@example.com");
    const catalog = await findDemoTrainingCatalog();
    const day = catalog.strength?.days.find((row) => /Lift 3/i.test(row.title));
    expect(day?.id).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const target = started.sets.find((set) => /\d/.test(set.prescriptionKey) && set.logMode !== "timed" && set.logMode !== "timed_round" && set.logMode !== "load_timed");
    expect(target).toBeTruthy();
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: "",
      status: "complete",
      sets: started.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        logMode: set.logMode === "load_reps" || set.logMode === "reps_only" ? set.logMode : undefined,
        durationSeconds: null,
        completed: set.id === target!.id,
        prescriptionKey: set.prescriptionKey,
      })),
    });
    const stored = saved.sets.find(
      (set) => set.exerciseName === target!.exerciseName && set.setNumber === target!.setNumber,
    );
    expect(stored?.completed).toBe(true);
    expect(stored?.reps).toBeGreaterThan(0);
    expect(stored?.loadValue).toBeNull();
    await expect(
      updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: started.id,
        title: started.title,
        performedAt: started.performedAt,
        notes: "",
        status: "complete",
        sets: [
          {
            exerciseName: "Empty check",
            setNumber: 1,
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            completed: true,
          },
        ],
      }),
    ).rejects.toThrow(/empty check/i);
  });
});
