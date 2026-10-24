import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  clearBackfillWriteFault,
  createBackfillWorkout,
  decodeInterval,
  deleteBackfillWorkout,
  faultNextBackfillWrite,
  getBackfillForEdit,
  previewBackfillDay,
  backfillFormSeed,
  updateBackfillWorkout,
  type BackfillFormSeed,
  type BackfillPreview,
} from "@/lib/backfill-workout";
import { completionListLabel, exerciseSetProgress, historyCountLine, sessionOpensFinishScreen } from "@/lib/logged-work";
import { roundHistoryLine } from "@/lib/round-session";
import { getCalendarSchedule, subtitleShowsPartial } from "@/lib/calendar";
import { completedLocalDayKeys, listWorkoutSessionsForUser, logBikeRoundsForUser, reopenCompletedWorkoutForUser } from "@/lib/workouts";
import { bikeChoiceById, customBikeChoice } from "@/lib/bike-chooser";
import { backfillDayOptions, performedAtForDayKey, setsForBackfillExercises } from "@/lib/backfill-rules";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import { formatDayParam, getWeeklyActivity } from "@/lib/home";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { sessionCompletionDay } from "@/lib/performed-at";
import { addZonedDays, dayKey, startOfZonedDay } from "@/lib/timezone";
import { chipAfterDayPreview, keepIntervalDraftOnDayChange, LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { workoutCompleteTiles } from "@/lib/workout-complete";

const NOW = new Date("2026-10-22T18:00:00.000Z");
const TZ = "America/Denver";

async function onboard(userId: string, timeZone = TZ) {
  await prisma.profile.update({
    where: { userId },
    data: {
      timeZone,
      primaryFocus: "mma",
      experienceLevel: "intermediate",
      sessionsPerWeek: 3,
      weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
      onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
    },
  });
}

function freeLog(userId: string, day: string, title: string, now = NOW, resolution: "" | "extra" | "replace" = "") {
  return createBackfillWorkout({
    userId,
    dayKey: day,
    kind: "free",
    resolution,
    now,
    title,
    notes: "logged later",
    rpe: 7,
    durationSeconds: 30 * 60,
  });
}

describe("log a past workout", () => {
  beforeEach(async () => {
    clearBackfillWriteFault();
    await resetDatabase();
  });

  it("marks the calendar, history, weekly stats, and streak", async () => {
    const user = await makeUser("backfill-mark@example.com");
    await onboard(user.id);
    const preview = await previewBackfillDay(user.id, "2026-10-21", NOW);
    expect(preview.programs.length).toBeGreaterThan(0);
    const program = preview.programs[0]!;
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-21",
      kind: "program",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: 8,
      programDayId: program.programDayId,
      exercises: program.exercises.map((row) => ({ ...row, done: row.sets })),
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.status).toBe("complete");

    const tuesday = await freeLog(user.id, "2026-10-20", "Easy spin");
    expect(tuesday.ok).toBe(true);

    const history = await listWorkoutSessionsForUser(user.id);
    expect(history.every((row) => row.backfilled && row.source === "backfill")).toBe(true);
    expect(history.map((row) => row.title)).toEqual(expect.arrayContaining(["Easy spin"]));

    const schedule = await getCalendarSchedule(user.id, NOW, NOW);
    const wednesday = schedule.days.find((day) => formatDayParam(day.date, TZ) === "2026-10-21");
    const tuesdayRow = schedule.days.find((day) => formatDayParam(day.date, TZ) === "2026-10-20");
    expect(
      wednesday?.activities.some(
        (item) =>
          item.kind === "workout" &&
          (item.status === "complete" || subtitleShowsPartial(item.subtitle ?? "")),
      ),
    ).toBe(true);
    expect(
      tuesdayRow?.activities.some((item) => item.title === "Easy spin" && item.status === "complete"),
    ).toBe(true);

    const chips = await completedLocalDayKeys(
      user.id,
      new Date("2026-10-18T00:00:00.000Z"),
      new Date("2026-10-23T00:00:00.000Z"),
      TZ,
    );
    expect(chips).toEqual(expect.arrayContaining(["2026-10-20", "2026-10-21"]));

    const week = await getWeeklyActivity(user.id, NOW, TZ);
    expect(week.daysActive).toBeGreaterThanOrEqual(1);
    const home = await getHomeTelemetry({ userId: user.id, now: NOW, timeZone: TZ });
    expect(home.streakCurrent).toBeGreaterThanOrEqual(1);
  });

  it("stores partial when finished sets are short of the plan", async () => {
    const user = await makeUser("backfill-partial@example.com");
    await onboard(user.id);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-21",
      kind: "custom",
      resolution: "",
      now: NOW,
      title: "Short squat",
      notes: "",
      rpe: null,
      exercises: [{ name: "Past squat", sets: 4, done: 1, reps: "5", logMode: "load_reps" }],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.status).toBe("partial");
    const history = await listWorkoutSessionsForUser(user.id);
    expect(completionListLabel(history[0]!)).toBe("partial");
    const schedule = await getCalendarSchedule(user.id, NOW, NOW);
    const wednesday = schedule.days.find((day) => formatDayParam(day.date, TZ) === "2026-10-21");
    expect(wednesday?.activities.some((item) => subtitleShowsPartial(item.subtitle))).toBe(true);
    const chips = await completedLocalDayKeys(
      user.id,
      new Date("2026-10-18T00:00:00.000Z"),
      new Date("2026-10-23T00:00:00.000Z"),
      TZ,
    );
    expect(chips).not.toContain("2026-10-21");
    const home = await getHomeTelemetry({ userId: user.id, now: NOW, timeZone: TZ });
    expect(home.streakCurrent).toBe(0);
  });

  it("keeps set numbers going across rows that share a name", async () => {
    const user = await makeUser("backfill-slots@example.com");
    await onboard(user.id);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-20",
      kind: "custom",
      resolution: "",
      now: NOW,
      title: "Bag and lifts",
      notes: "",
      rpe: null,
      exercises: [
        { name: "Heavy bag rounds", sets: 2, done: 2, reps: "180", logMode: "timed_round" },
        { name: "Heavy bag rounds", sets: 2, done: 1, reps: "180", logMode: "timed_round" },
        { name: "Back squat", sets: 1, done: 1, reps: "5", logMode: "load_reps" },
        { name: "Back squat", sets: 1, done: 1, reps: "5", logMode: "load_reps" },
      ],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const sets = await prisma.workoutSet.findMany({
      where: { workoutSessionId: saved.sessionId },
      orderBy: { sortOrder: "asc" },
    });
    const slots = sets.map((set) => `${set.exerciseName}#${set.setNumber}`);
    expect(slots).toEqual([
      "Heavy bag rounds#1",
      "Heavy bag rounds#2",
      "Heavy bag rounds#3",
      "Heavy bag rounds#4",
      "Back squat#1",
      "Back squat#2",
    ]);
    expect(new Set(slots).size).toBe(slots.length);
    const bag = sets.filter((set) => set.exerciseName === "Heavy bag rounds");
    expect(bag.map((set) => set.completed)).toEqual([true, true, true, false]);
  });

  it("keeps the civil day in the member zone", async () => {
    const la = await makeUser("backfill-la@example.com");
    await onboard(la.id, "America/Los_Angeles");
    const laNow = new Date("2026-10-22T06:00:00.000Z");
    await expect(freeLog(la.id, "2026-10-22", "Too soon", laNow)).rejects.toThrow(/future/i);
    const laSaved = await freeLog(la.id, "2026-10-20", "West coast", laNow);
    expect(laSaved.ok).toBe(true);
    if (!laSaved.ok) return;
    const laRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: laSaved.sessionId } });
    expect(sessionCompletionDay(laRow, "America/Los_Angeles")).toBe("2026-10-20");

    const nz = await makeUser("backfill-nz@example.com");
    await onboard(nz.id, "Pacific/Auckland");
    const nzNow = new Date("2026-10-22T15:00:00.000Z");
    const nzToday = await freeLog(nz.id, "2026-10-23", "Today", nzNow);
    expect(nzToday.ok).toBe(true);
    if (nzToday.ok) {
      const todayRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: nzToday.sessionId } });
      expect(sessionCompletionDay(todayRow, "Pacific/Auckland")).toBe("2026-10-23");
    }
    await expect(freeLog(nz.id, "2026-10-24", "Ahead", nzNow)).rejects.toThrow(/future/i);
    const nzSaved = await freeLog(nz.id, "2026-10-22", "East coast", nzNow);
    expect(nzSaved.ok).toBe(true);
    if (!nzSaved.ok) return;
    const nzRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: nzSaved.sessionId } });
    expect(sessionCompletionDay(nzRow, "Pacific/Auckland")).toBe("2026-10-22");
  });

  it("accepts today, and rejects the future, dates older than 30 days, and absurd durations", async () => {
    const user = await makeUser("backfill-window@example.com");
    await onboard(user.id);
    const today = dayKey(NOW, TZ);
    const future = dayKey(addZonedDays(startOfZonedDay(NOW, TZ), 1, TZ), TZ);
    const old = dayKey(addZonedDays(startOfZonedDay(NOW, TZ), -31, TZ), TZ);
    const todaySaved = await freeLog(user.id, today, "Today");
    expect(todaySaved.ok).toBe(true);
    if (todaySaved.ok) {
      const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: todaySaved.sessionId } });
      expect(sessionCompletionDay(row, TZ)).toBe(today);
      expect(row.backfilled).toBe(true);
    }
    await expect(freeLog(user.id, future, "Future")).rejects.toThrow(/future/i);
    await expect(freeLog(user.id, old, "Old")).rejects.toThrow(/30/);
    await expect(
      createBackfillWorkout({
        userId: user.id,
        dayKey: "2026-10-21",
        kind: "free",
        resolution: "",
        now: NOW,
        title: "Too long",
        notes: "",
        rpe: null,
        durationSeconds: 5 * 60 * 60,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("asks before adding a second session, then extra and replace", async () => {
    const user = await makeUser("backfill-dup@example.com");
    await onboard(user.id);
    const first = await freeLog(user.id, "2026-10-20", "First");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const blocked = await freeLog(user.id, "2026-10-20", "Second");
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.conflict.map((row) => row.id)).toContain(first.sessionId);

    const extra = await freeLog(user.id, "2026-10-20", "Second", NOW, "extra");
    expect(extra.ok).toBe(true);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);

    const replaced = await freeLog(user.id, "2026-10-20", "Only", NOW, "replace");
    expect(replaced.ok).toBe(true);
    const left = await prisma.workoutSession.findMany({ where: { userId: user.id } });
    expect(left).toHaveLength(1);
    expect(left[0]?.title).toBe("Only");
    expect(left[0]?.id).not.toBe(first.sessionId);
  });

  it("keeps the day's session when a replace fails while saving", async () => {
    const user = await makeUser("backfill-rollback@example.com");
    await onboard(user.id);
    const first = await freeLog(user.id, "2026-10-20", "First");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    faultNextBackfillWrite(() => {
      throw new Error("replace failed");
    });
    await expect(freeLog(user.id, "2026-10-20", "Only", NOW, "replace")).rejects.toThrow(/replace failed/);
    const left = await prisma.workoutSession.findMany({ where: { userId: user.id } });
    expect(left).toHaveLength(1);
    expect(left[0]?.id).toBe(first.sessionId);
    expect(left[0]?.title).toBe("First");

    const extra = await freeLog(user.id, "2026-10-20", "Second", NOW, "extra");
    expect(extra.ok).toBe(true);
    faultNextBackfillWrite(() => {
      throw new Error("edit failed");
    });
    await expect(
      updateBackfillWorkout({
        userId: user.id,
        sessionId: first.sessionId,
        dayKey: "2026-10-20",
        title: "Renamed",
        notes: "",
        rpe: null,
        exercises: [{ name: "Heavy bag rounds", sets: 3, done: 3, reps: "180", logMode: "timed_round" }],
        confirmed: true,
        resolution: "replace",
        now: NOW,
      }),
    ).rejects.toThrow(/edit failed/);
    const after = await prisma.workoutSession.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
    });
    expect(after.map((row) => row.title)).toEqual(["First", "Second"]);
    expect(after.find((row) => row.id === first.sessionId)?.title).toBe("First");
  });

  it("edits and deletes a backfill only after confirm, and only for the owner", async () => {
    const user = await makeUser("backfill-owner@example.com");
    const other = await makeUser("backfill-other@example.com");
    await onboard(user.id);
    const saved = await freeLog(user.id, "2026-10-20", "Bag night");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    await expect(
      updateBackfillWorkout({
        userId: user.id,
        sessionId: saved.sessionId,
        dayKey: "2026-10-20",
        title: "Bag night",
        notes: "",
        rpe: null,
        exercises: [{ name: "Heavy bag rounds", sets: 3, done: 3, reps: "180", logMode: "timed_round" }],
        confirmed: false,
        resolution: "",
        now: NOW,
      }),
    ).rejects.toThrow(/confirm/i);
    await expect(
      deleteBackfillWorkout({ userId: user.id, sessionId: saved.sessionId, confirmed: false }),
    ).rejects.toThrow(/confirm/i);
    await expect(
      updateBackfillWorkout({
        userId: other.id,
        sessionId: saved.sessionId,
        dayKey: "2026-10-20",
        title: "Stolen",
        notes: "",
        rpe: null,
        exercises: [{ name: "Heavy bag rounds", sets: 1, done: 1, reps: "60", logMode: "timed" }],
        confirmed: true,
        resolution: "",
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const rounds = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-19",
      kind: "rounds",
      resolution: "",
      now: NOW,
      title: "",
      notes: "long jab",
      rpe: 6,
      roundMode: "bag",
      plannedRounds: 3,
      doneRounds: 2,
      workSeconds: 180,
      restSeconds: 60,
    });
    expect(rounds.ok).toBe(true);
    if (rounds.ok) {
      const row = await prisma.workoutSession.findUnique({
        where: { id: rounds.sessionId },
        include: { sets: true },
      });
      expect(row?.status).toBe("partial");
      expect(roundHistoryLine(row!)).toBe("2 rounds · 3:00 round · 1:00 rest · 7:00 total · RPE 6");
    }
    const bike = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-18",
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "Assault bike",
      notes: "",
      rpe: null,
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      doneRounds: 8,
    });
    expect(bike.ok).toBe(true);
    if (bike.ok) {
      const row = await prisma.workoutSession.findUnique({
        where: { id: bike.sessionId },
        include: { sets: true },
      });
      expect(roundHistoryLine(row!)).toBe("8 rounds · 0:15 round · 0:15 rest · 4:00 total");
    }

    await deleteBackfillWorkout({ userId: user.id, sessionId: saved.sessionId, confirmed: true });
    expect(await prisma.workoutSession.findUnique({ where: { id: saved.sessionId } })).toBeNull();
  });

  it("keeps each round's duration and round key when an edit posts empty reps", async () => {
    const user = await makeUser("backfill-keep-rounds@example.com");
    await onboard(user.id);
    const rounds = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-19",
      kind: "rounds",
      resolution: "",
      now: NOW,
      title: "Heavy bag rounds",
      notes: "long jab",
      rpe: 6,
      roundMode: "bag",
      plannedRounds: 3,
      doneRounds: 3,
      workSeconds: 120,
      restSeconds: 60,
    });
    expect(rounds.ok).toBe(true);
    if (!rounds.ok) return;
    const before = await prisma.workoutSession.findUnique({
      where: { id: rounds.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(roundHistoryLine(before!)).toBe("3 rounds · 2:00 round · 1:00 rest · 8:00 total · RPE 6");
    const seed = backfillFormSeed(before!, TZ, NOW);
    expect(seed.exercises[0]?.reps).toBe("2:00");
    expect(seed.exercises[0]?.prescriptionKey?.startsWith("round:")).toBe(true);
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: rounds.sessionId,
      dayKey: "2026-10-19",
      title: "Heavy bag rounds",
      notes: "notes only",
      rpe: 6,
      exercises: seed.exercises.map((row) => ({ ...row, reps: "" })),
      confirmed: true,
      resolution: "",
      now: NOW,
    });
    expect(edited.ok).toBe(true);
    const after = await prisma.workoutSession.findUnique({
      where: { id: rounds.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(after?.notes).toBe("notes only");
    expect(after?.sets.map((set) => set.durationSeconds)).toEqual([120, 120, 120]);
    expect(after?.sets.every((set) => (set.prescriptionKey ?? "").startsWith("round:"))).toBe(true);
    expect(roundHistoryLine(after!)).toBe("3 rounds · 2:00 round · 1:00 rest · 8:00 total · RPE 6");
  });
});

function fieldValue(html: string, name: string) {
  const pattern = new RegExp(`name="${name}"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="${name}"`);
  const match = html.match(pattern);
  return match?.[1] ?? match?.[2] ?? "";
}

const pastSeed: BackfillFormSeed = {
  title: "Lift 3",
  notes: "easy",
  dayKey: "2026-10-20",
  sessionRpe: 6,
  exercises: [{ name: "Bench", sets: 3, done: 3, reps: "8", logMode: "load_reps" }],
};

describe("past log first paint and finish time", () => {
  it("renders the day select and edit or delete dialog with their initial values", () => {
    const sample = backfillDayOptions(new Date(), TZ)[2];
    expect(sample?.key).toBeTruthy();
    const seeded: BackfillFormSeed = { ...pastSeed, dayKey: sample!.key };
    const createHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: sample!.key,
        entry: "calendar",
        label: "Log a completed workout",
        timeZone: TZ,
        defaultOpen: true,
      }),
    );
    expect(createHtml).toContain('data-testid="log-past-workout-date"');
    expect(createHtml).toContain(`value="${sample!.key}"`);
    expect(createHtml).toContain(sample!.label);
    expect(createHtml).toContain("Log a past workout");
    expect(createHtml).toContain("8x20/10");
    expect(createHtml).toContain("text-base");
    const days = backfillDayOptions(new Date(), TZ);
    const homeHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: days[0]!.key,
        entry: "home",
        label: "Open",
        timeZone: TZ,
        defaultOpen: true,
      }),
    );
    expect(homeHtml).toContain("Log a workout");
    expect(homeHtml).toContain(`value="${days[0]!.key}"`);
    expect(homeHtml).toContain(days[0]!.label);
    const historyHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        entry: "history",
        label: "Open",
        timeZone: TZ,
        defaultOpen: true,
      }),
    );
    expect(historyHtml).toContain("Log a past workout");
    expect(historyHtml).toContain(days[1]!.label);
    expect(historyHtml).toContain(`value="${days[1]!.key}"`);

    const editHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        entry: "edit",
        sessionId: "sess-1",
        label: "Edit",
        timeZone: TZ,
        seed: seeded,
        defaultOpen: true,
      }),
    );
    expect(editHtml).toContain("Edit past workout");
    expect(editHtml).toContain("Lift 3");
    expect(editHtml).toContain("easy");
    expect(editHtml).toContain("Bench");
    expect(editHtml).toContain(sample!.key);

    const deleteHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        entry: "delete",
        sessionId: "sess-1",
        label: "Delete",
        timeZone: TZ,
        seed: seeded,
        defaultOpen: true,
      }),
    );
    expect(deleteHtml).toContain("Delete Lift 3?");
    expect(deleteHtml).toContain('data-testid="log-past-workout-delete-confirm"');

    const overCapPreview: BackfillPreview = {
      dayKey: sample!.key,
      programs: [],
      saved: [],
      existing: [],
      days: [{ key: sample!.key, label: sample!.label }],
      roundTargets: {},
      lastUsed: {
        bike: {
          label: "10×30",
          sets: 10,
          rounds: 30,
          workSeconds: 900,
          restSeconds: 600,
          setRestSeconds: 600,
        },
      },
      bagRounds: 5,
      units: "lb",
      weightAccess: "gym",
      shadowWeight: null,
    };
    const overCapHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: sample!.key,
        entry: "calendar",
        label: "Log",
        timeZone: TZ,
        defaultOpen: true,
        initialPreview: overCapPreview,
      }),
    );
    expect(overCapHtml).toContain("Save · 10×30 @ 15:00/10:00");
    expect(overCapHtml).not.toContain("7590:00");
    expect(overCapHtml).not.toContain("7490:00");
    expect(overCapHtml).toContain("Max 4:00:00");
    expect(overCapHtml).toMatch(/data-testid="log-past-workout-save"[^>]*disabled/);

    const steadyPreview: BackfillPreview = {
      dayKey: sample!.key,
      programs: [],
      saved: [],
      existing: [],
      days: [{ key: sample!.key, label: sample!.label }],
      roundTargets: {
        bike: {
          programDayId: "bike-day",
          exerciseName: "Bike",
          plannedRounds: 1,
          daySetCount: 1,
          sets: 1,
          rounds: 1,
          workSeconds: 22 * 60,
          restSeconds: 0,
          setRestSeconds: 0,
          focusRounds: [],
        },
      },
      lastUsed: {},
      bagRounds: 5,
      units: "lb",
      weightAccess: "gym",
      shadowWeight: null,
    };
    const steadyHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: sample!.key,
        entry: "calendar",
        label: "Log",
        timeZone: TZ,
        defaultOpen: true,
        initialPreview: steadyPreview,
      }),
    );
    expect(steadyHtml).toContain("1x22:00/0");
    expect(steadyHtml).toContain("Save · 1×22:00/0 · 22:00");
    expect(steadyHtml).not.toContain("Work should be between 5 and 900");
    expect(steadyHtml).not.toContain("Try 2x8 @ 15/15");
    expect(steadyHtml).toContain('data-testid="log-past-workout-save" class="font-display');
    const coldHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: sample!.key,
        entry: "calendar",
        label: "Log",
        timeZone: TZ,
        defaultOpen: true,
      }),
    );
    expect(coldHtml).toMatch(/data-testid="log-past-workout-save"[^>]*disabled/);

    const rejectedPreview: BackfillPreview = {
      ...overCapPreview,
      lastUsed: {
        bike: {
          label: "stale",
          sets: 2,
          rounds: 8,
          workSeconds: 2000,
          restSeconds: 15,
          setRestSeconds: 60,
        },
      },
    };
    const rejectedHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: sample!.key,
        entry: "calendar",
        label: "Log",
        timeZone: TZ,
        defaultOpen: true,
        initialPreview: rejectedPreview,
      }),
    );
    expect(rejectedHtml).toContain("2x8 @ 33:20/15 r60");
    expect(rejectedHtml).toContain("Try 2x8 @ 15/15");
    expect(rejectedHtml).not.toContain("Save · 2×8");
    expect(rejectedHtml).toMatch(/data-testid="log-past-workout-save"[^>]*disabled/);
    expect(chipAfterDayPreview(null, true)).toBe("plan");
    expect(chipAfterDayPreview(null, false)).toBe("bike");
    expect(chipAfterDayPreview("bag", true)).toBe("bag");
    expect(chipAfterDayPreview("bike", true)).toBe("bike");
    expect(keepIntervalDraftOnDayChange("bike")).toBe(true);
    expect(keepIntervalDraftOnDayChange("plan")).toBe(false);
    expect(keepIntervalDraftOnDayChange(null)).toBe(false);

    const zeroDone: BackfillFormSeed = {
      title: "2 × 8 rounds · 15/15 · 60s between sets",
      notes: "",
      dayKey: sample!.key,
      sessionRpe: null,
      exercises: [
        {
          name: "Assault bike intervals",
          sets: 16,
          done: 0,
          reps: "15",
          logMode: "timed_round",
          prescriptionKey: "timer#bw:c.15.15.8.0.0.2.60",
          durationSeconds: 15,
        },
      ],
    };
    const zeroHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        entry: "edit",
        sessionId: "sess-zero",
        label: "Edit",
        timeZone: TZ,
        seed: zeroDone,
        defaultOpen: true,
      }),
    );
    expect(zeroHtml).toContain("Log at least one set, then save.");
    expect(zeroHtml).toMatch(/data-testid="log-past-workout-confirm"[^>]*disabled/);
    expect(deleteHtml).toContain('name="sessionId" value="sess-1"');
  });

  it("shows a logged duration on a past finish screen and hides a bogus clock", () => {
    const created = new Date("2026-10-22T18:00:00.000Z");
    const updated = new Date(created.getTime() + 172_000);
    const sets = [
      {
        exerciseName: "Bench",
        reps: 8,
        loadValue: 100,
        loadUnit: "lb",
        completed: true,
      },
    ];
    const live = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Lift",
        status: "complete",
        performedAt: created,
        createdAt: created,
        updatedAt: updated,
        elapsedSeconds: null,
        sets,
      },
    });
    expect(live.find((tile) => tile.key === "time")?.value).toBe("2:52");

    const backfill = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Lift",
        status: "complete",
        performedAt: new Date("2026-10-20T18:00:00.000Z"),
        createdAt: created,
        updatedAt: updated,
        elapsedSeconds: null,
        backfilled: true,
        sets,
      },
    });
    expect(backfill.find((tile) => tile.key === "time")).toBeUndefined();
    expect(backfill.map((tile) => tile.value)).not.toContain("2:52");
    expect(backfill.map((tile) => tile.value)).not.toContain("0:00");

    const zero = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Lift",
        status: "complete",
        performedAt: new Date("2026-10-20T18:00:00.000Z"),
        createdAt: created,
        updatedAt: created,
        elapsedSeconds: 0,
        backfilled: true,
        sets,
      },
    });
    expect(zero.find((tile) => tile.key === "time")).toBeUndefined();

    const logged = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Assault bike",
        status: "partial",
        performedAt: new Date("2026-10-20T18:00:00.000Z"),
        createdAt: created,
        updatedAt: updated,
        elapsedSeconds: 20 * 60,
        backfilled: true,
        sets: [
          {
            exerciseName: "Assault bike",
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            completed: true,
            durationSeconds: 150,
          },
        ],
      },
    });
    expect(logged.find((tile) => tile.key === "time")?.value).toBe("20:00");

    const changed = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Steady ride · 30:00",
        status: "complete",
        performedAt: new Date("2026-10-20T18:00:00.000Z"),
        createdAt: created,
        updatedAt: updated,
        elapsedSeconds: 30 * 60 + 6,
        backfilled: true,
        sets: [
          {
            exerciseName: "Assault bike intervals",
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            completed: true,
            durationSeconds: 105 * 60,
            prescriptionKey: `timer#bw:c.${105 * 60}.0.1.0.0`,
          },
        ],
      },
    });
    expect(changed.find((tile) => tile.key === "time")?.value).toBe("1:45:00");
    expect(changed.find((tile) => tile.key === "time")?.value).not.toBe("30:06");

    const partialLift = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 1,
      session: {
        title: "Lift 3",
        status: "partial",
        performedAt: new Date("2026-10-20T18:00:00.000Z"),
        createdAt: created,
        updatedAt: updated,
        elapsedSeconds: null,
        sets,
      },
    });
    expect(partialLift.find((tile) => tile.key === "time")).toBeUndefined();
    expect(partialLift.map((tile) => tile.value)).not.toContain("2:52");

    const pushUp = historyCountLine({
      status: "complete",
      plannedSetCount: 1,
      sets: [{ exerciseName: "Weighted push-up", completed: true, reps: 8, loadValue: 25, durationSeconds: null }],
      programDay: { exercises: [{ name: "Weighted push-up", sets: 4 }] },
    });
    expect(pushUp).toBe("1/4 sets · Partial");
    const bikeRows = exerciseSetProgress(
      [{ name: "Assault bike alactic", sets: 1 }],
      [{ exerciseName: "Assault bike intervals", completed: true, reps: null, loadValue: null, durationSeconds: 20 }],
    );
    expect(bikeRows).toEqual([
      { name: "Assault bike alactic", ticked: 1, planned: 1, state: "complete" },
    ]);
  });
});

describe("today and past interval logs", () => {
  beforeEach(async () => {
    clearBackfillWriteFault();
    await resetDatabase();
  });

  function rickyBike(userId: string, dayKeyValue: string, doneRounds: number) {
    return createBackfillWorkout({
      userId,
      dayKey: dayKeyValue,
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
      doneRounds,
    });
  }

  it("logs today and a past Wednesday in the live timer shape", async () => {
    const user = await makeUser("backfill-today-past@example.com");
    await onboard(user.id);
    const today = dayKey(NOW, TZ);
    const past = "2026-10-21";
    const pastPreview = await previewBackfillDay(user.id, past, NOW);
    const todayPreview = await previewBackfillDay(user.id, today, NOW);
    expect(pastPreview.days[0]?.key).toBe(today);
    expect(pastPreview.days.some((day) => day.key === past)).toBe(true);
    expect(pastPreview.days.some((day) => day.key > today)).toBe(false);

    const wednesday = await rickyBike(user.id, past, 16);
    expect(wednesday.ok).toBe(true);
    if (!wednesday.ok) return;
    const pastRow = await prisma.workoutSession.findUnique({
      where: { id: wednesday.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(pastRow?.sets).toHaveLength(16);
    expect(pastRow?.sets.every((set) => set.completed && set.durationSeconds === 15)).toBe(true);
    expect(pastRow?.sets.some((set) => set.completed === false)).toBe(false);
    expect(pastRow?.sets[0]?.prescriptionKey).toBe("timer#bw:c.15.15.8.0.0.2.60");
    expect(pastRow?.title).toBe("2 × 8 rounds · 15/15 · 60s between sets");
    expect((await readWorkoutTimerFields(wednesday.sessionId, prisma)).elapsedSeconds).toBe(540);
    expect(sessionCompletionDay(pastRow!, TZ)).toBe(past);
    if (pastPreview.roundTargets.bike) {
      expect(pastRow?.programDayId).toBe(pastPreview.roundTargets.bike.programDayId);
    }

    const todaySaved = await rickyBike(user.id, today, 16);
    expect(todaySaved.ok).toBe(true);
    if (!todaySaved.ok) return;
    const todayRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: todaySaved.sessionId } });
    expect(sessionCompletionDay(todayRow, TZ)).toBe(today);
    expect(todayRow.backfilled).toBe(true);
    if (todayPreview.roundTargets.bike) {
      expect(todayRow.programDayId).toBe(todayPreview.roundTargets.bike.programDayId);
    }

    const from = new Date("2026-10-18T00:00:00.000Z");
    const to = new Date("2026-10-24T00:00:00.000Z");
    const chips = await completedLocalDayKeys(user.id, from, to, TZ);
    if (wednesday.status === "complete") expect(chips).toContain(past);
    if (todaySaved.status === "complete" && todayRow.programDayId) expect(chips).toContain(today);

    const partial = await rickyBike(await makeUser("backfill-partial-bike@example.com").then(async (row) => {
      await onboard(row.id);
      return row.id;
    }), past, 12);
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.status).toBe("partial");
    const partialSets = await prisma.workoutSet.findMany({ where: { workoutSessionId: partial.sessionId } });
    expect(partialSets).toHaveLength(12);
    expect(partialSets.every((set) => set.completed)).toBe(true);
    expect((await readWorkoutTimerFields(partial.sessionId, prisma)).elapsedSeconds).toBe(405);
  });

  it("merges a live session and leaves a longer or different session in place", async () => {
    const user = await makeUser("backfill-merge@example.com");
    await onboard(user.id);
    const when = performedAtForDayKey("2026-10-21", TZ);
    const choice = customBikeChoice({
      workSeconds: 15,
      restSeconds: 15,
      rounds: 8,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
    });
    expect(choice?.name).toBe("2 × 8 rounds · 15/15 · 60s between sets");
    const live = await logBikeRoundsForUser({
      userId: user.id,
      choice: choice!,
      roundsCompleted: 8,
      now: when,
    });
    const merged = await rickyBike(user.id, "2026-10-21", 16);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.sessionId).toBe(live.id);
    const after = await prisma.workoutSession.findUnique({
      where: { id: live.id },
      include: { sets: true },
    });
    expect(after?.backfilled).toBe(false);
    expect(after?.source).not.toBe("backfill");
    expect(after?.sets).toHaveLength(16);
    expect(after?.performedAt.toISOString()).toBe(live.performedAt.toISOString());

    const other = await makeUser("backfill-separate@example.com");
    await onboard(other.id);
    const full = await logBikeRoundsForUser({
      userId: other.id,
      choice: choice!,
      roundsCompleted: 16,
      now: when,
    });
    const extra = await rickyBike(other.id, "2026-10-21", 4);
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    expect(extra.sessionId).not.toBe(full.id);
    const kept = await prisma.workoutSession.findUnique({
      where: { id: full.id },
      include: { sets: true },
    });
    expect(kept?.sets).toHaveLength(16);
    expect(await prisma.workoutSession.count({ where: { userId: other.id } })).toBe(2);

    const lift = await createBackfillWorkout({
      userId: other.id,
      dayKey: "2026-10-20",
      kind: "custom",
      resolution: "",
      now: NOW,
      title: "Squat day",
      notes: "",
      rpe: null,
      exercises: [{ name: "Back squat", sets: 3, done: 3, reps: "5", logMode: "load_reps" }],
    });
    expect(lift.ok).toBe(true);
    const beside = await rickyBike(other.id, "2026-10-20", 16);
    expect(beside.ok).toBe(true);
    if (!lift.ok || !beside.ok) return;
    expect(beside.sessionId).not.toBe(lift.sessionId);
    const squat = await prisma.workoutSession.findUnique({ where: { id: lift.sessionId } });
    expect(squat?.title).toBe("Squat day");
  });

  it("creates a second bike ride and does not fall back to a lift session", async () => {
    const user = await makeUser("backfill-second-bike@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const first = await rickyBike(user.id, day, 8);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const liftDay = await prisma.programDay.findFirst({
      where: { title: { contains: "Lift" } },
      select: { id: true },
    });
    const second = await createBackfillWorkout({
      userId: user.id,
      dayKey: day,
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "Steady spin",
      notes: "",
      rpe: null,
      workSeconds: 20 * 60,
      restSeconds: 0,
      roundsPerSet: 1,
      repeatRounds: 1,
      doneRounds: 1,
      programDayId: liftDay?.id ?? "lift-day",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.sessionId).not.toBe(first.sessionId);
    const ride = await prisma.workoutSession.findUnique({
      where: { id: second.sessionId },
      include: { sets: true },
    });
    expect(ride?.programDayId).not.toBe(liftDay?.id ?? "lift-day");
    expect(ride?.sets.length).toBeGreaterThan(0);
    expect(ride?.sets.every((set) => /bike/i.test(set.exerciseName))).toBe(true);
    expect(ride?.sets.some((set) => /squat|bench|deadlift/i.test(set.exerciseName))).toBe(false);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);
  });

  it("saves shadow rounds with a weight, and without one when the member has no weights", async () => {
    const user = await makeUser("backfill-shadow@example.com");
    await onboard(user.id);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-20",
      kind: "shadow",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      shadowRounds: [
        { workSeconds: 180, restSeconds: 60, weight: null },
        { workSeconds: 120, restSeconds: 0, weight: 3 },
      ],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const sets = await prisma.workoutSet.findMany({
      where: { workoutSessionId: saved.sessionId },
      orderBy: { exerciseName: "asc" },
    });
    expect(sets.map((set) => set.exerciseName).sort()).toEqual([
      "Shadowbox round 1 — empty hands",
      "Shadowbox round 2 — hand weights",
    ]);
    const weighted = sets.find((set) => set.exerciseName.includes("hand weights"));
    expect(weighted?.logMode).toBe("load_timed");
    expect(weighted?.loadValue).toBe(3);
    expect(weighted?.setNumber).toBe(1);

    await prisma.profile.update({ where: { userId: user.id }, data: { weightAccess: "none" } });
    const bare = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-19",
      kind: "shadow",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      shadowRounds: [
        { workSeconds: 180, restSeconds: 60, weight: 3 },
        { workSeconds: 180, restSeconds: 0, weight: 3 },
      ],
    });
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    const bareSets = await prisma.workoutSet.findMany({ where: { workoutSessionId: bare.sessionId } });
    expect(bareSets.map((set) => set.exerciseName)).toContain("Shadowbox round 2 — fists, no weights");
    expect(bareSets.every((set) => set.logMode === "timed" && set.loadValue == null)).toBe(true);
  });

  function bagLog(
    userId: string,
    dayKeyValue: string,
    workSeconds: number,
    rounds = 3,
    sets = 1,
    setRest = 60,
    now = NOW,
  ) {
    return createBackfillWorkout({
      userId,
      dayKey: dayKeyValue,
      kind: "bag",
      resolution: "",
      now,
      title: "",
      notes: "",
      rpe: null,
      workSeconds,
      restSeconds: 60,
      roundsPerSet: rounds,
      repeatRounds: sets,
      restBetweenRoundsSeconds: setRest,
      doneRounds: rounds * sets,
    });
  }

  it("does not merge a different work, set count, or bag clock into an existing log", async () => {
    const user = await makeUser("backfill-clock-mismatch@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const fifteen = await rickyBike(user.id, day, 16);
    expect(fifteen.ok).toBe(true);
    if (!fifteen.ok) return;
    const twenty = await createBackfillWorkout({
      userId: user.id,
      dayKey: day,
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      workSeconds: 20,
      restSeconds: 10,
      roundsPerSet: 8,
      repeatRounds: 1,
      restBetweenRoundsSeconds: 0,
      doneRounds: 8,
    });
    expect(twenty.ok).toBe(true);
    if (!twenty.ok) return;
    expect(twenty.sessionId).not.toBe(fifteen.sessionId);
    const keptFifteen = await prisma.workoutSession.findUnique({
      where: { id: fifteen.sessionId },
      include: { sets: true },
    });
    expect(keptFifteen?.sets).toHaveLength(16);
    expect(keptFifteen?.sets.every((set) => set.durationSeconds === 15)).toBe(true);

    const tabataUser = await makeUser("backfill-tabata-separate@example.com");
    await onboard(tabataUser.id);
    const when = performedAtForDayKey(day, TZ);
    const tabata = await logBikeRoundsForUser({
      userId: tabataUser.id,
      choice: bikeChoiceById("tabata")!,
      roundsCompleted: 8,
      now: when,
    });
    const intoTabata = await rickyBike(tabataUser.id, day, 16);
    expect(intoTabata.ok).toBe(true);
    if (!intoTabata.ok) return;
    expect(intoTabata.sessionId).not.toBe(tabata.id);
    const keptTabata = await prisma.workoutSession.findUnique({
      where: { id: tabata.id },
      include: { sets: true },
    });
    expect(keptTabata?.sets).toHaveLength(8);
    expect(keptTabata?.sets.every((set) => set.durationSeconds === 20)).toBe(true);

    const bagUser = await makeUser("backfill-bag-clock@example.com");
    await onboard(bagUser.id);
    const threeMinute = await bagLog(bagUser.id, day, 180);
    expect(threeMinute.ok).toBe(true);
    if (!threeMinute.ok) return;
    const twoMinute = await bagLog(bagUser.id, day, 120);
    expect(twoMinute.ok).toBe(true);
    if (!twoMinute.ok) return;
    expect(twoMinute.sessionId).not.toBe(threeMinute.sessionId);
    const keptBag = await prisma.workoutSession.findUnique({
      where: { id: threeMinute.sessionId },
      include: { sets: true },
    });
    expect(keptBag?.sets).toHaveLength(3);
    expect(keptBag?.sets.every((set) => set.durationSeconds === 180)).toBe(true);
    expect(await prisma.workoutSession.count({ where: { userId: bagUser.id } })).toBe(2);
  });

  it("keeps a partial interval partial when edit saves the same structure", async () => {
    const user = await makeUser("backfill-edit-partial@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const partial = await rickyBike(user.id, day, 12);
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.status).toBe("partial");
    const before = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: partial.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    const loaded = await getBackfillForEdit(user.id, partial.sessionId, NOW);
    expect(loaded.structure).toMatchObject({
      kind: "bike",
      sets: 2,
      rounds: 8,
      workSeconds: 15,
      restSeconds: 15,
      setRestSeconds: 60,
      done: 12,
    });
    expect(decodeInterval(before.sets)?.kind).toBe("bike");
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: partial.sessionId,
      dayKey: day,
      title: before.title,
      notes: before.notes ?? "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: loaded.structure,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.status).toBe("partial");
    const after = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: partial.sessionId },
      include: { sets: true },
    });
    expect(after.status).toBe("partial");
    expect(after.plannedSetCount).toBe(before.plannedSetCount);
    expect(after.sets).toHaveLength(12);
    expect(after.sets.every((set) => set.prescriptionKey === "timer#bw:c.15.15.8.0.0.2.60")).toBe(true);
  });

  it("renames an interval when the structure changes and rejects a zero done count", async () => {
    const user = await makeUser("backfill-edit-structure@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const partial = await rickyBike(user.id, day, 16);
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    const before = await prisma.workoutSession.findUniqueOrThrow({ where: { id: partial.sessionId } });
    await expect(
      updateBackfillWorkout({
        userId: user.id,
        sessionId: partial.sessionId,
        dayKey: day,
        title: before.title,
        notes: "",
        rpe: null,
        exercises: [],
        confirmed: true,
        resolution: "",
        now: NOW,
        interval: {
          kind: "bike",
          sets: 2,
          rounds: 8,
          workSeconds: 15,
          restSeconds: 15,
          setRestSeconds: 60,
          done: 0,
        },
      }),
    ).rejects.toThrow("Log at least one set, then save.");
    const kept = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: partial.sessionId },
      include: { sets: true },
    });
    expect(kept.sets).toHaveLength(16);
    expect(kept.title).toBe(before.title);
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: partial.sessionId,
      dayKey: day,
      title: before.title,
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 2,
        rounds: 8,
        workSeconds: 20,
        restSeconds: 10,
        setRestSeconds: 60,
        done: 16,
      },
    });
    expect(edited.ok).toBe(true);
    const after = await prisma.workoutSession.findUniqueOrThrow({ where: { id: partial.sessionId } });
    expect(after.title).toBe("2 × 8 rounds · 20/10 · 60s between sets");
    const custom = await updateBackfillWorkout({
      userId: user.id,
      sessionId: partial.sessionId,
      dayKey: day,
      title: "Morning ride",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 2,
        rounds: 8,
        workSeconds: 20,
        restSeconds: 15,
        setRestSeconds: 60,
        done: 16,
      },
    });
    expect(custom.ok).toBe(true);
    const named = await prisma.workoutSession.findUniqueOrThrow({ where: { id: partial.sessionId } });
    expect(named.title).toBe("Morning ride");
    const later = await updateBackfillWorkout({
      userId: user.id,
      sessionId: partial.sessionId,
      dayKey: day,
      title: "Morning ride",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 2,
        rounds: 8,
        workSeconds: 30,
        restSeconds: 30,
        setRestSeconds: 60,
        done: 16,
      },
    });
    expect(later.ok).toBe(true);
    const keptName = await prisma.workoutSession.findUniqueOrThrow({ where: { id: partial.sessionId } });
    expect(keptName.title).toBe("Morning ride");
  });

  it("keeps a typed name and a default activity title when a later edit changes the structure", async () => {
    const user = await makeUser("backfill-keep-custom-title@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const ride = await rickyBike(user.id, day, 16);
    expect(ride.ok).toBe(true);
    if (!ride.ok) return;
    const renamed = await updateBackfillWorkout({
      userId: user.id,
      sessionId: ride.sessionId,
      dayKey: day,
      title: "Hill sprints",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 2,
        rounds: 8,
        workSeconds: 15,
        restSeconds: 15,
        setRestSeconds: 60,
        done: 16,
      },
    });
    expect(renamed.ok).toBe(true);
    const tuesday = await updateBackfillWorkout({
      userId: user.id,
      sessionId: ride.sessionId,
      dayKey: day,
      title: "Tuesday ride",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 2,
        rounds: 8,
        workSeconds: 15,
        restSeconds: 15,
        setRestSeconds: 60,
        done: 16,
      },
    });
    expect(tuesday.ok).toBe(true);
    const shifted = await updateBackfillWorkout({
      userId: user.id,
      sessionId: ride.sessionId,
      dayKey: day,
      title: "Tuesday ride",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 1,
        rounds: 8,
        workSeconds: 20,
        restSeconds: 10,
        setRestSeconds: 0,
        done: 8,
      },
    });
    expect(shifted.ok).toBe(true);
    const named = await prisma.workoutSession.findUniqueOrThrow({ where: { id: ride.sessionId } });
    expect(named.title).toBe("Tuesday ride");

    const bag = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-20",
      kind: "bag",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      roundMode: "bag",
      roundsPerSet: 3,
      repeatRounds: 2,
      doneRounds: 6,
      workSeconds: 180,
      restSeconds: 60,
      restBetweenRoundsSeconds: 120,
    });
    expect(bag.ok).toBe(true);
    if (!bag.ok) return;
    const bagBefore = await prisma.workoutSession.findUniqueOrThrow({ where: { id: bag.sessionId } });
    expect(bagBefore.title).toBe("Heavy bag rounds");
    const bagEdited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: bag.sessionId,
      dayKey: "2026-10-20",
      title: "Heavy bag rounds",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bag",
        sets: 2,
        rounds: 3,
        workSeconds: 120,
        restSeconds: 60,
        setRestSeconds: 120,
        done: 6,
      },
    });
    expect(bagEdited.ok).toBe(true);
    const bagAfter = await prisma.workoutSession.findUniqueOrThrow({ where: { id: bag.sessionId } });
    expect(bagAfter.title).toBe("Heavy bag rounds");
  });

  it("names an out-of-range bike from the structure instead of Assault bike intervals", async () => {
    const user = await makeUser("backfill-bike-structure-title@example.com");
    await onboard(user.id);
    const cases = [
      { workSeconds: 20, restSeconds: 600, roundsPerSet: 2, title: "2 rounds · 20/10:00" },
      { workSeconds: 900, restSeconds: 60, roundsPerSet: 2, title: "2 rounds · 15:00/1:00" },
      { workSeconds: 20, restSeconds: 200, roundsPerSet: 8, title: "8 rounds · 20/3:20" },
    ];
    for (const [index, spec] of cases.entries()) {
      const saved = await createBackfillWorkout({
        userId: user.id,
        dayKey: `2026-10-${18 + index}`,
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: spec.workSeconds,
        restSeconds: spec.restSeconds,
        roundsPerSet: spec.roundsPerSet,
        repeatRounds: 1,
        doneRounds: spec.roundsPerSet,
      });
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: saved.sessionId } });
      expect(row.title).toBe(spec.title);
      expect(row.title).not.toBe("Assault bike intervals");
    }
  });

  it("opens a partial bike from History Edit and saves it unchanged", async () => {
    const user = await makeUser("backfill-history-edit@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const partial = await rickyBike(user.id, day, 12);
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    const before = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: partial.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    const seed = backfillFormSeed(before, TZ, NOW);
    const html = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        entry: "edit",
        sessionId: partial.sessionId,
        label: "Edit",
        compact: true,
        timeZone: TZ,
        seed,
        defaultOpen: true,
      }),
    );
    expect(html).toContain('data-testid="log-past-workout-edit"');
    expect(html).toContain('data-testid="interval-structure"');
    expect(html).toContain('name="intervalEdit" value="yes"');
    expect(html).toContain('name="kind" value="bike"');
    expect(html).toContain('name="doneRounds" value="12"');
    expect(html).toContain('name="roundsPerSet" value="8"');
    expect(html).toContain('name="repeatRounds" value="2"');
    expect(html).not.toContain('name="exerciseSets_0"');
    const beforeTimer = await readWorkoutTimerFields(partial.sessionId, prisma);
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: partial.sessionId,
      dayKey: fieldValue(html, "dayKey"),
      title: fieldValue(html, "title"),
      notes: before.notes ?? "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: Number(fieldValue(html, "repeatRounds")),
        rounds: Number(fieldValue(html, "roundsPerSet")),
        workSeconds: Number(fieldValue(html, "workSeconds")),
        restSeconds: Number(fieldValue(html, "restSeconds")),
        setRestSeconds: Number(fieldValue(html, "restBetweenRoundsSeconds")),
        done: Number(fieldValue(html, "doneRounds")),
      },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.status).toBe("partial");
    const after = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: partial.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    const afterTimer = await readWorkoutTimerFields(partial.sessionId, prisma);
    expect(after.status).toBe("partial");
    expect(after.plannedSetCount).toBe(before.plannedSetCount);
    expect(after.performedAt.toISOString()).toBe(before.performedAt.toISOString());
    expect(after.sets.map((set) => set.id)).toEqual(before.sets.map((set) => set.id));
    expect(afterTimer.elapsedSeconds).toBe(beforeTimer.elapsedSeconds);
    expect(afterTimer.finishedAt?.toISOString() ?? null).toBe(beforeTimer.finishedAt?.toISOString() ?? null);
  });

  it("leaves a running lift draft alone when bag rounds are logged that day", async () => {
    const user = await makeUser("backfill-live-draft@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const probe = await bagLog(user.id, day, 180);
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    const probeRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: probe.sessionId } });
    await prisma.workoutSession.delete({ where: { id: probe.sessionId } });
    const started = new Date("2026-10-21T18:10:00.000Z");
    const draft = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: probeRow.programDayId,
        title: "Quick lift",
        performedAt: performedAtForDayKey(day, TZ),
        status: "draft",
        plannedSetCount: 8,
        source: "logger",
        backfilled: false,
        sets: {
          create: [
            {
              exerciseName: "Back squat",
              setNumber: 1,
              reps: 5,
              loadValue: 135,
              loadUnit: "lb",
              logMode: "load_reps",
              completed: true,
              sortOrder: 1,
              notes: "",
              prescriptionKey: "squat",
            },
            {
              exerciseName: "Heavy bag rounds",
              setNumber: 1,
              durationSeconds: 180,
              loadUnit: "lb",
              logMode: "timed_round",
              completed: true,
              sortOrder: 2,
              notes: "",
              prescriptionKey: "round:bag:60:1:0:3",
            },
          ],
        },
      },
    });
    await prisma.workoutSession.update({
      where: { id: draft.id },
      data: { timerStartedAt: started, elapsedSeconds: 300 },
    });
    const logged = await bagLog(user.id, day, 180);
    expect(logged.ok).toBe(true);
    if (!logged.ok) return;
    expect(logged.sessionId).not.toBe(draft.id);
    const kept = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: draft.id },
      include: { sets: true },
    });
    expect(kept.title).toBe("Quick lift");
    expect(kept.status).toBe("draft");
    expect(kept.plannedSetCount).toBe(8);
    expect(kept.sets).toHaveLength(2);
    const timer = await readWorkoutTimerFields(draft.id, prisma);
    expect(timer.elapsedSeconds).toBe(300);
    expect(timer.timerStartedAt?.toISOString()).toBe(started.toISOString());
    const bag = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: logged.sessionId },
      include: { sets: true },
    });
    expect(bag.sets.every((set) => set.durationSeconds === 180)).toBe(true);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);
  });

  it("leaves a paused bag draft alone and logs the backfill as its own session", async () => {
    const user = await makeUser("backfill-paused-draft@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    const probe = await bagLog(user.id, day, 180);
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    const probeRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: probe.sessionId } });
    await prisma.workoutSession.delete({ where: { id: probe.sessionId } });
    const draft = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: probeRow.programDayId,
        title: "Heavy bag rounds",
        performedAt: performedAtForDayKey(day, TZ),
        status: "draft",
        plannedSetCount: 3,
        source: "logger",
        backfilled: false,
        sets: {
          create: [
            {
              exerciseName: "Heavy bag rounds",
              setNumber: 1,
              durationSeconds: 180,
              loadUnit: "lb",
              logMode: "timed_round",
              completed: true,
              sortOrder: 1,
              notes: "",
              prescriptionKey: "round:bag:60:1:0:3",
            },
          ],
        },
      },
    });
    await prisma.workoutSession.update({
      where: { id: draft.id },
      data: { timerStartedAt: null, elapsedSeconds: 300 },
    });
    const logged = await bagLog(user.id, day, 180);
    expect(logged.ok).toBe(true);
    if (!logged.ok) return;
    expect(logged.sessionId).not.toBe(draft.id);
    expect(logged.status).toBe("complete");
    const kept = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: draft.id },
      include: { sets: true },
    });
    expect(kept.status).toBe("draft");
    expect(kept.sets).toHaveLength(1);
    const timer = await readWorkoutTimerFields(draft.id, prisma);
    expect(timer.elapsedSeconds).toBe(300);
    expect(timer.timerStartedAt).toBeNull();
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);
  });

  it("rejects an interval past the live limits or 4 hours without writing rows", async () => {
    const user = await makeUser("backfill-too-long@example.com");
    await onboard(user.id);
    const day = "2026-10-21";
    await expect(
      createBackfillWorkout({
        userId: user.id,
        dayKey: day,
        kind: "bag",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: 5,
        restSeconds: 3600,
        roundsPerSet: 50,
        repeatRounds: 10,
        restBetweenRoundsSeconds: 600,
        doneRounds: 500,
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      createBackfillWorkout({
        userId: user.id,
        dayKey: day,
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: 900,
        restSeconds: 600,
        roundsPerSet: 30,
        repeatRounds: 10,
        restBetweenRoundsSeconds: 600,
        doneRounds: 1,
      }),
    ).rejects.toThrow("That workout is longer than 4 hours.");
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(0);
  });

  it("saves a steady bike longer than 15 minutes and still caps multi-round work", async () => {
    const user = await makeUser("backfill-steady-bike@example.com");
    await onboard(user.id);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-20",
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      workSeconds: 22 * 60,
      restSeconds: 0,
      roundsPerSet: 1,
      repeatRounds: 1,
      doneRounds: 1,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const row = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: saved.sessionId },
      include: { sets: true },
    });
    expect(row.sets).toHaveLength(1);
    expect(row.sets[0]?.durationSeconds).toBe(22 * 60);
    expect((await readWorkoutTimerFields(saved.sessionId, prisma)).elapsedSeconds).toBe(22 * 60);

    const full = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-19",
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      workSeconds: 4 * 60 * 60,
      restSeconds: 0,
      roundsPerSet: 1,
      repeatRounds: 1,
      doneRounds: 1,
    });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect((await readWorkoutTimerFields(full.sessionId, prisma)).elapsedSeconds).toBe(4 * 60 * 60);

    await expect(
      createBackfillWorkout({
        userId: user.id,
        dayKey: "2026-10-18",
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: 22 * 60,
        restSeconds: 0,
        roundsPerSet: 2,
        repeatRounds: 1,
        doneRounds: 1,
      }),
    ).rejects.toThrow("Work should be between 5 and 900.");
    await expect(
      createBackfillWorkout({
        userId: user.id,
        dayKey: "2026-10-17",
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: 4 * 60 * 60 + 1,
        restSeconds: 0,
        roundsPerSet: 1,
        repeatRounds: 1,
        doneRounds: 1,
      }),
    ).rejects.toThrow("That workout is longer than 4 hours.");
  });

  it("stamps today with the save time and keeps a past day at noon", async () => {
    const user = await makeUser("backfill-today-clock@example.com");
    await onboard(user.id);
    const morning = new Date("2026-10-22T15:00:00.000Z");
    const today = dayKey(morning, TZ);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: today,
      kind: "bike",
      resolution: "",
      now: morning,
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
    const todayRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: saved.sessionId } });
    expect(todayRow.performedAt.toISOString()).toBe(morning.toISOString());
    expect((await readWorkoutTimerFields(saved.sessionId, prisma)).finishedAt?.toISOString()).toBe(
      morning.toISOString(),
    );
    const past = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-21",
      kind: "free",
      resolution: "",
      now: morning,
      title: "Easy day",
      notes: "",
      rpe: null,
      durationSeconds: 20 * 60,
    });
    expect(past.ok).toBe(true);
    if (!past.ok) return;
    const pastRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: past.sessionId } });
    expect(pastRow.performedAt.toISOString()).toBe(performedAtForDayKey("2026-10-21", TZ).toISOString());
    const loaded = await getBackfillForEdit(user.id, saved.sessionId, morning);
    const later = new Date("2026-10-22T20:00:00.000Z");
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: saved.sessionId,
      dayKey: today,
      title: todayRow.title,
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: later,
      interval: loaded.structure,
    });
    expect(edited.ok).toBe(true);
    const after = await prisma.workoutSession.findUniqueOrThrow({ where: { id: saved.sessionId } });
    expect(after.performedAt.toISOString()).toBe(morning.toISOString());
  });

  it("stores a multi-set bag total that includes the rest between sets", async () => {
    const user = await makeUser("backfill-bag-block@example.com");
    await onboard(user.id);
    const saved = await bagLog(user.id, "2026-10-20", 180, 3, 2, 120);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const row = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: saved.sessionId },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(row.sets[0]?.prescriptionKey).toBe("round:bag:60:2:120:3");
    expect(roundHistoryLine({ sets: row.sets })).toBe("6 rounds · 3:00 round · 1:00 rest · 24:00 total");
    expect((await readWorkoutTimerFields(saved.sessionId, prisma)).elapsedSeconds).toBe(1440);
  });

  it("keeps a one-round ride's duration when the edit is saved unchanged", async () => {
    const kept = setsForBackfillExercises(
      [
        {
          name: "Assault bike intervals",
          sets: 1,
          done: 1,
          reps: "240:00",
          logMode: "timed_round",
          durationSeconds: 4 * 60 * 60,
        },
      ],
      "lb",
    );
    expect(kept.sets[0]?.durationSeconds).toBe(4 * 60 * 60);
    const shortened = setsForBackfillExercises(
      [
        {
          name: "Assault bike intervals",
          sets: 1,
          done: 1,
          reps: "90:00",
          logMode: "timed_round",
          durationSeconds: 4 * 60 * 60,
        },
      ],
      "lb",
    );
    expect(shortened.sets[0]?.durationSeconds).toBe(90 * 60);
    const fresh = setsForBackfillExercises(
      [{ name: "Hold", sets: 1, done: 1, reps: "240:00", logMode: "timed" }],
      "lb",
    );
    expect(fresh.sets[0]?.durationSeconds).toBe(60 * 60);
    const overCap = setsForBackfillExercises(
      [
        {
          name: "Hold",
          sets: 1,
          done: 1,
          reps: "5:00:00",
          logMode: "timed",
          durationSeconds: 5 * 60 * 60,
        },
      ],
      "lb",
    );
    expect(overCap.sets[0]?.durationSeconds).toBe(5 * 60 * 60);
    expect(() =>
      setsForBackfillExercises(
        [
          {
            name: "Hold",
            sets: 1,
            done: 1,
            reps: "300:00",
            logMode: "timed",
            durationSeconds: 90 * 60,
          },
        ],
        "lb",
      ),
    ).toThrow(/4 hours/);
    expect(() =>
      setsForBackfillExercises(
        [
          {
            name: "Hold",
            sets: 1,
            done: 1,
            reps: "6:00:00",
            logMode: "timed",
            durationSeconds: 4 * 60 * 60,
          },
        ],
        "lb",
      ),
    ).toThrow(/4 hours/);

    const days = backfillDayOptions(NOW, TZ);
    const day = days[1]!;
    const sheetRides = [
      { seconds: 22 * 60, shorthand: "1x22:00/0", clock: "22:00" },
      { seconds: 59 * 60, shorthand: "1x59:00/0", clock: "59:00" },
      { seconds: 3601, shorthand: "1x60:01/0", clock: "1:00:01" },
      { seconds: 4 * 60 * 60, shorthand: "1x240:00/0", clock: "4:00:00" },
    ];
    for (const ride of sheetRides) {
      const seed: BackfillFormSeed = {
        title: `Steady ride · ${ride.clock}`,
        notes: "",
        dayKey: day.key,
        sessionRpe: null,
        exercises: [
          {
            name: "Assault bike intervals",
            sets: 1,
            done: 1,
            reps: ride.shorthand,
            logMode: "timed_round",
            prescriptionKey: `timer#bw:c.${ride.seconds}.0.1.0.0`,
            durationSeconds: ride.seconds,
          },
        ],
      };
      const html = renderToStaticMarkup(
        createElement(LogPastWorkoutButton, {
          entry: "edit",
          sessionId: "sess-steady",
          label: "Edit",
          timeZone: TZ,
          seed,
          defaultOpen: true,
        }),
      );
      expect(html).toContain('name="intervalEdit" value="yes"');
      expect(html).toContain(`value="${ride.shorthand}"`);
      expect(html).toContain(`data-testid="interval-total-time">${ride.clock}`);
      expect(html).toContain(`name="workSeconds" value="${ride.seconds}"`);
      expect(html).not.toContain('data-testid="log-past-workout-exercises"');
    }
    const fourHourPreview: BackfillPreview = {
      dayKey: day.key,
      programs: [],
      saved: [],
      existing: [],
      days: [{ key: day.key, label: day.label }],
      roundTargets: {
        bike: {
          programDayId: "bike-day",
          exerciseName: "Bike",
          plannedRounds: 1,
          daySetCount: 1,
          sets: 1,
          rounds: 1,
          workSeconds: 4 * 60 * 60,
          restSeconds: 0,
          setRestSeconds: 0,
          focusRounds: [],
        },
      },
      lastUsed: {},
      bagRounds: 5,
      units: "lb",
      weightAccess: "gym",
      shadowWeight: null,
    };
    const createHtml = renderToStaticMarkup(
      createElement(LogPastWorkoutButton, {
        dayKey: day.key,
        entry: "calendar",
        label: "Log",
        timeZone: TZ,
        defaultOpen: true,
        initialPreview: fourHourPreview,
      }),
    );
    expect(createHtml).toContain("Save · 1×240:00/0 · 4:00:00");
    expect(createHtml).toContain('data-testid="interval-total-time">4:00:00');
    expect(createHtml).not.toContain("· 1:00:00");
    expect(createHtml).toContain('data-testid="log-past-workout-save" class="font-display');

    const user = await makeUser("backfill-steady-edit@example.com");
    await onboard(user.id);
    const rides = [
      { dayKey: "2026-10-20", seconds: 22 * 60, title: "Steady ride · 22:00", total: "22:00 total" },
      { dayKey: "2026-10-19", seconds: 59 * 60, title: "Steady ride · 59:00", total: "59:00 total" },
      { dayKey: "2026-10-18", seconds: 3601, title: "Steady ride · 1:00:01", total: "1:00:01 total" },
      { dayKey: "2026-10-17", seconds: 4 * 60 * 60, title: "Steady ride · 4:00:00", total: "4:00:00 total" },
    ];
    for (const ride of rides) {
      const saved = await createBackfillWorkout({
        userId: user.id,
        dayKey: ride.dayKey,
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "",
        notes: "",
        rpe: null,
        workSeconds: ride.seconds,
        restSeconds: 0,
        roundsPerSet: 1,
        repeatRounds: 1,
        doneRounds: 1,
      });
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      const before = await prisma.workoutSession.findUniqueOrThrow({
        where: { id: saved.sessionId },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      });
      expect(before.title).toBe(ride.title);
      expect(before.sets).toHaveLength(1);
      expect(before.sets[0]?.durationSeconds).toBe(ride.seconds);
      expect(decodeInterval(before.sets)).toMatchObject({
        kind: "bike",
        sets: 1,
        rounds: 1,
        workSeconds: ride.seconds,
        restSeconds: 0,
        done: 1,
      });
      expect(roundHistoryLine({ sets: before.sets, elapsedSeconds: ride.seconds })).toContain(ride.total);
      expect(roundHistoryLine({ sets: before.sets, elapsedSeconds: ride.seconds })).not.toContain("240:00");
      const loaded = await getBackfillForEdit(user.id, saved.sessionId, NOW);
      expect(loaded.structure).toMatchObject({
        kind: "bike",
        workSeconds: ride.seconds,
        restSeconds: 0,
        sets: 1,
        rounds: 1,
        done: 1,
      });
      const edited = await updateBackfillWorkout({
        userId: user.id,
        sessionId: saved.sessionId,
        dayKey: ride.dayKey,
        title: before.title,
        notes: before.notes ?? "",
        rpe: before.sessionRpe,
        exercises: [],
        confirmed: true,
        resolution: "",
        now: NOW,
        interval: loaded.structure,
      });
      expect(edited.ok).toBe(true);
      if (!edited.ok) return;
      const after = await prisma.workoutSession.findUniqueOrThrow({
        where: { id: saved.sessionId },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      });
      expect(after.sets[0]?.id).toBe(before.sets[0]?.id);
      expect(after.sets[0]?.durationSeconds).toBe(ride.seconds);
      expect(after.status).toBe(before.status);
      expect(after.performedAt.toISOString()).toBe(before.performedAt.toISOString());
      expect((await readWorkoutTimerFields(saved.sessionId, prisma)).elapsedSeconds).toBe(ride.seconds);
    }
  });

  it("finishes a draft left by undo when history saves the ride", async () => {
    const user = await makeUser("backfill-undo-edit@example.com");
    await onboard(user.id);
    const saved = await createBackfillWorkout({
      userId: user.id,
      dayKey: "2026-10-20",
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "Steady ride · 25:00",
      notes: "",
      rpe: null,
      workSeconds: 25 * 60,
      restSeconds: 0,
      roundsPerSet: 1,
      repeatRounds: 1,
      doneRounds: 1,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const reopened = await reopenCompletedWorkoutForUser(user.id, saved.sessionId);
    expect(reopened.status).toBe("draft");
    const loaded = await getBackfillForEdit(user.id, saved.sessionId, NOW);
    expect(loaded.structure).toMatchObject({ kind: "bike", rounds: 1, done: 1, workSeconds: 25 * 60 });
    const edited = await updateBackfillWorkout({
      userId: user.id,
      sessionId: saved.sessionId,
      dayKey: "2026-10-20",
      title: "Morning spin",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: loaded.structure,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.status).toBe("complete");
    const after = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: saved.sessionId },
      include: { sets: true },
    });
    expect(after.title).toBe("Morning spin");
    expect(after.status).toBe("complete");
    expect(sessionOpensFinishScreen(after)).toBe(true);
    expect(after.sets).toHaveLength(1);
    const clock = await readWorkoutTimerFields(saved.sessionId, prisma);
    expect(clock.timerStartedAt).toBeNull();
    expect(clock.finishedAt).not.toBeNull();
  });

  it("counts a finished ride's new round count as complete", async () => {
    const user = await makeUser("backfill-expand-rounds@example.com");
    await onboard(user.id);
    async function steady(dayKey: string) {
      const saved = await createBackfillWorkout({
        userId: user.id,
        dayKey,
        kind: "bike",
        resolution: "",
        now: NOW,
        title: "Steady ride · 25:00",
        notes: "",
        rpe: null,
        workSeconds: 25 * 60,
        restSeconds: 0,
        roundsPerSet: 1,
        repeatRounds: 1,
        doneRounds: 1,
      });
      expect(saved.ok).toBe(true);
      if (!saved.ok) throw new Error("steady ride did not save");
      return saved.sessionId;
    }
    const thirtyOne = await steady("2026-10-20");
    const expanded = await updateBackfillWorkout({
      userId: user.id,
      sessionId: thirtyOne,
      dayKey: "2026-10-20",
      title: "Steady ride · 25:00",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 1,
        rounds: 31,
        workSeconds: 20,
        restSeconds: 10,
        setRestSeconds: 0,
        done: 1,
      },
    });
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    expect(expanded.status).toBe("complete");
    const after31 = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: thirtyOne },
      include: { sets: true },
    });
    expect(after31.status).toBe("complete");
    expect(after31.sets).toHaveLength(31);
    expect(historyCountLine(after31)).toBe("31/31 rounds · Done");

    const reopenedId = await steady("2026-10-19");
    await reopenCompletedWorkoutForUser(user.id, reopenedId);
    const fromDraft = await updateBackfillWorkout({
      userId: user.id,
      sessionId: reopenedId,
      dayKey: "2026-10-19",
      title: "Steady ride · 25:00",
      notes: "",
      rpe: null,
      exercises: [],
      confirmed: true,
      resolution: "",
      now: NOW,
      interval: {
        kind: "bike",
        sets: 1,
        rounds: 40,
        workSeconds: 15,
        restSeconds: 15,
        setRestSeconds: 0,
        done: 1,
      },
    });
    expect(fromDraft.ok).toBe(true);
    if (!fromDraft.ok) return;
    expect(fromDraft.status).toBe("complete");
    const after40 = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: reopenedId },
      include: { sets: true },
    });
    expect(after40.sets).toHaveLength(40);
    expect(historyCountLine(after40)).toBe("40/40 rounds · Done");
    expect(historyCountLine(after40)).not.toContain("Partial");
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
