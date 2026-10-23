import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { bikeTimerLogSets, bikeTimerSessionSeconds, BIKE_TIMER_EXERCISE } from "@/lib/bike-timer-log";
import { bikeTimerRoundCount } from "@/lib/bike-chooser";
import {
  bikeBackfillChoice,
  bikeBackfillSpecFromExercises,
  type BikeBackfillSpec,
} from "@/lib/bike-backfill";
import { roundLogSets, roundPrescriptionKey, roundSessionDuration, type RoundSessionType } from "@/lib/round-session";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { memberFacingTitle } from "@/lib/member-copy";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { sessionCompletionDay } from "@/lib/performed-at";
import { formatClock, isDurationMode, resolveLogMode } from "@/lib/exercise-log-mode";
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
  /** Assault bike prescription on the chosen day, when the plan has one. */
  bike: BikeBackfillSpec | null;
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
  restSeconds?: number | null;
  roundsPerSet?: number | null;
  bikeSets?: number | null;
  restBetweenSets?: number | null;
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

async function programOptionsForDay(
  userId: string,
  when: Date,
  timeZone: string,
): Promise<{ programs: BackfillProgramOption[]; bike: BikeBackfillSpec | null }> {
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
  if (ids.length === 0) return { programs: [], bike: null };
  const days = await prisma.programDay.findMany({
    where: { id: { in: ids } },
    include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } },
  });
  const byId = new Map(days.map((day) => [day.id, day]));
  let bike: BikeBackfillSpec | null = null;
  for (const session of resolved) {
    const exercises = (session.day?.exercises ?? []) as {
      name?: string;
      sets?: number;
      reps?: string;
      restSeconds?: number;
    }[];
    bike = bikeBackfillSpecFromExercises(exercises);
    if (bike) break;
  }
  const programs = resolved.flatMap((session) => {
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
          restSeconds: exercise.restSeconds,
        })),
      },
    ];
  });
  if (!bike) bike = bikeBackfillSpecFromExercises(programs.flatMap((program) => program.exercises));
  return { programs, bike };
}

export async function previewBackfillDay(userId: string, day: string, now = new Date()): Promise<BackfillPreview> {
  const { timeZone } = await memberZone(userId);
  const options = backfillDayOptions(now, timeZone);
  const key = day.trim() || options[0]?.key || "";
  assertBackfillDay(key, now, timeZone);
  const when = performedAtForDayKey(key, timeZone);
  const [programDay, savedRows, existing] = await Promise.all([
    programOptionsForDay(userId, when, timeZone),
    listSavedWorkouts(userId),
    sessionsOnCivilDay(userId, key, timeZone),
  ]);
  const programs = programDay.programs;
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
    bike: programDay.bike,
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

/**
 * One-shot seam so a test can throw after the replace delete and before the
 * write. Production leaves it unset. The throw has to happen inside the
 * transaction or the delete would already be committed.
 */
let backfillWriteFault: (() => void) | null = null;

export function faultNextBackfillWrite(fault: () => void) {
  backfillWriteFault = fault;
}

export function clearBackfillWriteFault() {
  backfillWriteFault = null;
}

function throwIfBackfillWriteFault() {
  const fault = backfillWriteFault;
  backfillWriteFault = null;
  if (fault) fault();
}

async function writeElapsedOn(
  db: { workoutSession: { update: typeof prisma.workoutSession.update } },
  sessionId: string,
  seconds: number,
  performedAt: Date,
) {
  const elapsedSeconds = Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(1, Math.round(seconds)));
  await db.workoutSession.update({
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
  const status = backfillCompletionStatus({
    sets: input.sets,
    plannedSetCount: input.plannedSetCount,
    plannedNames: input.plannedNames,
  });
  const performedAt = performedAtForDayKey(input.dayKey, input.timeZone);
  const replacing = input.resolution === "replace" && existing.length > 0;
  const timerReady = await workoutTimerColumnsAvailable(prisma);
  const created = await prisma.$transaction(async (tx) => {
    if (replacing) {
      await tx.workoutSession.deleteMany({
        where: { userId: input.userId, id: { in: existing.map((row) => row.id) } },
      });
      throwIfBackfillWriteFault();
    }
    const row = await tx.workoutSession.create({
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
    if (timerReady && input.elapsedSeconds && input.elapsedSeconds > 0) {
      await writeElapsedOn(tx, row.id, input.elapsedSeconds, performedAt);
    }
    return row;
  });
  if (status === "complete") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return { ok: true as const, sessionId: created.id, status };
}

function exercisePayload(exercises: BackfillExerciseInput[], unit: LoadUnit, keyFor?: (exercise: BackfillExerciseInput) => string) {
  return setsForBackfillExercises(exercises, unit, keyFor);
}

function roundBackfillSets(input: {
  type: RoundSessionType;
  exerciseName: string;
  plannedRounds: number;
  doneRounds: number;
  workSeconds: number;
  restSeconds: number;
  unit: LoadUnit;
}): { sets: BackfillSetDraft[]; plannedSetCount: number; plannedNames: string[] } {
  const done = roundLogSets({
    type: input.type,
    exerciseName: input.exerciseName,
    rounds: input.doneRounds,
    workSeconds: input.workSeconds,
    restSeconds: input.restSeconds,
    unit: input.unit,
  });
  const key = roundPrescriptionKey(input.type, input.restSeconds);
  const sets: BackfillSetDraft[] = done.map((set) => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: null,
    loadValue: null,
    loadUnit: input.unit,
    logMode: "timed_round",
    durationSeconds: set.durationSeconds ?? null,
    completed: true,
    notes: set.notes ?? "",
    prescriptionKey: set.prescriptionKey ?? key,
  }));
  for (let index = sets.length; index < input.plannedRounds; index += 1) {
    sets.push({
      exerciseName: input.exerciseName,
      setNumber: index + 1,
      reps: null,
      loadValue: null,
      loadUnit: input.unit,
      logMode: "timed_round",
      durationSeconds: null,
      completed: false,
      notes: "",
      prescriptionKey: key,
    });
  }
  return { sets, plannedSetCount: input.plannedRounds, plannedNames: [input.exerciseName] };
}

function assertRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError("WORKOUT", `${label} should be from ${min} to ${max}.`);
  }
}

/** Past bike intervals use the live timer's choice key, work-only set length, and round total. */
function bikeIntervalPayload(input: BackfillPayload, unit: LoadUnit) {
  const workSeconds = Math.round(input.workSeconds ?? Number.NaN);
  const restSeconds = Math.round(input.restSeconds ?? Number.NaN);
  const roundsPerSet = Math.round(input.roundsPerSet ?? Number.NaN);
  const sets = Math.round(input.bikeSets ?? Number.NaN);
  const restBetweenSets = input.restBetweenSets == null ? 0 : Math.round(input.restBetweenSets);
  assertRange(workSeconds, 5, 120, "Work");
  assertRange(restSeconds, 5, 180, "Rest");
  assertRange(roundsPerSet, 1, 30, "Rounds per set");
  assertRange(sets, 1, 10, "Sets");
  assertRange(restBetweenSets, 0, 600, "Rest between sets");
  const choice = bikeBackfillChoice({
    workSeconds,
    restSeconds,
    roundsPerSet,
    sets,
    restBetweenSetsSeconds: restBetweenSets,
  });
  if (!choice) throw new AppError("WORKOUT", "That bike interval cannot be saved.");
  const plannedRounds = bikeTimerRoundCount(choice);
  const doneRounds = Math.round(input.doneRounds ?? plannedRounds);
  if (!Number.isInteger(doneRounds) || doneRounds < 1 || doneRounds > plannedRounds) {
    throw new AppError("WORKOUT", "Finished rounds cannot be more than the workout.");
  }
  const setsWritten = bikeTimerLogSets(choice, unit, doneRounds).map((set) => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: null,
    loadValue: null,
    loadUnit: unit,
    logMode: "timed_round" as const,
    durationSeconds: set.durationSeconds,
    completed: true,
    notes: "",
    prescriptionKey: set.prescriptionKey,
  }));
  const prescribed = bikeTimerSessionSeconds(choice, setsWritten.length);
  let elapsedSeconds = prescribed;
  if (input.durationSeconds != null && input.durationSeconds > 0) {
    const posted = Math.round(input.durationSeconds);
    assertSaneDurationSeconds(posted, "Bike time");
    elapsedSeconds = posted;
  }
  return {
    title: cleanTitle(input.title, "Assault bike"),
    notes: notesWithBikeMetrics(input.notes, input.calories ?? null, input.distance ?? null),
    programDayId: null,
    savedWorkoutId: null,
    sets: setsWritten,
    plannedSetCount: plannedRounds,
    plannedNames: [BIKE_TIMER_EXERCISE],
    elapsedSeconds,
  };
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
    if (input.roundsPerSet != null || input.bikeSets != null) {
      return bikeIntervalPayload(input, unit);
    }
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
    const restSeconds = Math.max(0, Math.round(input.restSeconds ?? 0));
    const built = roundBackfillSets({
      type: "bike",
      exerciseName: BIKE_TIMER_EXERCISE,
      plannedRounds,
      doneRounds,
      workSeconds: perRound,
      restSeconds,
      unit,
    });
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
    const restSeconds = Math.max(0, Math.round(input.restSeconds ?? 0));
    const built = roundBackfillSets({
      type: roundMode,
      exerciseName: name,
      plannedRounds,
      doneRounds,
      workSeconds,
      restSeconds,
      unit,
    });
    return {
      title: cleanTitle(input.title, name),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: roundSessionDuration(doneRounds, workSeconds, restSeconds),
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

export type BackfillFormSeed = {
  title: string;
  notes: string;
  dayKey: string;
  sessionRpe: number | null;
  exercises: {
    name: string;
    sets: number;
    done: number;
    reps: string;
    logMode: string;
    prescriptionKey?: string;
    durationSeconds?: number | null;
    setNotes?: string;
    storedReps?: number | null;
  }[];
};

/** Values the edit and delete dialogs can paint before the edit request returns. */
export function backfillFormSeed(
  session: {
    title: string;
    notes: string | null;
    sessionRpe: number | null;
    performedAt: Date;
    sets: {
      exerciseName: string;
      completed: boolean;
      reps: number | null;
      loadValue: number | null;
      durationSeconds: number | null;
      logMode: string;
      prescriptionKey?: string | null;
      notes?: string | null;
    }[];
  },
  timeZone: string,
  now = new Date(),
): BackfillFormSeed {
  const key = sessionCompletionDay(session, timeZone);
  const groups = new Map<
    string,
    {
      planned: number;
      done: number;
      logMode: string;
      durationSeconds: number | null;
      reps: number | null;
      prescriptionKey: string;
      notes: string;
    }
  >();
  for (const set of session.sets) {
    const current = groups.get(set.exerciseName) ?? {
      planned: 0,
      done: 0,
      logMode: set.logMode,
      durationSeconds: null,
      reps: null,
      prescriptionKey: "",
      notes: "",
    };
    current.planned += 1;
    const worked = set.completed && (set.reps != null || set.loadValue != null || (set.durationSeconds ?? 0) > 0);
    if (worked) current.done += 1;
    if ((set.durationSeconds ?? 0) > 0 && current.durationSeconds == null) {
      current.durationSeconds = set.durationSeconds;
    }
    if (set.reps != null && set.reps > 0 && current.reps == null) current.reps = set.reps;
    if (!current.prescriptionKey && set.prescriptionKey) current.prescriptionKey = set.prescriptionKey;
    if (!current.notes && set.notes) current.notes = set.notes;
    if (set.logMode) current.logMode = set.logMode;
    groups.set(set.exerciseName, current);
  }
  return {
    title: session.title,
    notes: session.notes ?? "",
    dayKey: backfillDayState(key, now, timeZone) === "ok" ? key : backfillDayOptions(now, timeZone)[0]?.key ?? key,
    sessionRpe: session.sessionRpe,
    exercises: [...groups.entries()].map(([name, row]) => {
      const mode = resolveLogMode({ logMode: row.logMode, name, reps: "" });
      const timed = isDurationMode(mode);
      return {
        name,
        sets: row.planned,
        done: row.done,
        logMode: row.logMode,
        reps: timed && row.durationSeconds ? formatClock(row.durationSeconds) : row.reps != null ? String(row.reps) : "",
        prescriptionKey: row.prescriptionKey,
        durationSeconds: row.durationSeconds,
        setNotes: row.notes,
        storedReps: row.reps,
      };
    }),
  };
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
  const seed = backfillFormSeed(session, timeZone, now);
  return {
    id: session.id,
    title: seed.title,
    notes: seed.notes,
    dayKey: seed.dayKey,
    originalDayKey: key,
    status: session.status,
    sessionRpe: seed.sessionRpe,
    exercises: seed.exercises,
    days: backfillDayOptions(now, timeZone),
    existing: (await sessionsOnCivilDay(userId, key, timeZone))
      .filter((row) => row.id !== session.id)
      .map((row) => ({ id: row.id, title: memberFacingTitle(row.title) || row.title, status: row.status })),
  };
}

/** Blank edit fields keep the duration, round key, and notes already on the log. */
export function preserveBackfillExercises(
  posted: BackfillExerciseInput[],
  existing: {
    exerciseName: string;
    durationSeconds: number | null;
    prescriptionKey?: string | null;
    notes?: string | null;
    logMode?: string | null;
    reps: number | null;
    completed?: boolean | null;
  }[],
): BackfillExerciseInput[] {
  return posted.map((exercise) => {
    const name = exercise.name.trim().replace(/\s+/g, " ");
    const matches = existing.filter((set) => set.exerciseName.trim().replace(/\s+/g, " ") === name);
    if (matches.length === 0) return exercise;
    const template =
      matches.find((set) => set.completed !== false && ((set.durationSeconds ?? 0) > 0 || (set.reps ?? 0) > 0)) ??
      matches[0]!;
    const repsText = (exercise.reps ?? "").trim();
    const key = (exercise.prescriptionKey ?? "").trim() || (template.prescriptionKey ?? "").trim();
    const notes = (exercise.setNotes ?? "").trim() || template.notes || "";
    return {
      ...exercise,
      logMode: exercise.logMode || template.logMode || "",
      durationSeconds: exercise.durationSeconds ?? template.durationSeconds,
      storedReps: exercise.storedReps ?? template.reps,
      prescriptionKey: key,
      setNotes: notes,
      reps: repsText,
    };
  });
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
  const session = await prisma.workoutSession.findUnique({
    where: { id: input.sessionId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
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
  const replacing = input.resolution === "replace" && others.length > 0;
  const built = setsForBackfillExercises(preserveBackfillExercises(input.exercises, session.sets), units);
  const status = backfillCompletionStatus({
    sets: built.sets,
    plannedSetCount: built.plannedSetCount,
    plannedNames: built.plannedNames,
  });
  const performedAt = performedAtForDayKey(input.dayKey, timeZone);
  await prisma.$transaction(async (tx) => {
    if (replacing) {
      await tx.workoutSession.deleteMany({
        where: { userId: input.userId, id: { in: others.map((row) => row.id) } },
      });
      throwIfBackfillWriteFault();
    }
    await tx.workoutSet.deleteMany({ where: { workoutSessionId: session.id } });
    await tx.workoutSession.update({
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
    });
  });
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
  const roundsPerSet = numberOrNull(formData.get("roundsPerSet"));
  const bikeSets = numberOrNull(formData.get("bikeSets"));
  const structuredBike = kindRaw === "bike" && (roundsPerSet != null || bikeSets != null);
  const minutesEdited = String(formData.get("minutesEdited") ?? "") === "yes";
  const minutesPosted = Number.isFinite(minutes) && String(formData.get("minutes") ?? "").trim() !== "";
  const durationSeconds =
    structuredBike && !minutesEdited ? null : minutesPosted ? Math.round(minutes * 60) : null;
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
    restSeconds: numberOrNull(formData.get("restSeconds")),
    roundsPerSet,
    bikeSets,
    restBetweenSets: numberOrNull(formData.get("restBetweenSets")),
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
