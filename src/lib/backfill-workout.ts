import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { BIKE_TIMER_EXERCISE } from "@/lib/bike-timer-log";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { memberFacingTitle } from "@/lib/member-copy";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { sessionCompletionDay } from "@/lib/performed-at";
import { sessionHasLoggedWork } from "@/lib/logged-work";
import { easePlanForUser } from "@/lib/recovery-ease";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { planForDate, planWeekIndex, resolvePlanSessions } from "@/lib/week-plan";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { listSavedWorkouts, getSavedWorkoutForUser } from "@/lib/my-workouts";
import { workoutTimerColumnsAvailable } from "@/lib/workout-timer-columns";
import { SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import type { LoadUnit } from "@/lib/units";
import {
  BACKFILL_MAX_SET_SECONDS,
  BACKFILL_ROUND_MODES,
  BACKFILL_SOURCE,
  assertBackfillDay,
  assertSaneDurationSeconds,
  assertSaneSetSeconds,
  backfillCompletionStatus,
  backfillDayOptions,
  backfillDayState,
  isBackfillKind,
  isBackfillRoundMode,
  notesWithBikeMetrics,
  parseOptionalCalories,
  parseOptionalDistance,
  parseOptionalRpe,
  performedAtForDayKey,
  setsForBackfillExercises,
  type BackfillExerciseInput,
  type BackfillKind,
  type BackfillSetDraft,
} from "@/lib/backfill-rules";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

export type BackfillExisting = {
  id: string;
  title: string;
  status: string;
};

export type BackfillProgramOption = {
  programDayId: string;
  programSlug: string;
  dayNumber: number;
  title: string;
  exercises: BackfillExerciseInput[];
};

export type BackfillPreview = {
  dayKey: string;
  programs: BackfillProgramOption[];
  saved: { id: string; name: string; exercises: BackfillExerciseInput[] }[];
  existing: BackfillExisting[];
  days: { key: string; label: string }[];
};

export type BackfillWriteResult =
  | { ok: true; sessionId: string; status: "complete" | "partial" }
  | { ok: false; conflict: BackfillExisting[] };

type BackfillPayload = {
  userId: string;
  dayKey: string;
  kind: BackfillKind;
  resolution: "" | "extra" | "replace";
  now?: Date;
  title: string;
  notes: string;
  rpe: number | null;
  programDayId?: string | null;
  savedWorkoutId?: string | null;
  exercises?: BackfillExerciseInput[];
  durationSeconds?: number | null;
  plannedRounds?: number | null;
  doneRounds?: number | null;
  roundMode?: string | null;
  workSeconds?: number | null;
  calories?: number | null;
  distance?: number | null;
};

function cleanTitle(value: string, fallback: string) {
  const title = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return title || fallback;
}

async function memberZone(userId: string) {
  const profile = await getProfileForUser(userId);
  const timeZone = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const units: LoadUnit = profile?.preferredUnits === "kg" ? "kg" : "lb";
  return { profile, timeZone, units };
}

export async function sessionsOnCivilDay(userId: string, day: string, timeZone: string) {
  const when = performedAtForDayKey(day, timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      performedAt: {
        gte: new Date(when.getTime() - DAY_PAD_MS),
        lt: new Date(when.getTime() + DAY_PAD_MS),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      performedAt: true,
      sets: {
        select: { reps: true, loadValue: true, durationSeconds: true, completed: true },
      },
    },
    orderBy: { performedAt: "asc" },
  });
  return rows.filter((row) => {
    if (sessionCompletionDay(row, timeZone) !== day) return false;
    if (row.status === "draft" && !sessionHasLoggedWork(row.sets)) return false;
    if (row.status === "draft") return false;
    return row.status === "complete" || row.status === "partial" || sessionHasLoggedWork(row.sets);
  });
}

async function programOptionsForDay(userId: string, when: Date, timeZone: string): Promise<BackfillProgramOption[]> {
  const [profile, swaps, catalog, account] = await Promise.all([
    getProfileForUser(userId),
    getWeekPlanSwapsForUser(userId),
    findDemoTrainingCatalog(),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const camp = await getActiveCampSnapshot(userId, when, timeZone);
  const campWeek = campPlanWeekIndex(camp);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
    forcedWeekIndex: campWeek,
  };
  const built = planForDate(prefs, when, timeZone, swaps);
  const shaped =
    camp && camp.phase !== "complete" && camp.phase !== "pre-camp" ? shapeDayPlan(built, camp.phase) : built;
  const eased = await easePlanForUser(userId, when, timeZone, shaped);
  const scaled = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    weekIndex: campWeek ?? planWeekIndex(when, timeZone, profile?.onboardingCompletedAt ?? null),
    campPhase: camp && camp.phase !== "complete" ? camp.phase : null,
  });
  const resolved = resolvePlanSessions(eased.plan, scaled).filter((session) => session.dayId && session.kind !== "rest");
  const ids = resolved.map((session) => session.dayId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const days = await prisma.programDay.findMany({
    where: { id: { in: ids } },
    include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } },
  });
  const byId = new Map(days.map((day) => [day.id, day]));
  return resolved.flatMap((session) => {
    const day = session.dayId ? byId.get(session.dayId) : undefined;
    if (!day || day.exercises.length === 0) return [];
    return [
      {
        programDayId: day.id,
        programSlug: day.program.slug,
        dayNumber: day.dayNumber,
        title: memberFacingTitle(session.title || day.title),
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          sets: Math.max(1, exercise.sets),
          done: Math.max(1, exercise.sets),
          reps: exercise.reps,
          logMode: exercise.logMode,
        })),
      },
    ];
  });
}

export async function previewBackfillDay(userId: string, day: string, now = new Date()): Promise<BackfillPreview> {
  const { timeZone } = await memberZone(userId);
  const options = backfillDayOptions(now, timeZone);
  const key = day.trim() || options[0]?.key || "";
  assertBackfillDay(key, now, timeZone);
  const when = performedAtForDayKey(key, timeZone);
  const [programs, savedRows, existing] = await Promise.all([
    programOptionsForDay(userId, when, timeZone),
    listSavedWorkouts(userId),
    sessionsOnCivilDay(userId, key, timeZone),
  ]);
  const saved = await Promise.all(
    savedRows.slice(0, 20).map(async (row) => {
      const full = await getSavedWorkoutForUser(row.id, userId);
      return {
        id: full.id,
        name: full.name,
        exercises: full.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          done: exercise.sets,
          reps: exercise.reps,
          logMode: exercise.logMode,
        })),
      };
    }),
  );
  return {
    dayKey: key,
    programs,
    saved,
    existing: existing.map((row) => ({
      id: row.id,
      title: memberFacingTitle(row.title) || row.title,
      status: row.status,
    })),
    days: backfillDayOptions(now, timeZone),
  };
}

function toCreate(sets: BackfillSetDraft[]) {
  return sets.map((set, index) => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    sortOrder: index,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey.slice(0, 160),
  }));
}

async function writeElapsed(sessionId: string, seconds: number, performedAt: Date) {
  if (!(await workoutTimerColumnsAvailable(prisma))) return;
  const elapsedSeconds = Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(1, Math.round(seconds)));
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { elapsedSeconds, finishedAt: performedAt, timerStartedAt: null },
  });
}

async function persistBackfill(input: {
  userId: string;
  dayKey: string;
  timeZone: string;
  title: string;
  notes: string;
  rpe: number | null;
  programDayId: string | null;
  savedWorkoutId: string | null;
  sets: BackfillSetDraft[];
  plannedSetCount: number;
  plannedNames: string[];
  elapsedSeconds?: number | null;
  resolution: "" | "extra" | "replace";
}) {
  const existing = await sessionsOnCivilDay(input.userId, input.dayKey, input.timeZone);
  if (existing.length > 0 && input.resolution !== "extra" && input.resolution !== "replace") {
    return {
      ok: false as const,
      conflict: existing.map((row) => ({
        id: row.id,
        title: memberFacingTitle(row.title) || row.title,
        status: row.status,
      })),
    };
  }
  if (input.resolution === "replace" && existing.length > 0) {
    await prisma.workoutSession.deleteMany({
      where: { userId: input.userId, id: { in: existing.map((row) => row.id) } },
    });
  }
  const status = backfillCompletionStatus({
    sets: input.sets,
    plannedSetCount: input.plannedSetCount,
    plannedNames: input.plannedNames,
  });
  const performedAt = performedAtForDayKey(input.dayKey, input.timeZone);
  const created = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      programDayId: input.programDayId,
      savedWorkoutId: input.savedWorkoutId,
      title: input.title,
      performedAt,
      notes: input.notes,
      status,
      plannedSetCount: input.plannedSetCount,
      sessionRpe: input.rpe,
      source: BACKFILL_SOURCE,
      backfilled: true,
      sets: { create: toCreate(input.sets) },
    },
  });
  if (input.elapsedSeconds && input.elapsedSeconds > 0) {
    await writeElapsed(created.id, input.elapsedSeconds, performedAt);
  }
  if (status === "complete") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return { ok: true as const, sessionId: created.id, status };
}

function exercisePayload(exercises: BackfillExerciseInput[], unit: LoadUnit, keyFor?: (exercise: BackfillExerciseInput) => string) {
  return setsForBackfillExercises(exercises, unit, keyFor);
}

async function payloadFromKind(input: BackfillPayload, unit: LoadUnit) {
  if (input.kind === "program") {
    const programDayId = input.programDayId ?? "";
    const day = await prisma.programDay.findUnique({
      where: { id: programDayId },
      include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } },
    });
    if (!day) throw new AppError("WORKOUT", "That program session is not on this day.");
    const byName = new Map((input.exercises ?? []).map((row) => [row.name.trim().toLowerCase(), row]));
    const exercises = day.exercises.map((exercise) => {
      const posted = byName.get(exercise.name.trim().toLowerCase());
      const planned = Math.max(1, exercise.sets);
      return {
        name: exercise.name,
        sets: planned,
        done: posted ? posted.done : planned,
        reps: exercise.reps,
        logMode: exercise.logMode,
      };
    });
    const built = exercisePayload(exercises, unit, (exercise) =>
      prescriptionSlotKey({
        exerciseName: exercise.name,
        reps: exercise.reps,
        programSlug: day.program.slug,
        dayNumber: day.dayNumber,
      }),
    );
    return {
      title: cleanTitle(input.title, memberFacingTitle(day.title) || "Workout"),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: day.id,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: null as number | null,
    };
  }

  if (input.kind === "saved") {
    const saved = await getSavedWorkoutForUser(input.savedWorkoutId ?? "", input.userId);
    const byName = new Map((input.exercises ?? []).map((row) => [row.name.trim().toLowerCase(), row]));
    const exercises = saved.exercises.map((exercise) => {
      const posted = byName.get(exercise.name.trim().toLowerCase());
      return {
        name: exercise.name,
        sets: exercise.sets,
        done: posted ? posted.done : exercise.sets,
        reps: exercise.reps,
        logMode: exercise.logMode,
      };
    });
    const built = exercisePayload(exercises, unit);
    return {
      title: cleanTitle(input.title, saved.name),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: saved.id,
      ...built,
      elapsedSeconds: null as number | null,
    };
  }

  if (input.kind === "custom") {
    const built = exercisePayload(input.exercises ?? [], unit);
    return {
      title: cleanTitle(input.title, "Custom workout"),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: null as number | null,
    };
  }

  if (input.kind === "bike") {
    const durationSeconds = Math.round(input.durationSeconds ?? 0);
    assertSaneDurationSeconds(durationSeconds, "Bike time");
    const plannedRounds = Math.round(input.plannedRounds ?? 0);
    const doneRounds = Math.round(input.doneRounds ?? plannedRounds);
    if (!Number.isInteger(plannedRounds) || plannedRounds < 1 || plannedRounds > 50) {
      throw new AppError("WORKOUT", "Rounds should be between 1 and 50.");
    }
    if (!Number.isInteger(doneRounds) || doneRounds < 0 || doneRounds > plannedRounds) {
      throw new AppError("WORKOUT", "Finished rounds cannot be more than the workout.");
    }
    const perRound = Math.min(
      BACKFILL_MAX_SET_SECONDS,
      Math.max(1, Math.round(durationSeconds / plannedRounds)),
    );
    const exercises: BackfillExerciseInput[] = [
      {
        name: BIKE_TIMER_EXERCISE,
        sets: plannedRounds,
        done: doneRounds,
        reps: `${perRound}`,
        logMode: "timed_round",
      },
    ];
    const built = setsForBackfillExercises(exercises, unit, () => `backfill|bike|${choiceTokenLengthSafe(perRound)}`);
    for (const set of built.sets) {
      if (set.completed) set.durationSeconds = perRound;
    }
    return {
      title: cleanTitle(input.title, "Assault bike"),
      notes: notesWithBikeMetrics(input.notes, input.calories ?? null, input.distance ?? null),
      programDayId: null,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: durationSeconds,
    };
  }

  if (input.kind === "rounds") {
    const roundMode = input.roundMode ?? "";
    if (!isBackfillRoundMode(roundMode)) {
      throw new AppError("WORKOUT", "Pick bag, pads, sparring, or grappling.");
    }
    const workSeconds = Math.round(input.workSeconds ?? 180);
    assertSaneSetSeconds(workSeconds, "Round length");
    const plannedRounds = Math.round(input.plannedRounds ?? 0);
    const doneRounds = Math.round(input.doneRounds ?? plannedRounds);
    if (!Number.isInteger(plannedRounds) || plannedRounds < 1 || plannedRounds > 20) {
      throw new AppError("WORKOUT", "Rounds should be between 1 and 20.");
    }
    if (!Number.isInteger(doneRounds) || doneRounds < 0 || doneRounds > plannedRounds) {
      throw new AppError("WORKOUT", "Finished rounds cannot be more than the workout.");
    }
    const name = BACKFILL_ROUND_MODES[roundMode];
    const built = setsForBackfillExercises(
      [{ name, sets: plannedRounds, done: doneRounds, reps: String(workSeconds), logMode: "timed_round" }],
      unit,
    );
    for (const set of built.sets) {
      if (set.completed) set.durationSeconds = workSeconds;
    }
    return {
      title: cleanTitle(input.title, name),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: workSeconds * doneRounds,
    };
  }

  const durationSeconds = Math.round(input.durationSeconds ?? 0);
  assertSaneDurationSeconds(durationSeconds, "Duration");
  const name = cleanTitle(input.title, "Workout");
  const perSet = Math.min(BACKFILL_MAX_SET_SECONDS, durationSeconds);
  const built = setsForBackfillExercises(
    [{ name, sets: 1, done: 1, reps: String(perSet), logMode: "timed" }],
    unit,
  );
  for (const set of built.sets) set.durationSeconds = perSet;
  return {
    title: name,
    notes: input.notes.trim().slice(0, 1000),
    programDayId: null,
    savedWorkoutId: null,
    ...built,
    elapsedSeconds: durationSeconds,
  };
}

function choiceTokenLengthSafe(seconds: number) {
  return `t${seconds}`;
}

export async function createBackfillWorkout(input: BackfillPayload): Promise<BackfillWriteResult> {
  if (!isBackfillKind(input.kind)) throw new AppError("WORKOUT", "Pick a workout type.");
  const { timeZone, units } = await memberZone(input.userId);
  const now = input.now ?? new Date();
  assertBackfillDay(input.dayKey, now, timeZone);
  const built = await payloadFromKind(input, units);
  return persistBackfill({
    userId: input.userId,
    dayKey: input.dayKey,
    timeZone,
    title: built.title,
    notes: built.notes,
    rpe: input.rpe,
    programDayId: built.programDayId,
    savedWorkoutId: built.savedWorkoutId,
    sets: built.sets,
    plannedSetCount: built.plannedSetCount,
    plannedNames: built.plannedNames,
    elapsedSeconds: built.elapsedSeconds,
    resolution: input.resolution,
  });
}

export async function getBackfillForEdit(userId: string, sessionId: string, now = new Date()) {
  const { timeZone } = await memberZone(userId);
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session || session.userId !== userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be edited here.");
  const key = sessionCompletionDay(session, timeZone);
  const groups = new Map<string, { planned: number; done: number; logMode: string }>();
  for (const set of session.sets) {
    const current = groups.get(set.exerciseName) ?? { planned: 0, done: 0, logMode: set.logMode };
    current.planned += 1;
    if (set.completed && (set.reps != null || set.loadValue != null || (set.durationSeconds ?? 0) > 0)) {
      current.done += 1;
    }
    groups.set(set.exerciseName, current);
  }
  return {
    id: session.id,
    title: session.title,
    notes: session.notes,
    dayKey: backfillDayState(key, now, timeZone) === "ok" ? key : backfillDayOptions(now, timeZone)[0]?.key ?? key,
    originalDayKey: key,
    status: session.status,
    sessionRpe: session.sessionRpe,
    exercises: [...groups.entries()].map(([name, row]) => ({
      name,
      sets: row.planned,
      done: row.done,
      logMode: row.logMode,
      reps: "",
    })),
    days: backfillDayOptions(now, timeZone),
    existing: (await sessionsOnCivilDay(userId, key, timeZone))
      .filter((row) => row.id !== session.id)
      .map((row) => ({ id: row.id, title: memberFacingTitle(row.title) || row.title, status: row.status })),
  };
}

export async function updateBackfillWorkout(input: {
  userId: string;
  sessionId: string;
  dayKey: string;
  title: string;
  notes: string;
  rpe: number | null;
  exercises: BackfillExerciseInput[];
  confirmed: boolean;
  resolution: "" | "extra" | "replace";
  now?: Date;
}): Promise<BackfillWriteResult> {
  if (!input.confirmed) throw new AppError("WORKOUT", "Confirm before saving this change.");
  const { timeZone, units } = await memberZone(input.userId);
  const now = input.now ?? new Date();
  assertBackfillDay(input.dayKey, now, timeZone);
  const session = await prisma.workoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.userId !== input.userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be edited here.");
  const others = (await sessionsOnCivilDay(input.userId, input.dayKey, timeZone)).filter((row) => row.id !== session.id);
  if (others.length > 0 && input.resolution !== "extra" && input.resolution !== "replace") {
    return {
      ok: false,
      conflict: others.map((row) => ({
        id: row.id,
        title: memberFacingTitle(row.title) || row.title,
        status: row.status,
      })),
    };
  }
  if (input.resolution === "replace" && others.length > 0) {
    await prisma.workoutSession.deleteMany({
      where: { userId: input.userId, id: { in: others.map((row) => row.id) } },
    });
  }
  const built = setsForBackfillExercises(input.exercises, units);
  const status = backfillCompletionStatus({
    sets: built.sets,
    plannedSetCount: built.plannedSetCount,
    plannedNames: built.plannedNames,
  });
  const performedAt = performedAtForDayKey(input.dayKey, timeZone);
  await prisma.$transaction([
    prisma.workoutSet.deleteMany({ where: { workoutSessionId: session.id } }),
    prisma.workoutSession.update({
      where: { id: session.id },
      data: {
        title: cleanTitle(input.title, session.title),
        notes: input.notes.trim().slice(0, 1000),
        performedAt,
        status,
        plannedSetCount: built.plannedSetCount,
        sessionRpe: input.rpe,
        source: BACKFILL_SOURCE,
        backfilled: true,
        sets: { create: toCreate(built.sets) },
      },
    }),
  ]);
  return { ok: true, sessionId: session.id, status };
}

export async function deleteBackfillWorkout(input: { userId: string; sessionId: string; confirmed: boolean }) {
  if (!input.confirmed) throw new AppError("WORKOUT", "Confirm before deleting this workout.");
  const session = await prisma.workoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.userId !== input.userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be deleted here.");
  await prisma.workoutSession.delete({ where: { id: session.id } });
}

export function readBackfillForm(formData: FormData, userId: string, now = new Date()): BackfillPayload {
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isBackfillKind(kindRaw)) throw new AppError("WORKOUT", "Pick a workout type.");
  const resolutionRaw = String(formData.get("resolution") ?? "");
  const resolution = resolutionRaw === "extra" || resolutionRaw === "replace" ? resolutionRaw : "";
  const count = Number(formData.get("exerciseCount") ?? 0);
  const exercises: BackfillExerciseInput[] = [];
  const total = Number.isFinite(count) ? Math.min(12, Math.max(0, Math.round(count))) : 0;
  for (let index = 0; index < total; index += 1) {
    exercises.push({
      name: String(formData.get(`exerciseName_${index}`) ?? ""),
      sets: Number(formData.get(`exerciseSets_${index}`) ?? 0),
      done: Number(formData.get(`exerciseDone_${index}`) ?? 0),
      reps: String(formData.get(`exerciseReps_${index}`) ?? ""),
      logMode: String(formData.get(`exerciseMode_${index}`) ?? ""),
    });
  }
  const minutes = Number(formData.get("minutes") ?? "");
  const durationSeconds = Number.isFinite(minutes) && String(formData.get("minutes") ?? "").trim() !== ""
    ? Math.round(minutes * 60)
    : null;
  return {
    userId,
    dayKey: String(formData.get("dayKey") ?? ""),
    kind: kindRaw,
    resolution,
    now,
    title: String(formData.get("title") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    rpe: parseOptionalRpe(String(formData.get("rpe") ?? "")),
    programDayId: String(formData.get("programDayId") ?? "") || null,
    savedWorkoutId: String(formData.get("savedWorkoutId") ?? "") || null,
    exercises,
    durationSeconds,
    plannedRounds: numberOrNull(formData.get("plannedRounds")),
    doneRounds: numberOrNull(formData.get("doneRounds")),
    roundMode: String(formData.get("roundMode") ?? ""),
    workSeconds: numberOrNull(formData.get("workSeconds")),
    calories: parseOptionalCalories(String(formData.get("calories") ?? "")),
    distance: parseOptionalDistance(String(formData.get("distance") ?? "")),
  };
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function backfillDaysForKeys(keys: string[], now: Date, timeZone: string) {
  return keys.filter((key) => backfillDayState(key, now, timeZone) === "ok");
}
