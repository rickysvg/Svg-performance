import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, AppError } from "@/lib/errors";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { getProgramDayById } from "@/lib/programs";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { parseDifficultyRating } from "@/lib/difficulty";
import {
  hidesLoad,
  isDurationMode,
  isLogMode,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  plannedDurationSeconds,
  scaleBandFromPrefs,
  scaleProgramDay,
  type ScalePrefs,
} from "@/lib/training-scale";

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
    }
  >
>;

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
      result[name][set.setNumber] = {
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: set.loadUnit,
        logMode: set.logMode,
        durationSeconds: set.durationSeconds,
      };
    }
  }
  return result;
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

export async function startWorkoutFromDay(input: {
  userId: string;
  programDayId: string;
  preferredUnits: LoadUnit;
  scale?: ScalePrefs | null;
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
    { band, programSlug: rawDay.program.slug },
  );
  const sets = day.exercises.flatMap((exercise) => {
    const mode = resolveLogMode(exercise);
    const duration = plannedDurationSeconds(exercise);
    return Array.from({ length: exercise.sets }, (_, index) => ({
      exerciseName: exercise.name,
      setNumber: index + 1,
      sortOrder: (exercise.sortOrder ?? 0) * 10 + index,
      reps: null,
      loadValue: null,
      loadUnit: input.preferredUnits,
      logMode: mode,
      durationSeconds: isDurationMode(mode) ? duration : null,
      completed: false,
    }));
  });

  return prisma.workoutSession.create({
    data: {
      userId: input.userId,
      programDayId: day.id,
      title: day.program.isDemo ? `DEMO — ${day.title}` : day.title,
      performedAt: new Date(),
      status: "draft",
      sets: { create: sets },
    },
    include: { sets: true },
  });
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
      throw new AppError("WORKOUT", "Load unit must be lb or kg.");
    }
  }
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
}) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
    }),
    input.userId,
  );
  validateSets(input.sets);

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
        sets: {
          create: input.sets.map((set, index) => {
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
              completed: set.completed,
              notes: (set.notes ?? "").slice(0, 200),
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
