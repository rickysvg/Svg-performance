import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  clearBackfillWriteFault,
  createBackfillWorkout,
  deleteBackfillWorkout,
  faultNextBackfillWrite,
  previewBackfillDay,
  backfillFormSeed,
  updateBackfillWorkout,
  type BackfillFormSeed,
} from "@/lib/backfill-workout";
import { completionListLabel, exerciseSetProgress, historyCountLine } from "@/lib/logged-work";
import { roundHistoryLine } from "@/lib/round-session";
import { getCalendarSchedule, subtitleShowsPartial } from "@/lib/calendar";
import { completedLocalDayKeys, listWorkoutSessionsForUser } from "@/lib/workouts";
import { formatDayParam, getWeeklyActivity } from "@/lib/home";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { sessionCompletionDay } from "@/lib/performed-at";
import { backfillDayOptions } from "@/lib/backfill-rules";
import { addZonedDays, dayKey, startOfZonedDay } from "@/lib/timezone";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
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

  afterAll(async () => {
    await prisma.$disconnect();
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
    expect(wednesday?.activities.some((item) => item.kind === "workout" && item.status === "complete")).toBe(true);
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
    await expect(freeLog(nz.id, "2026-10-23", "Today", nzNow)).rejects.toThrow(/yesterday/i);
    await expect(freeLog(nz.id, "2026-10-24", "Ahead", nzNow)).rejects.toThrow(/future/i);
    const nzSaved = await freeLog(nz.id, "2026-10-22", "East coast", nzNow);
    expect(nzSaved.ok).toBe(true);
    if (!nzSaved.ok) return;
    const nzRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: nzSaved.sessionId } });
    expect(sessionCompletionDay(nzRow, "Pacific/Auckland")).toBe("2026-10-22");
  });

  it("rejects today, the future, dates older than 30 days, and absurd durations", async () => {
    const user = await makeUser("backfill-window@example.com");
    await onboard(user.id);
    const today = dayKey(NOW, TZ);
    const future = dayKey(addZonedDays(startOfZonedDay(NOW, TZ), 1, TZ), TZ);
    const old = dayKey(addZonedDays(startOfZonedDay(NOW, TZ), -31, TZ), TZ);
    await expect(freeLog(user.id, today, "Today")).rejects.toThrow(/yesterday/i);
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
      durationSeconds: 20 * 60,
      plannedRounds: 8,
      doneRounds: 8,
    });
    expect(bike.ok).toBe(true);
    if (bike.ok) {
      const row = await prisma.workoutSession.findUnique({
        where: { id: bike.sessionId },
        include: { sets: true },
      });
      expect(roundHistoryLine(row!)).toBe("8 rounds · 2:30 round · 0:00 rest · 20:00 total");
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
    expect(createHtml).toContain(sample!.key);
    expect(createHtml).toContain(sample!.label);
    expect(createHtml.split("<option").length).toBeGreaterThan(2);

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
    expect(pushUp).toBe("1/4 sets · partial");
    const bikeRows = exerciseSetProgress(
      [{ name: "Assault bike alactic", sets: 1 }],
      [{ exerciseName: "Assault bike intervals", completed: true, reps: null, loadValue: null, durationSeconds: 20 }],
    );
    expect(bikeRows).toEqual([
      { name: "Assault bike alactic", ticked: 1, planned: 1, state: "complete" },
    ]);
  });
});
