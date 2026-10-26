import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LogPastWorkoutButton, bikeBackfillTapCount } from "@/components/training/LogPastWorkoutSheet";
import { SessionRecap } from "@/components/training/SessionRecap";
import { getCalendarSchedule } from "@/lib/calendar";
import { createBackfillWorkout, previewBackfillDay } from "@/lib/backfill-workout";
import { performedAtForDayKey } from "@/lib/backfill-rules";
import { attachBikeChoice, bikeHistoryLine, choiceToken, customBikeChoice } from "@/lib/bike-chooser";
import { isLogMode, loggerCardLine } from "@/lib/exercise-log-mode";
import { bestSwapReplacements, trainingBlockKey } from "@/lib/exercise-swap";
import { applyExerciseSwap, undoExerciseSwap } from "@/lib/exercise-swap-store";
import { formatDayParam } from "@/lib/home";
import { prisma } from "@/lib/prisma";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import { historyDetailBesideCount, roundHistoryLine } from "@/lib/round-session";
import { sessionProgress } from "@/lib/session-progress";
import { scaleProgramDay } from "@/lib/training-scale";
import { APP_TIMEZONE } from "@/lib/timezone";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import { startWorkoutFromDay } from "@/lib/workouts";
import { makeUser, resetDatabase } from "./helpers";

const NOW = new Date("2026-10-22T18:00:00.000Z");
const TZ = "America/Denver";
const DAY = "2026-10-21";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function onboard(userId: string) {
  await prisma.profile.update({
    where: { userId },
    data: {
      timeZone: TZ,
      primaryFocus: "mma",
      experienceLevel: "intermediate",
      sessionsPerWeek: 3,
      weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
      onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
    },
  });
}

function isAssault2x8(target: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
} | undefined) {
  return Boolean(
    target &&
      target.sets === 2 &&
      target.rounds === 8 &&
      target.workSeconds === 15 &&
      target.restSeconds === 15 &&
      target.setRestSeconds === 60,
  );
}

describe("best replacements and the finish Edit button", () => {
  it("ranks same-pattern gym replacements ahead of a search", () => {
    const picks = bestSwapReplacements({ name: "Dumbbell bench press", equipment: "gym" });
    expect(picks.map((row) => row.name)).toEqual([
      "Clap push-up",
      "Close-grip bench press",
      "Deficit push-up",
    ]);
    expect(picks.every((row) => row.category === "upper_push" && row.equipment !== "none")).toBe(true);
    expect(picks.some((row) => row.name === "Goblet squat")).toBe(false);

    const bodyweight = bestSwapReplacements({ name: "Dumbbell bench press", equipment: "none" });
    expect(bodyweight).toHaveLength(3);
    expect(bodyweight.every((row) => row.equipment !== "gym" && row.category === "upper_push")).toBe(true);
    expect(bodyweight.some((row) => row.name === "Barbell bench press" || row.name === "Dumbbell bench press")).toBe(
      false,
    );

    const boosted = bestSwapReplacements({
      name: "Dumbbell bench press",
      equipment: "gym",
      loggedNames: ["Deficit push-up"],
    });
    expect(boosted[0]?.name).toBe("Deficit push-up");
  });

  it("puts Edit on the recap in one control", () => {
    const html = renderToStaticMarkup(
      createElement(
        SessionRecap,
        {
          summary: {
            kind: "bike",
            goal: "Repeat power",
            targets: ["aerobic conditioning"],
            payoff: "You finished the ride.",
            whenLabel: "Wed, Oct 21",
          },
        },
        createElement("button", { type: "button", "data-win-edit": "1" }, "Edit"),
      ),
    );
    expect(html).toContain("data-session-summary");
    expect(html).toContain('data-win-edit="1"');
    expect(html.indexOf("data-win-edit")).toBeGreaterThan(html.indexOf("You finished the ride."));

    const win = read("src/components/training/WorkoutWinScreen.tsx");
    expect(win).toContain("data-win-edit");
    expect(win).toContain("data-recap-edit");
    expect(win).toContain('entry="edit"');
    expect(win).toContain("resumeWorkoutAction");
    expect(read("src/app/(member)/training/log/[sessionId]/done/page.tsx")).toContain("backfillFormSeed");
    const menu = read("src/components/training/ExerciseCardMenu.tsx");
    expect(menu).toContain("suggestions={suggestions}");
    expect(menu).toContain("onQuickPick");
    expect(menu).toContain('setScope("session")');
    const sheet = read("src/components/training/ExerciseLibrarySheet.tsx");
    expect(sheet).toContain("data-best-replacements");
    expect(sheet).toContain('data-swap-scope="session"');
    expect(sheet.indexOf("data-best-replacements")).toBeLessThan(sheet.indexOf("Search exercises"));
  });
});

describe("assault bike backfill of 2×8 @ 15/15", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves the structure and time and shows them on Calendar, History, and the finish tiles", async () => {
    const choice = customBikeChoice({
      workSeconds: 15,
      restSeconds: 15,
      rounds: 8,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
    });
    expect(choiceToken(choice!)).toBe("c.15.15.8.0.0.2.60");
    const user = await makeUser("ease-bike@example.com");
    await onboard(user.id);
    const preview = await previewBackfillDay(user.id, DAY, NOW);
    const bikeTarget = preview.roundTargets.bike;
    const plannedBike = Boolean(bikeTarget);
    const hasPlan = plannedBike || preview.programs.length > 0;
    const planIsAssault2x8 = plannedBike ? isAssault2x8(bikeTarget) : !hasPlan;
    const mustPickBike = hasPlan && !plannedBike;
    const calendarTaps = bikeBackfillTapCount({
      planIsAssault2x8,
      mustPickBike,
      bikeTargetNeedsPreset: mustPickBike && plannedBike && !isAssault2x8(bikeTarget),
    });
    const historyTaps = bikeBackfillTapCount({
      planIsAssault2x8,
      mustPickBike,
      bikeTargetNeedsPreset: mustPickBike && plannedBike && !isAssault2x8(bikeTarget),
      historyDaySteps: 0,
    });
    // Wednesday's programmed ride is 1×3 @ 10/50, so 2×8 is the preset, not the prefill.
    expect(preview.programs.map((program) => program.title)).toEqual(["Cardio — bike"]);
    expect(bikeTarget).toMatchObject({
      sets: 1,
      rounds: 3,
      workSeconds: 10,
      restSeconds: 50,
      setRestSeconds: 60,
    });
    expect(planIsAssault2x8).toBe(false);
    expect(mustPickBike).toBe(false);
    expect(calendarTaps).toBe(3);
    expect(historyTaps).toBe(3);
    expect(bikeBackfillTapCount({ planIsAssault2x8: false, mustPickBike: false, historyDaySteps: 1 })).toBe(4);
    expect(bikeBackfillTapCount({ planIsAssault2x8: true, mustPickBike: false })).toBe(2);
    expect(bikeBackfillTapCount({ planIsAssault2x8: false, mustPickBike: false })).toBe(3);
    expect(bikeBackfillTapCount({ planIsAssault2x8: false, mustPickBike: true })).toBe(3);
    expect(
      bikeBackfillTapCount({
        planIsAssault2x8: false,
        mustPickBike: true,
        bikeTargetNeedsPreset: true,
        historyDaySteps: 1,
      }),
    ).toBe(5);

    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: DAY,
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
      doneRounds: 16,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const row = await prisma.workoutSession.findUnique({
      where: { id: saved.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(row?.sets).toHaveLength(16);
    expect(row?.sets.every((set) => set.durationSeconds === 15 && set.logMode === "timed_round" && set.completed)).toBe(
      true,
    );
    expect(row?.sets[0]?.prescriptionKey).toBe(attachBikeChoice("timer", "c.15.15.8.0.0.2.60"));
    expect(row?.title).toContain("2 × 8");
    expect(row?.title).toContain("15/15");
    expect(row?.backfilled).toBe(true);
    const elapsed = (await readWorkoutTimerFields(saved.sessionId, prisma)).elapsedSeconds;
    expect(elapsed).toBe(540);

    const monday = performedAtForDayKey("2026-10-19", TZ);
    const schedule = await getCalendarSchedule(user.id, NOW, monday);
    const day = schedule.days.find((item) => formatDayParam(item.date, TZ) === DAY);
    expect(day).toBeTruthy();
    const card = day!.activities
      .map((activity) =>
        [activity.title, activity.subtitle, activity.setCountLabel, activity.durationLabel].filter(Boolean).join(" | "),
      )
      .join("\n");
    expect(card).toContain("15/15");
    expect(card).toContain("2 × 8");
    expect(card).toContain("9:00");
    expect(card).toContain("16/16 rounds · Done");

    const session = { ...row!, elapsedSeconds: elapsed };
    const bikeLine = bikeHistoryLine(session);
    expect(bikeLine).toContain("2 × 8");
    expect(bikeLine).toContain("15/15");
    const roundLine = roundHistoryLine(session);
    expect(roundLine).toContain("9:00");
    expect(historyDetailBesideCount(roundLine)).toContain("9:00");
    expect(historyDetailBesideCount(roundLine)).not.toMatch(/^\d+ rounds/);
    expect(sessionProgress(session).text).toBe("16/16 rounds · Done");

    const tiles = workoutCompleteTiles({ session, displayUnit: "lb", newPrCount: 0 });
    expect(tiles.find((tile) => tile.key === "time")?.value).toBe("9:00");
    expect(tiles.find((tile) => tile.key === "setsRounds")?.value).toBe("2×8");
    const logger = loggerCardLine({
      sets: 16,
      reps: choice!.plain,
      name: row!.sets[0]?.exerciseName,
      logMode: "timed_round",
    });
    expect(logger).toContain("2 × 8");
    expect(logger).toContain("15/15");
    expect(logger.startsWith("16 rounds")).toBe(false);

    const sheet = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: DAY,
        entry: "calendar",
        label: "Log a completed workout",
        timeZone: TZ,
        defaultOpen: true,
      }),
    );
    expect(sheet).toContain("2×8 @ 15/15");
    expect(sheet).toContain('data-interval-preset="assault-2x8"');
    expect(sheet).toContain('aria-pressed="true"');
    expect(sheet).toContain("2x8 @ 15/15");
  });

  it("undoes a session swap and restores the sets", async () => {
    const user = await makeUser("ease-swap@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((item) => item.dayNumber === 1);
    expect(day).toBeTruthy();
    const scaled = scaleProgramDay(day!, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    const bench = scaled.exercises.find((exercise) => exercise.name === "Dumbbell bench press");
    expect(bench).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const currentSets = session.sets.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: set.reps,
      loadValue: set.loadValue,
      loadUnit: "lb" as const,
      logMode: isLogMode(set.logMode) ? set.logMode : undefined,
      durationSeconds: set.durationSeconds,
      completed: set.completed,
      notes: set.notes,
      prescriptionKey: set.prescriptionKey,
      rir: set.rir,
    }));
    const blockKey = trainingBlockKey(new Date(), APP_TIMEZONE);
    const swapped = await applyExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day!.dayNumber,
      originalName: "Dumbbell bench press",
      currentName: "Dumbbell bench press",
      replacementName: "Barbell bench press",
      scope: "session",
      workoutSessionId: session.id,
      blockKey,
      source: {
        sets: bench!.sets,
        reps: bench!.reps,
        loadText: bench!.loadText,
        restSeconds: bench!.restSeconds,
        logMode: bench!.logMode,
        notes: bench!.notes,
      },
      currentSets,
    });
    expect(swapped.sets?.some((set) => set.exerciseName === "Barbell bench press")).toBe(true);
    const undone = await undoExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day!.dayNumber,
      originalName: "Dumbbell bench press",
      restoredName: "Dumbbell bench press",
      undoneName: "Barbell bench press",
      scope: "session",
      workoutSessionId: session.id,
      blockKey,
      currentSets,
      setDelta: swapped.prescription.sets - bench!.sets,
    });
    expect(undone.reverted).toBe(true);
    expect(undone.sets?.some((set) => set.exerciseName === "Dumbbell bench press")).toBe(true);
    expect(undone.sets?.some((set) => set.exerciseName === "Barbell bench press")).toBe(false);
    const row = await prisma.exerciseSwap.findFirst({
      where: { userId: user.id, workoutSessionId: session.id, originalName: "Dumbbell bench press" },
    });
    expect(row).toBeNull();
  });
});
