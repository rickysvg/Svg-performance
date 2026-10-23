import fs from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { libraryExercise } from "@/lib/exercise-library";
import {
  addedPrescriptionKey,
  draftsForLibraryExercise,
  exerciseNamesInOrder,
  insertSetsAtExercise,
} from "@/lib/logger-insert";
import { isDurationMode, isLogMode, resolveLogMode } from "@/lib/exercise-log-mode";
import { ForbiddenError } from "@/lib/errors";
import {
  applySavedWorkoutToDay,
  createSavedWorkout,
  deleteSavedWorkoutForUser,
  getSavedWorkoutForUser,
  revertDayToProgram,
  saveWorkoutFromSession,
  startDayPlanForUser,
  startSavedWorkoutForUser,
} from "@/lib/my-workouts";
import {
  applyPlansToProgramCards,
  homePlanSession,
  homeSessionsAfterPlans,
  defaultSavedWorkoutName,
  summaryAfterDayPlans,
  withDayPlans,
} from "@/lib/my-workout-plan";
import { planForDate, weekIndexFor } from "@/lib/week-plan";
import { getCalendarSchedule } from "@/lib/calendar";
import { APP_TIMEZONE, addZonedDays } from "@/lib/timezone";
import { formatDayParam, parseDayParam } from "@/lib/home";

describe("saved workout names and day overlay", () => {
  it("defaults to the day name and date", () => {
    expect(
      defaultSavedWorkoutName({
        title: "Day 12 — Lift 1",
        date: new Date("2026-10-20T18:00:00Z"),
        timeZone: "America/Denver",
      }),
    ).toBe("Lift 1 · Oct 20, 2026");
  });

  it("hides program cards on replace and keeps them for an extra session", () => {
    const cards = [{ title: "Lift 1" }, { title: "Bag" }];
    expect(applyPlansToProgramCards(cards, [{ mode: "replace" }])).toEqual({
      cards: [],
      replaced: true,
    });
    expect(applyPlansToProgramCards(cards, [{ mode: "extra" }]).cards).toEqual(cards);
    expect(summaryAfterDayPlans("Lift + bag", [{ mode: "replace", name: "Camp arms" }])).toBe("Camp arms");
    expect(summaryAfterDayPlans("Lift + bag", [{ mode: "extra", name: "Camp arms" }])).toBe("Lift + bag");
    const daru = homePlanSession({
      id: "plan-daru",
      mode: "replace",
      name: "Daru Alactic Power",
      exerciseNames: ["Assault bike"],
      exercises: [{ name: "Assault bike", sets: 1, restSeconds: 60 }],
      complete: false,
      partial: true,
      draftId: "draft-1",
    });
    expect(daru.title).toBe("Daru Alactic Power");
    expect(daru.startHref).toBe("/training/log/draft-1");
    expect(daru.dayId).toBe("plan:plan-daru");
    const shown = homeSessionsAfterPlans([{ title: "Lift 3", kind: "strength" }], [
      {
        id: "plan-daru",
        mode: "replace",
        name: "Daru Alactic Power",
        exerciseNames: ["Assault bike"],
        exercises: [{ name: "Assault bike", sets: 1, restSeconds: 60 }],
        complete: false,
        partial: true,
        draftId: null,
      },
    ]);
    expect(shown.map((row) => row.title)).toEqual(["Daru Alactic Power"]);
  });

  it("names the restore control Revert to default", () => {
    const source = fs.readFileSync("src/components/training/RevertDayButton.tsx", "utf8");
    expect(source).toContain("Revert to default");
    expect(source).not.toContain("Use the program workout");
  });

  it("adds the saved workout on the calendar without moving other workouts when it is extra", () => {
    const program = [
      { kind: "workout", title: "Lift 1" },
      { kind: "report", title: "Weekly SVG report" },
    ];
    const replaced = withDayPlans(program, [
      {
        id: "plan-1",
        name: "Camp arms",
        mode: "replace",
        exerciseCount: 3,
        complete: false,
        exerciseNames: ["Goblet squat"],
      },
    ]);
    expect(replaced.map((row) => row.title)).toEqual(["Weekly SVG report", "Camp arms"]);
    const keptLog = withDayPlans(
      [
        { kind: "workout", title: "Lift 3", status: "scheduled", subtitle: "Partial · 5/34 sets" },
        { kind: "workout", title: "Heavy bag rounds", status: "scheduled", subtitle: "Heavy bag rounds · Partial" },
        { kind: "workout", title: "Lift 1", status: "scheduled", subtitle: "Lift · Missed" },
        { kind: "report", title: "Weekly SVG report" },
      ],
      [
        {
          id: "plan-1",
          name: "Daru Alactic Power",
          mode: "replace",
          exerciseCount: 4,
          complete: false,
          partial: true,
          exerciseNames: ["Bike"],
        },
      ],
    );
    expect(keptLog.map((row) => row.title)).toEqual([
      "Lift 3",
      "Heavy bag rounds",
      "Weekly SVG report",
      "Daru Alactic Power",
    ]);
    const extra = withDayPlans(program, [
      { id: "plan-2", name: "Camp arms", mode: "extra", exerciseCount: 3, complete: true },
    ]);
    expect(extra.map((row) => row.title)).toEqual(["Lift 1", "Weekly SVG report", "Camp arms"]);
    expect(extra.find((row) => row.title === "Camp arms")).toMatchObject({ status: "complete" });
  });
});

describe("my workouts", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves order, sets, reps, rest, RIR, and load notes, and stays owner-only", async () => {
    const user = await makeUser("saved-workouts@example.com");
    const other = await makeUser("other-saved@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1) ?? program.days[0]!;
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const names = exerciseNamesInOrder(session.sets);
    expect(names.length).toBeGreaterThan(2);
    const first = names[0]!;
    const second = names[1]!;
    const goblet = libraryExercise("Goblet squat");
    expect(goblet).toBeTruthy();
    const drafts = draftsForLibraryExercise(names, goblet!);
    const gobletName = drafts[0]!.exerciseName;
    const inserted = insertSetsAtExercise(
      session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: null as number | null,
        loadValue: null as number | null,
        loadUnit: "lb" as const,
        logMode: set.logMode,
        durationSeconds: set.durationSeconds,
        completed: false,
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
      1,
      drafts.map((draft) => ({
        exerciseName: draft.exerciseName,
        setNumber: draft.setNumber,
        reps: 6,
        loadValue: 40,
        loadUnit: "lb" as const,
        logMode: draft.logMode,
        durationSeconds: null,
        completed: true,
        prescriptionKey: addedPrescriptionKey({
          exerciseName: draft.exerciseName,
          reps: draft.prescriptionReps,
          restSeconds: draft.restSeconds,
        }),
        rir: "1-2 RIR",
      })),
    );
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      sets: inserted.map((set) => {
        const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
        const timed = isDurationMode(mode);
        const marker =
          set.exerciseName === gobletName
            ? { reps: 6, loadValue: 40, durationSeconds: null as number | null }
            : set.exerciseName === first && set.setNumber === 1
              ? timed
                ? { reps: null, loadValue: null, durationSeconds: 30 }
                : { reps: 5, loadValue: 100, durationSeconds: null }
              : set.exerciseName === second && set.setNumber === 1
                ? timed
                  ? { reps: null, loadValue: null, durationSeconds: 20 }
                  : { reps: 5, loadValue: 50, durationSeconds: null }
                : { reps: null, loadValue: null, durationSeconds: null };
        const logged = marker.reps != null || marker.loadValue != null || (marker.durationSeconds ?? 0) > 0;
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: marker.reps,
          loadValue: marker.loadValue,
          loadUnit: "lb" as const,
          logMode: isLogMode(set.logMode) ? set.logMode : undefined,
          durationSeconds: marker.durationSeconds,
          completed: logged,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        };
      }),
    });

    const saved = await saveWorkoutFromSession({
      userId: user.id,
      workoutId: session.id,
      timeZone: APP_TIMEZONE,
    });
    expect(saved.exercises.map((row) => row.name).slice(0, 3)).toEqual([first, gobletName, second]);
    const stored = saved.exercises.find((row) => row.name === gobletName);
    expect(stored).toMatchObject({
      sets: drafts.length,
      reps: "6",
      restSeconds: drafts[0]!.restSeconds,
      rir: "1-2 RIR",
      loadText: "40 lb",
    });
    expect(saved.name).toContain("2026");

    await expect(getSavedWorkoutForUser(saved.id, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteSavedWorkoutForUser(other.id, saved.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      applySavedWorkoutToDay({
        userId: other.id,
        savedWorkoutId: saved.id,
        dayKey: "2026-10-20",
        mode: "replace",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      startSavedWorkoutForUser({
        userId: other.id,
        savedWorkoutId: saved.id,
        preferredUnits: "lb",
        timeZone: APP_TIMEZONE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("applies to one day without changing the block, then counts a log and can revert", async () => {
    const user = await makeUser("apply-day@example.com");
    const program = await getDemoProgram();
    const day = program.days[0]!;
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      sets: session.sets.slice(0, 2).map((set, index) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: 8,
        loadValue: index === 0 ? 25 : null,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : "load_reps",
        durationSeconds: null,
        completed: true,
        prescriptionKey: set.prescriptionKey,
        rir: "2 RIR",
      })),
    });
    const saved = await saveWorkoutFromSession({
      userId: user.id,
      workoutId: session.id,
      name: "Camp arms",
      timeZone: APP_TIMEZONE,
    });

    const now = new Date();
    const today = formatDayParam(now, APP_TIMEZONE);
    const todayDate = parseDayParam(today, now, APP_TIMEZONE);
    const neighborDate = addZonedDays(todayDate, 1, APP_TIMEZONE);
    const neighbor = formatDayParam(neighborDate, APP_TIMEZONE);
    const prefs = {
      planAnchor: new Date("2026-09-07T18:00:00Z"),
      weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      primaryFocus: "mma",
    };
    const targetBefore = planForDate(prefs, todayDate, APP_TIMEZONE);
    const neighborBefore = planForDate(prefs, neighborDate, APP_TIMEZONE);
    const indexBefore = weekIndexFor(prefs, neighborDate, APP_TIMEZONE);
    const calendarBefore = await getCalendarSchedule(user.id, now);
    const titles = (key: string, schedule = calendarBefore) => {
      const row = schedule.days.find((item) => formatDayParam(item.date, APP_TIMEZONE) === key);
      return (row?.activities ?? []).filter((item) => item.kind === "workout").map((item) => item.title);
    };
    const todayProgram = titles(today);
    const neighborProgram = titles(neighbor);

    await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: today,
      mode: "replace",
    });

    expect(planForDate(prefs, todayDate, APP_TIMEZONE)).toEqual(targetBefore);
    expect(planForDate(prefs, neighborDate, APP_TIMEZONE)).toEqual(neighborBefore);
    expect(weekIndexFor(prefs, neighborDate, APP_TIMEZONE)).toBe(indexBefore);
    expect(applyPlansToProgramCards(targetBefore.sessions, [{ mode: "replace" }]).cards).toEqual([]);

    const replaced = await getCalendarSchedule(user.id, now);
    const todayAfter = titles(today, replaced);
    expect(todayAfter).toContain("Camp arms");
    for (const title of todayProgram) expect(todayAfter).not.toContain(title);
    expect(titles(neighbor, replaced)).toEqual(neighborProgram);
    const replacedDay = replaced.days.find((item) => formatDayParam(item.date, APP_TIMEZONE) === today);
    expect(replacedDay?.summary).toContain("Camp arms");
    expect(replacedDay?.revertKey).toBe(today);

    await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: neighbor,
      mode: "extra",
    });
    const withExtra = await getCalendarSchedule(user.id, now);
    expect(titles(neighbor, withExtra)).toEqual([...neighborProgram, "Camp arms"]);
    expect(titles(today, withExtra)).toEqual(todayAfter);

    const plans = await prisma.dayWorkoutPlan.findMany({
      where: { userId: user.id, dayKey: today, mode: "replace" },
    });
    expect(plans).toHaveLength(1);
    const started = await startDayPlanForUser({
      userId: user.id,
      planId: plans[0]!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(started.programDayId).toBeNull();
    expect(started.dayPlanId).toBe(plans[0]!.id);
    expect(started.plannedSetCount).toBe(started.sets.length);
    expect(started.plannedSetCount).toBeGreaterThan(0);
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: "",
      status: "complete",
      sets: started.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "timed" || set.logMode === "timed_round" ? null : 6,
        loadValue:
          set.logMode === "reps_only" || set.logMode === "timed" || set.logMode === "timed_round"
            ? null
            : 40,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : "load_reps",
        durationSeconds:
          set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed"
            ? 60
            : null,
        completed: true,
        prescriptionKey: set.prescriptionKey,
        rir: "",
      })),
    });
    const logged = await getCalendarSchedule(user.id, now);
    const done = logged.days
      .find((item) => formatDayParam(item.date, APP_TIMEZONE) === today)
      ?.activities.find((item) => item.title === "Camp arms");
    expect(done?.status).toBe("complete");

    await revertDayToProgram(user.id, today);
    const restored = await getCalendarSchedule(user.id, now);
    // Every Camp arms set was ticked, so the log stays beside the program.
    expect(titles(today, restored)).toEqual([...todayProgram, "Camp arms"]);
    const kept = restored.days
      .find((item) => formatDayParam(item.date, APP_TIMEZONE) === today)
      ?.activities.find((item) => item.title === "Camp arms");
    expect(kept?.status).toBe("complete");
    expect(kept?.subtitle).toBe("Camp arms · Done");
    expect(planForDate(prefs, neighborDate, APP_TIMEZONE).mesoBlock).toBe(neighborBefore.mesoBlock);

    const fresh = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(fresh.programDayId).toBeNull();
    expect(fresh.dayPlanId).toBeNull();
    expect(fresh.savedWorkoutId).toBe(saved.id);
    expect(fresh.sets.length).toBeGreaterThan(0);
    expect(fresh.plannedSetCount).toBe(fresh.sets.length);
  });

  it("drops an untouched custom draft when the day reverts to the program", async () => {
    const user = await makeUser("revert-empty-draft@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "Camp arms",
      exercises: [
        {
          name: "Push-up",
          sets: 3,
          reps: "8",
          loadText: "",
          restSeconds: 60,
          rir: "",
          logMode: "reps_only",
          notes: "",
        },
      ],
    });
    const now = new Date(2026, 9, 22, 15, 0, 0);
    const today = formatDayParam(now, APP_TIMEZONE);
    const before = await getCalendarSchedule(user.id, now);
    const titles = (schedule: typeof before) => {
      const row = schedule.days.find((item) => formatDayParam(item.date, APP_TIMEZONE) === today);
      return (row?.activities ?? []).filter((item) => item.kind === "workout").map((item) => item.title);
    };
    const todayProgram = titles(before);
    expect(todayProgram).toEqual(["Lift 3 — Light full body"]);

    await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: today,
      mode: "replace",
    });
    const plans = await prisma.dayWorkoutPlan.findMany({
      where: { userId: user.id, dayKey: today, mode: "replace" },
    });
    const started = await startDayPlanForUser({
      userId: user.id,
      planId: plans[0]!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(started.sets.length).toBeGreaterThan(0);
    expect(
      started.sets.every(
        (set) => set.reps == null && set.loadValue == null && set.durationSeconds == null && !set.completed,
      ),
    ).toBe(true);

    await revertDayToProgram(user.id, today);
    const restored = await getCalendarSchedule(user.id, now);
    expect(titles(restored)).toEqual(todayProgram);
    expect(titles(restored)).not.toContain("Camp arms");
    expect(
      await prisma.workoutSession.count({ where: { userId: user.id, id: started.id } }),
    ).toBe(0);
    expect(await prisma.dayWorkoutPlan.count({ where: { userId: user.id, dayKey: today } })).toBe(0);
  });
});
