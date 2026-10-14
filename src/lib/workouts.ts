import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, AppError } from "@/lib/errors";
import { APP_LOAD_UNIT, convertLoad, isLoadUnit, roundLoadForInput, type LoadUnit } from "@/lib/units";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { rirFromLoadText } from "@/lib/rir";
import { endOfZonedDay, startOfZonedDay } from "@/lib/timezone";
import { getProgramDayById } from "@/lib/programs";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { parseDifficultyRating } from "@/lib/difficulty";
import { isBikeIntervalName } from "@/lib/bike-sessions";
import {
  hidesLoad,
  isDurationMode,
  isLogMode,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  scaleBandFromPrefs,
  scaleProgramDay,
  type ScalePrefs,
} from "@/lib/training-scale";
import { deloadSetCount } from "@/lib/training-cycle";

export type WorkoutSetInput = {
  id?: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: LoadUnit;
  logMode?: LogMode;
  durationSeconds?: number | null;
  completed: boolean;
  notes?: string;
  prescriptionKey?: string;
  rir?: string;
};

function assertOwnSession<T extends { userId: string }>(
  session: T | null,
  userId: string,
): T {
  if (!session) {
    throw new NotFoundError("Workout not found.");
  }
  if (session.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's workout.");
  }
  return session;
}

const WORKOUT_LIST_INCLUDE = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
  programDay: { include: { program: true } },
};

export const RECENT_SESSION_TAKE = 20;
export const DRAFT_SESSION_TAKE = 8;
export const PROGRESS_SESSION_TAKE = 40;

export async function listWorkoutSessionsForUser(userId: string) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    include: WORKOUT_LIST_INCLUDE,
  });
}

export async function listRecentSessionsForUser(
  userId: string,
  take = RECENT_SESSION_TAKE,
) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take,
    include: WORKOUT_LIST_INCLUDE,
  });
}

export async function listDraftSessionsForUser(
  userId: string,
  take = DRAFT_SESSION_TAKE,
) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "draft" },
    orderBy: { performedAt: "desc" },
    take,
    include: WORKOUT_LIST_INCLUDE,
  });
}

export async function countWorkoutSessionsForUser(userId: string) {
  return prisma.workoutSession.count({ where: { userId } });
}

export type PreviousSetLookup = Record<
  string,
  Record<
    number,
    {
      reps: number | null;
      loadValue: number | null;
      loadUnit: string;
      logMode?: string;
      durationSeconds?: number | null;
      rir?: string;
      prescriptionKey?: string;
    }
  >
>;

export type PreviousSlotQuery = {
  exerciseName: string;
  prescriptionKey: string;
};

function toPreviousSet(set: {
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode: string;
  durationSeconds: number | null;
  rir: string;
  prescriptionKey: string;
}) {
  return {
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: set.durationSeconds,
    rir: set.rir ?? "",
    prescriptionKey: set.prescriptionKey ?? "",
  };
}

/**
 * Last completed session per exercise name for this member only.
 * Used for the Previous column on the logger. Empty for first-time moves.
 */
export async function getPreviousLoadsForUser(
  userId: string,
  exerciseNames: string[],
  excludeWorkoutId?: string,
): Promise<PreviousSetLookup> {
  const unique = [...new Set(exerciseNames.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return {};
  }

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
      sets: { some: { exerciseName: { in: unique } } },
    },
    orderBy: { performedAt: "desc" },
    include: {
      sets: {
        where: { exerciseName: { in: unique } },
        orderBy: [{ setNumber: "asc" }, { sortOrder: "asc" }],
      },
    },
    take: 40,
  });

  const result: PreviousSetLookup = {};
  for (const name of unique) {
    const session = sessions.find((row) =>
      row.sets.some((set) => set.exerciseName === name),
    );
    if (!session) continue;
    result[name] = {};
    for (const set of session.sets) {
      if (set.exerciseName !== name) continue;
      result[name][set.setNumber] = toPreviousSet(set);
    }
  }
  return result;
}

/**
 * Last completed set for each prescription slot. A keyed 8–12 session is not
 * reused as the previous load for a 5×5 slot. Unkeyed history is only a
 * fallback when this slot has never been logged with a key.
 */
export async function getPreviousLoadsForSlots(
  userId: string,
  slots: PreviousSlotQuery[],
  excludeWorkoutId?: string,
): Promise<PreviousSetLookup> {
  const unique = new Map<string, PreviousSlotQuery>();
  for (const slot of slots) {
    const exerciseName = slot.exerciseName.trim();
    const prescriptionKey = slot.prescriptionKey.trim();
    if (!exerciseName) continue;
    const id = prescriptionKey || `name:${exerciseName}`;
    if (!unique.has(id)) unique.set(id, { exerciseName, prescriptionKey });
  }
  const list = [...unique.values()];
  if (list.length === 0) return {};

  const names = [...new Set(list.map((slot) => slot.exerciseName))];
  const keys = list.map((slot) => slot.prescriptionKey).filter(Boolean);
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
      sets: {
        some: {
          OR: [
            ...(keys.length ? [{ prescriptionKey: { in: keys } }] : []),
            { exerciseName: { in: names }, prescriptionKey: "" },
          ],
        },
      },
    },
    orderBy: { performedAt: "desc" },
    include: {
      sets: {
        where: {
          OR: [
            ...(keys.length ? [{ prescriptionKey: { in: keys } }] : []),
            { exerciseName: { in: names }, prescriptionKey: "" },
          ],
        },
        orderBy: [{ setNumber: "asc" }, { sortOrder: "asc" }],
      },
    },
    take: 40,
  });

  const result: PreviousSetLookup = {};
  for (const slot of list) {
    const exact = slot.prescriptionKey
      ? sessions.find((row) => row.sets.some((set) => set.prescriptionKey === slot.prescriptionKey))
      : undefined;
    const legacy = sessions.find((row) =>
      row.sets.some((set) => set.exerciseName === slot.exerciseName && set.prescriptionKey === ""),
    );
    const chosen = exact ?? legacy;
    if (!chosen) continue;
    const keyed = Boolean(exact);
    if (!result[slot.exerciseName]) result[slot.exerciseName] = {};
    for (const set of chosen.sets) {
      const matches = keyed
        ? set.prescriptionKey === slot.prescriptionKey
        : set.exerciseName === slot.exerciseName && !set.prescriptionKey;
      if (!matches) continue;
      result[slot.exerciseName][set.setNumber] = toPreviousSet(set);
    }
  }
  return result;
}

export async function completedProgramDayIdsOnDay(
  userId: string,
  dayIds: string[],
  day: Date,
  timeZone: string,
) {
  const ids = [...new Set(dayIds.filter(Boolean))];
  if (ids.length === 0) return [] as string[];
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      programDayId: { in: ids },
      performedAt: {
        gte: startOfZonedDay(day, timeZone),
        lt: endOfZonedDay(day, timeZone),
      },
    },
    select: { programDayId: true },
  });
  return [...new Set(rows.map((row) => row.programDayId).filter((id): id is string => Boolean(id)))];
}

const WORKOUT_DETAIL_INCLUDE = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
  programDay: { include: { program: true, exercises: true } },
};

export async function getOwnWorkoutSessionOrNull(workoutId: string, userId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: WORKOUT_DETAIL_INCLUDE,
  });
  if (!session || session.userId !== userId) return null;
  return session;
}

export async function getWorkoutSessionForUser(
  workoutId: string,
  userId: string,
) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: WORKOUT_DETAIL_INCLUDE,
  });
  return assertOwnSession(session, userId);
}

const ROUND_LOG_NAMES = {
  bag: "Heavy bag rounds",
  pads: "Pad rounds",
  sparring: "Sparring rounds",
  grappling: "Grappling rounds",
} as const;

export async function startRoundWorkoutForUser(input: {
  userId: string;
  mode: keyof typeof ROUND_LOG_NAMES;
  rounds: number;
  workSeconds: number;
  preferredUnits: LoadUnit;
}) {
  const name = ROUND_LOG_NAMES[input.mode];
  const count = Math.min(20, Math.max(1, Math.round(input.rounds)));
  const duration = Math.min(3600, Math.max(5, Math.round(input.workSeconds)));
  const sets = Array.from({ length: count }, (_, index) => ({
    exerciseName: name,
    setNumber: index + 1,
    sortOrder: index,
    reps: null,
    loadValue: null,
    loadUnit: input.preferredUnits,
    logMode: "timed_round" as const,
    durationSeconds: duration,
    completed: true,
  }));
  return prisma.workoutSession.create({
    data: {
      userId: input.userId,
      title: name,
      performedAt: new Date(),
      status: "draft",
      sets: { create: sets },
    },
    include: { sets: true },
  });
}

export async function startWorkoutFromDay(input: {
  userId: string;
  programDayId: string;
  preferredUnits: LoadUnit;
  scale?: ScalePrefs | null;
  deload?: boolean;
}) {
  const rawDay = await getProgramDayById(input.programDayId);
  const band = scaleBandFromPrefs(input.scale);
  const day = scaleProgramDay(
    {
      ...rawDay,
      exercises: rawDay.exercises.map((exercise) => ({
        ...exercise,
        logMode: exercise.logMode,
      })),
    },
    { band, programSlug: rawDay.program.slug, weightAccess: input.scale?.weightAccess },
  );
  const sets = day.exercises.flatMap((exercise) => {
    const mode = resolveLogMode(exercise);
    const prescribed = input.deload ? deloadSetCount(exercise.sets) : exercise.sets;
    return Array.from({ length: prescribed }, (_, index) => ({
      exerciseName: exercise.name,
      setNumber: index + 1,
      sortOrder: (exercise.sortOrder ?? 0) * 10 + index,
      reps: null,
      loadValue: null,
      loadUnit: input.preferredUnits,
      logMode: mode,
      durationSeconds: null,
      completed: false,
      prescriptionKey: prescriptionSlotKey({
        exerciseName: exercise.name,
        reps: exercise.reps,
        programSlug: rawDay.program.slug,
        dayNumber: rawDay.dayNumber,
      }),
      rir: rirFromLoadText(exercise.loadText) ?? "",
    }));
  });

  return prisma.workoutSession.create({
    data: {
      userId: input.userId,
      programDayId: day.id,
      title: `${day.program.isDemo ? `DEMO — ${day.title}` : day.title}${input.deload ? " · Deload" : ""}`,
      performedAt: new Date(),
      notes: input.deload ? "Deload week — fewer sets. Same exercises." : "",
      status: "draft",
      sets: { create: sets },
    },
    include: { sets: true },
  });
}

function setHasAthleteLog(set: WorkoutSetInput, mode: LogMode) {
  if (isBikeIntervalName(set.exerciseName)) return true;
  if (isDurationMode(mode)) {
    return set.durationSeconds != null || set.loadValue != null;
  }
  return set.reps != null || set.loadValue != null;
}

function validateSets(sets: WorkoutSetInput[]) {
  if (sets.length === 0) {
    throw new AppError("WORKOUT", "Add at least one set before saving.");
  }
  if (sets.length > 80) {
    throw new AppError("WORKOUT", "Too many sets on one session.");
  }
  for (const set of sets) {
    if (!set.exerciseName.trim()) {
      throw new AppError("WORKOUT", "Every set needs an exercise name.");
    }
    if (set.exerciseName.length > 80) {
      throw new AppError("WORKOUT", "Exercise name is too long.");
    }
    if (set.setNumber < 1 || set.setNumber > 20) {
      throw new AppError("WORKOUT", "Set numbers should be between 1 and 20.");
    }
    if (set.reps != null && (set.reps < 0 || set.reps > 200)) {
      throw new AppError("WORKOUT", "Reps should be between 0 and 200.");
    }
    if (set.loadValue != null && (set.loadValue < 0 || set.loadValue > 2000)) {
      throw new AppError("WORKOUT", "Load should be between 0 and 2000.");
    }
    if (set.durationSeconds != null && (set.durationSeconds < 0 || set.durationSeconds > 3600)) {
      throw new AppError("WORKOUT", "Hold / round time should be under 60 minutes.");
    }
    if (set.logMode && !isLogMode(set.logMode)) {
      throw new AppError("WORKOUT", "Unknown logging mode.");
    }
    if (!isLoadUnit(set.loadUnit)) {
      throw new AppError("WORKOUT", "Load unit must be lb.");
    }
  }
}

function setsAsLb(sets: WorkoutSetInput[]): WorkoutSetInput[] {
  return sets.map((set) => {
    if (set.loadUnit !== "kg") {
      return { ...set, loadUnit: APP_LOAD_UNIT };
    }
    return {
      ...set,
      loadUnit: APP_LOAD_UNIT,
      loadValue:
        set.loadValue == null ? null : roundLoadForInput(convertLoad(set.loadValue, "kg", "lb")),
    };
  });
}

export async function updateWorkoutSessionForUser(input: {
  userId: string;
  workoutId: string;
  title: string;
  performedAt: Date;
  notes: string;
  status: "draft" | "complete";
  sets: WorkoutSetInput[];
  difficultyRating?: string | null;
  /** undefined leaves a running rest alone. null clears it. */
  rest?: { exerciseName: string; endsAtMs: number } | null;
}) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
    }),
    input.userId,
  );
  const sets = setsAsLb(input.sets);
  validateSets(sets);

  const title = input.title.trim().slice(0, 120) || "Workout";
  const notes = input.notes.trim().slice(0, 1000);
  if (Number.isNaN(input.performedAt.getTime())) {
    throw new AppError("WORKOUT", "Enter a valid date.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.workoutSet.deleteMany({
      where: { workoutSessionId: input.workoutId },
    });
    return tx.workoutSession.update({
      where: { id: input.workoutId },
      data: {
        title,
        performedAt: input.performedAt,
        notes,
        status: input.status,
        difficultyRating:
          input.difficultyRating === undefined
            ? existing.difficultyRating
            : parseDifficultyRating(input.difficultyRating) ?? "",
        ...(input.rest !== undefined
          ? {
              restExerciseName: input.rest?.exerciseName.trim().slice(0, 80) ?? "",
              restEndsAt:
                input.rest && Number.isFinite(input.rest.endsAtMs)
                  ? new Date(input.rest.endsAtMs)
                  : null,
            }
          : {}),
        sets: {
          create: sets.map((set, index) => {
            const mode = resolveLogMode({
              logMode: set.logMode,
              name: set.exerciseName,
            });
            const timed = isDurationMode(mode);
            return {
              exerciseName: set.exerciseName.trim(),
              setNumber: set.setNumber,
              sortOrder: index,
              reps: timed ? null : set.reps,
              loadValue: hidesLoad(mode) ? null : set.loadValue,
              loadUnit: set.loadUnit,
              logMode: mode,
              durationSeconds: timed ? set.durationSeconds ?? null : null,
              completed: set.completed && setHasAthleteLog(set, mode),
              notes: (set.notes ?? "").slice(0, 200),
              prescriptionKey: (set.prescriptionKey ?? "").trim().slice(0, 160),
              rir: (set.rir ?? "").trim().slice(0, 40),
            };
          }),
        },
      },
      include: { sets: true },
    });
  });
  if (input.status === "complete" && existing.status !== "complete") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return updated;
}

export async function deleteWorkoutSessionForUser(
  workoutId: string,
  userId: string,
) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
  });
  assertOwnSession(existing, userId);
  await prisma.workoutSession.delete({ where: { id: workoutId } });
}

export async function rateWorkoutSessionForUser(input: {
  userId: string;
  workoutId: string;
  difficultyRating: string;
}) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({ where: { id: input.workoutId } }),
    input.userId,
  );
  if (existing.status !== "complete") {
    throw new AppError("WORKOUT", "Save the session first, then rate how it felt.");
  }
  const rating = parseDifficultyRating(input.difficultyRating);
  if (!rating) {
    throw new AppError("WORKOUT", "Pick how the session felt.");
  }
  return prisma.workoutSession.update({
    where: { id: input.workoutId },
    data: { difficultyRating: rating },
  });
}

/**
 * Used by tests and any future API route. Never return another user's row.
 */
export async function tryReadWorkoutByIdForUser(
  workoutId: string,
  userId: string,
) {
  return prisma.workoutSession.findFirst({
    where: { id: workoutId, userId },
  });
}
