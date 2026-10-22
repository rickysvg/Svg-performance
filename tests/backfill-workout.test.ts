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
  updateBackfillWorkout,
} from "@/lib/backfill-workout";
import { completionListLabel } from "@/lib/logged-work";
import { getCalendarSchedule } from "@/lib/calendar";
import { completedLocalDayKeys, listWorkoutSessionsForUser } from "@/lib/workouts";
import { formatDayParam, getWeeklyActivity } from "@/lib/home";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { sessionCompletionDay } from "@/lib/performed-at";
import { addZonedDays, dayKey, startOfZonedDay } from "@/lib/timezone";

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
    expect(wednesday?.activities.some((item) => item.subtitle.startsWith("Partial"))).toBe(true);
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
    await deleteBackfillWorkout({ userId: user.id, sessionId: saved.sessionId, confirmed: true });
    expect(await prisma.workoutSession.findUnique({ where: { id: saved.sessionId } })).toBeNull();
  });
});
