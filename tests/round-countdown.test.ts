import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyStepperTap, TimerDurationSteppers } from "@/components/timer/TimerDurationSteppers";
import { RoundTimer } from "@/components/timer/RoundTimer";
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { getCalendarSchedule } from "@/lib/calendar";
import { bikeChoiceById, bikeHistoryFromSessions, bikeTimerRoundCount } from "@/lib/bike-chooser";
import { completedBikeLogRounds, viewAtElapsed } from "@/lib/bike-interval-timer";
import { bikeTimerLogSets, bikeTimerSessionSeconds } from "@/lib/bike-timer-log";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import {
  countdownCue,
  countdownDigitAt,
  countdownSound,
} from "@/lib/round-countdown";
import { DURATION_STEP_SECONDS, formatDurationPick, stepDurationSeconds } from "@/lib/round-timer";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";
import { logBikeRoundsForUser, rateWorkoutSessionForUser, startWorkoutFromDay } from "@/lib/workouts";
import { planForDate, resolvePlanSessions } from "@/lib/week-plan";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { makeUser, resetDatabase } from "./helpers";

const wednesday = zonedCivilToUtc(2026, 10, 21, APP_TIMEZONE);

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("round countdown and seconds steppers", () => {
  it("counts 3-2-1 and keeps the beep and GO bell on the Bell and Vibrate toggles", () => {
    expect(countdownDigitAt(0)).toBe(3);
    expect(countdownDigitAt(999)).toBe(3);
    expect(countdownDigitAt(1000)).toBe(2);
    expect(countdownDigitAt(2000)).toBe(1);
    expect(countdownDigitAt(3000)).toBeNull();
    expect(countdownCue(null, 3)).toBe("beep");
    expect(countdownCue(3, 2)).toBe("beep");
    expect(countdownCue(1, null)).toBe("go");
    expect(countdownCue(1, 1)).toBeNull();
    expect(countdownSound("beep", { bell: false, vibrate: true })).toEqual({
      beep: false,
      bell: false,
      vibrate: false,
    });
    expect(countdownSound("go", { bell: true, vibrate: false })).toEqual({
      beep: false,
      bell: true,
      vibrate: false,
    });
    expect(countdownSound("go", { bell: false, vibrate: true }).vibrate).toBe(true);

    expect(DURATION_STEP_SECONDS).toBe(15);
    expect(stepDurationSeconds(180, -1)).toBe(165);
    expect(stepDurationSeconds(15, -1)).toBe(15);
    expect(stepDurationSeconds(10, 1)).toBe(15);
    expect(formatDurationPick(180)).toBe("3:00");
    expect(formatDurationPick(165)).toBe("2:45");

    const timer = read("src/components/timer/RoundTimer.tsx");
    const bike = read("src/components/training/BikeSetTimer.tsx");
    const face = read("src/components/timer/CountdownFace.tsx");
    expect(timer).toContain("useGoCountdown");
    expect(timer).toContain("cancelCountdown()");
    expect(timer).toContain("data-timer-reset");
    expect(timer).toContain("Assault Bike");
    expect(timer).toContain("LOG ${Math.min(bikeFinished, bikeRounds)} BIKE ROUNDS");
    expect(timer).toContain("Finish a round before logging.");
    expect(timer).toContain('data-bike-round-log="waiting"');
    expect(timer).toContain("overflow-x-auto");
    expect(timer).toContain("whitespace-nowrap");
    expect(bike).toContain("useGoCountdown");
    expect(bike).toContain("countdown.cancel()");
    expect(face).toContain("stat-display");
    expect(face).toContain("text-[#CBF805]");
    expect(face).toContain("data-countdown");
    expect(read("src/app/actions/workouts.ts")).toContain("/done?celebrate=workout");
    expect(read("src/components/training/WorkoutWinScreen.tsx")).toContain("data-workout-win");
    expect(read("src/lib/difficulty.ts")).toContain("Too easy");
    expect(read("src/components/training/SessionFeelPicker.tsx")).toContain("DIFFICULTY_RATINGS");
  });

  it("replaces pounds and a one-second clock with bike intervals and work time", () => {
    const choice = bikeChoiceById("tabata")!;
    const tiles = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 1,
      session: {
        title: choice.name,
        status: "complete",
        performedAt: wednesday,
        elapsedSeconds: 1,
        sets: bikeTimerLogSets(choice, "lb"),
      },
    });
    expect(tiles.find((tile) => tile.key === "time")?.value).toBe("4:00");
    expect(tiles.map((tile) => tile.label)).toEqual(["Time", "Intervals", "Work", "New PRs"]);
    expect(tiles.find((tile) => tile.key === "setsRounds")?.value).toBe("8");
    expect(tiles.find((tile) => tile.key === "volume")?.value).toBe("2:40");
    expect(tiles.find((tile) => tile.key === "prs")?.value).toBe("0");
    const partial = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 1,
      session: {
        title: choice.name,
        status: "complete",
        performedAt: wednesday,
        elapsedSeconds: 1,
        sets: bikeTimerLogSets(choice, "lb", 3),
      },
    });
    expect(partial.find((tile) => tile.key === "time")?.value).toBe("1:30");
    expect(partial.find((tile) => tile.key === "setsRounds")?.value).toBe("3");
    expect(partial.find((tile) => tile.key === "volume")?.value).toBe("1:00");
  });

  it("shows work and rest as m:ss, not whole minutes", () => {
    const html = renderToStaticMarkup(
      createElement(TimerDurationSteppers, {
        rounds: 3,
        workSeconds: 180,
        restSeconds: 60,
        onChange: () => {},
      }),
    );
    expect(html).toContain("3:00");
    expect(html).toContain("1:00");
    expect(html).toContain('data-timer-settings');
    expect(html).not.toContain("WORK MIN");
    expect(html).not.toContain("REST MIN");
  });

  it("applies one step when the pointer stays inside, and a drag-off does not step", () => {
    let steps = 0;
    const state = { fromPointer: false, inside: false, suppressClick: false };
    const apply = () => {
      steps += 1;
    };
    const mouseClick = { button: 0, detail: 1 };
    const enter = { button: 0, detail: 0 };
    applyStepperTap("pointerdown", state, apply, { button: 0 });
    applyStepperTap("pointerup", state, apply, { button: 0 });
    applyStepperTap("click", state, apply, mouseClick);
    expect(steps).toBe(1);
    expect(state.fromPointer).toBe(false);
    applyStepperTap("click", state, apply, enter);
    expect(steps).toBe(2);
    applyStepperTap("pointerdown", state, apply, { button: 0 });
    state.inside = false;
    applyStepperTap("pointerup", state, apply, { button: 0 });
    expect(steps).toBe(2);
    expect(state.suppressClick).toBe(true);
    applyStepperTap("click", state, apply, mouseClick);
    expect(steps).toBe(2);
    applyStepperTap("click", state, apply, enter);
    expect(steps).toBe(3);
    // Press started elsewhere, or a right/middle click: no step, and Enter still works.
    applyStepperTap("pointerup", state, apply, { button: 0 });
    expect(steps).toBe(3);
    expect(state.suppressClick).toBe(false);
    applyStepperTap("click", state, apply, mouseClick);
    expect(steps).toBe(3);
    applyStepperTap("pointerdown", state, apply, { button: 2 });
    applyStepperTap("pointerup", state, apply, { button: 2 });
    applyStepperTap("click", state, apply, { button: 2, detail: 1 });
    expect(steps).toBe(3);
    applyStepperTap("click", state, apply, enter);
    expect(steps).toBe(4);
  });

  it("does not paint a bag log before the stored timer mode hydrates", () => {
    const fresh = renderToStaticMarkup(createElement(RoundTimer, {}));
    expect(fresh).not.toContain("bag rounds");
    expect(fresh).toContain("Log rounds");
    expect(fresh).not.toContain('data-timer-mode="bag" aria-pressed="true"');
    expect(fresh).not.toMatch(/aria-pressed="true"[^>]*data-timer-mode="bag"/);
    const pads = renderToStaticMarkup(createElement(RoundTimer, { mode: "pads" }));
    expect(pads).toContain("pads rounds");
    expect(pads).toContain('data-timer-mode="pads"');
    expect(pads).toMatch(/data-timer-mode="pads"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-timer-mode="pads"/);
  });

  it("does not count a bike round until that interval has finished", () => {
    const tabata = bikeChoiceById("tabata")!.spec;
    expect(completedBikeLogRounds(viewAtElapsed(tabata, 0))).toBe(0);
    expect(completedBikeLogRounds(viewAtElapsed(tabata, 19))).toBe(0);
    expect(completedBikeLogRounds(viewAtElapsed(tabata, 20))).toBe(1);
    const fight = bikeChoiceById("fight-rounds")!.spec;
    expect(completedBikeLogRounds(viewAtElapsed(fight, 0))).toBe(0);
    expect(completedBikeLogRounds(viewAtElapsed(fight, 134))).toBe(0);
    expect(completedBikeLogRounds(viewAtElapsed(fight, 135))).toBe(1);
  });

  it("counts Tabata as 8 rounds, 10s sprints as 10, and the fight sim as 5", () => {
    expect(bikeTimerRoundCount(bikeChoiceById("tabata")!)).toBe(8);
    expect(bikeTimerRoundCount(bikeChoiceById("alactic-10")!)).toBe(10);
    expect(bikeTimerRoundCount(bikeChoiceById("fight-rounds")!)).toBe(5);
    const sets = bikeTimerLogSets(bikeChoiceById("tabata")!, "lb");
    expect(sets).toHaveLength(8);
    expect(sets.every((set) => set.completed && set.durationSeconds > 0)).toBe(true);
    expect(bikeTimerLogSets(bikeChoiceById("tabata")!, "lb", 0)).toHaveLength(0);
    expect(bikeTimerLogSets(bikeChoiceById("tabata")!, "lb", 3)).toHaveLength(3);
  });
});

describe("a saved bike session completes the day", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("leaves a draft open and marks Calendar, Home, and the rating after a real save", async () => {
    const user = await makeUser("bike-done@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Ricky",
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
      trainingFocus: "martial_arts_sc",
      outsideTraining: [],
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
        timeZone: APP_TIMEZONE,
      },
    });
    const catalog = await findDemoTrainingCatalog();
    const plan = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        trainingFocus: "martial_arts_sc",
        planAnchor: new Date("2026-01-05T12:00:00.000Z"),
        email: user.email,
      },
      wednesday,
      APP_TIMEZONE,
    );
    const bike = resolvePlanSessions(plan, catalog).find((session) => session.logHref);
    expect(bike?.dayId).toBeTruthy();

    await startWorkoutFromDay({
      userId: user.id,
      programDayId: bike!.dayId!,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      planAnchor: new Date("2026-01-05T12:00:00.000Z"),
    });
    await prisma.workoutSession.updateMany({
      where: { userId: user.id },
      data: { performedAt: wednesday },
    });
    const draftSchedule = await getCalendarSchedule(user.id, wednesday, wednesday);
    const draftCard = draftSchedule.days
      .flatMap((day) => day.activities)
      .find((activity) => activity.programDayId === bike!.dayId);
    expect(draftCard?.status).toBe("scheduled");
    const draftHome = await getHomeToday(user.id, wednesday, APP_TIMEZONE);
    expect(draftHome.completedDayIds).not.toContain(bike!.dayId);

    const saved = await logBikeRoundsForUser({
      userId: user.id,
      choice: bikeChoiceById("tabata")!,
      now: wednesday,
      roundsCompleted: 8,
    });
    expect(saved.status).toBe("complete");
    expect(saved.programDayId).toBe(bike!.dayId);
    expect(saved.elapsedSeconds).toBe(bikeTimerSessionSeconds(bikeChoiceById("tabata")!));
    const tiles = workoutCompleteTiles({
      session: saved,
      displayUnit: "lb",
      newPrCount: 1,
    });
    expect(tiles.find((tile) => tile.key === "time")?.value).toBe("4:00");
    expect(tiles.find((tile) => tile.key === "setsRounds")).toEqual({
      key: "setsRounds",
      label: "Intervals",
      value: "8",
    });
    expect(tiles.find((tile) => tile.key === "volume")).toEqual({
      key: "volume",
      label: "Work",
      value: "2:40",
    });
    expect(tiles.find((tile) => tile.key === "prs")?.value).toBe("0");
    expect(tiles.some((tile) => /lbs/i.test(tile.label))).toBe(false);
    const doneSchedule = await getCalendarSchedule(user.id, wednesday, wednesday);
    const doneCard = doneSchedule.days
      .flatMap((day) => day.activities)
      .find((activity) => activity.programDayId === bike!.dayId);
    expect(doneCard?.status).toBe("complete");
    const doneHome = await getHomeToday(user.id, wednesday, APP_TIMEZONE);
    expect(doneHome.completedDayIds).toContain(bike!.dayId);
    const history = bikeHistoryFromSessions([
      {
        id: saved.id,
        title: saved.title,
        performedAt: saved.performedAt,
        sets: saved.sets.map((set) => ({
          exerciseName: set.exerciseName,
          completed: set.completed,
          prescriptionKey: set.prescriptionKey,
          reps: set.reps,
          loadValue: set.loadValue,
          durationSeconds: set.durationSeconds,
        })),
      },
    ]);
    expect(history[0]?.workoutName).toMatch(/Tabata/i);

    const rated = await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId: saved.id,
      difficultyRating: "too_easy",
    });
    expect(rated.difficultyRating).toBe("too_easy");
  });

  it("does not save a bike session before a round finishes", async () => {
    const user = await makeUser("bike-early@example.com");
    await expect(
      logBikeRoundsForUser({
        userId: user.id,
        choice: bikeChoiceById("tabata")!,
        now: wednesday,
        roundsCompleted: 0,
      }),
    ).rejects.toThrow(/Finish a round/);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(0);
  });
});
