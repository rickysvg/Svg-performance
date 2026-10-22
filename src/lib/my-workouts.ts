import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { compactBikeReps } from "@/lib/bike-chooser";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { loggedSetSome, sessionCountsAsPlannedCompletion, setHasLoggedWork } from "@/lib/logged-work";
import { resolveLogMode } from "@/lib/exercise-log-mode";
import { dayKey, zonedCivilToUtc } from "@/lib/timezone";
import type { LoadUnit } from "@/lib/units";
import {
  cleanSavedName,
  defaultSavedWorkoutName,
  exercisesFromLoggedSets,
  isDayKey,
  isDayPlanMode,
  sanitizeSavedExercises,
  type DayPlanMode,
  type SavedExercise,
} from "@/lib/my-workout-plan";

const exerciseOrder = { orderBy: { sortOrder: "asc" as const } };

function snapshot(exercises: SavedExercise[]) {
  return JSON.stringify(sanitizeSavedExercises(exercises));
}

function readSnapshot(raw: string): SavedExercise[] {
  try {
    return sanitizeSavedExercises(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function ownSaved(userId: string, savedWorkoutId: string) {
  const row = await prisma.savedWorkout.findUnique({
    where: { id: savedWorkoutId },
    include: { exercises: exerciseOrder },
  });
  if (!row || row.userId !== userId) throw new ForbiddenError();
  return row;
}

function toInput(row: {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  rir: string;
  logMode: string;
  notes: string;
}): SavedExercise {
  return sanitizeSavedExercises([row])[0] ?? {
    name: row.name,
    sets: row.sets,
    reps: row.reps,
    loadText: row.loadText,
    restSeconds: row.restSeconds,
    rir: row.rir,
    logMode: row.logMode,
    notes: row.notes,
  };
}

export async function listSavedWorkouts(userId: string) {
  const rows = await prisma.savedWorkout.findMany({
    where: { userId },
    include: { exercises: { select: { id: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    exerciseCount: row.exercises.length,
    lastUsedAt: row.lastUsedAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getSavedWorkoutForUser(savedWorkoutId: string, userId: string) {
  const row = await ownSaved(userId, savedWorkoutId);
  return {
    id: row.id,
    name: row.name,
    lastUsedAt: row.lastUsedAt,
    exercises: row.exercises.map(toInput),
  };
}

export async function createSavedWorkout(input: {
  userId: string;
  name: string;
  exercises: unknown;
  fallbackName?: string;
}) {
  const exercises = sanitizeSavedExercises(input.exercises);
  if (exercises.length === 0) {
    throw new AppError("WORKOUT", "Add at least one exercise before saving.");
  }
  const name = cleanSavedName(input.name, input.fallbackName || "My workout");
  return prisma.savedWorkout.create({
    data: {
      userId: input.userId,
      name,
      exercises: {
        create: exercises.map((exercise, index) => ({
          sortOrder: index,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          loadText: exercise.loadText,
          restSeconds: exercise.restSeconds,
          rir: exercise.rir,
          logMode: exercise.logMode,
          notes: exercise.notes,
        })),
      },
    },
    include: { exercises: exerciseOrder },
  });
}

export async function saveWorkoutFromSession(input: {
  userId: string;
  workoutId: string;
  name?: string;
  timeZone: string;
}) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
    include: {
      sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] },
      programDay: { include: { exercises: true } },
    },
  });
  if (!session || session.userId !== input.userId) throw new ForbiddenError();
  const exercises = exercisesFromLoggedSets(
    session.sets,
    (session.programDay?.exercises ?? []).map((exercise) => ({
      name: exercise.name,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
      loadText: exercise.loadText,
      logMode: exercise.logMode,
      notes: exercise.notes,
    })),
  );
  const fallback = defaultSavedWorkoutName({
    title: session.title,
    date: session.performedAt,
    timeZone: input.timeZone,
  });
  return createSavedWorkout({
    userId: input.userId,
    name: input.name || fallback,
    exercises,
    fallbackName: fallback,
  });
}

export async function renameSavedWorkout(userId: string, savedWorkoutId: string, name: string) {
  const row = await ownSaved(userId, savedWorkoutId);
  const next = cleanSavedName(name, row.name);
  return prisma.savedWorkout.update({
    where: { id: row.id },
    data: { name: next },
  });
}

export async function updateSavedWorkoutExercises(
  userId: string,
  savedWorkoutId: string,
  name: string,
  exercises: unknown,
) {
  const row = await ownSaved(userId, savedWorkoutId);
  const next = sanitizeSavedExercises(exercises);
  if (next.length === 0) {
    throw new AppError("WORKOUT", "Add at least one exercise before saving.");
  }
  const cleaned = cleanSavedName(name, row.name);
  await prisma.$transaction(async (tx) => {
    await tx.savedWorkoutExercise.deleteMany({ where: { savedWorkoutId: row.id } });
    await tx.savedWorkout.update({
      where: { id: row.id },
      data: {
        name: cleaned,
        exercises: {
          create: next.map((exercise, index) => ({
            sortOrder: index,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            loadText: exercise.loadText,
            restSeconds: exercise.restSeconds,
            rir: exercise.rir,
            logMode: exercise.logMode,
            notes: exercise.notes,
          })),
        },
      },
    });
  });
  return getSavedWorkoutForUser(row.id, userId);
}

export async function deleteSavedWorkoutForUser(userId: string, savedWorkoutId: string) {
  const row = await ownSaved(userId, savedWorkoutId);
  await prisma.workoutSession.updateMany({
    where: { userId, savedWorkoutId: row.id },
    data: { savedWorkoutId: null },
  });
  await prisma.dayWorkoutPlan.updateMany({
    where: { userId, savedWorkoutId: row.id },
    data: { savedWorkoutId: null },
  });
  await prisma.savedWorkout.delete({ where: { id: row.id } });
}

function setsForExercises(exercises: SavedExercise[], preferredUnits: LoadUnit) {
  return exercises.flatMap((exercise, exerciseIndex) => {
    const mode = resolveLogMode({ logMode: exercise.logMode, name: exercise.name, reps: exercise.reps });
    const count = Math.min(12, Math.max(1, Math.round(exercise.sets) || 1));
    return Array.from({ length: count }, (_, index) => ({
      exerciseName: exercise.name,
      setNumber: index + 1,
      sortOrder: exerciseIndex * 10 + index,
      reps: null,
      loadValue: null,
      loadUnit: preferredUnits,
      logMode: mode,
      durationSeconds: null,
      completed: false,
      prescriptionKey: addedPrescriptionKey({
        exerciseName: exercise.name,
        reps: compactBikeReps(exercise.reps),
        restSeconds: exercise.restSeconds,
        loadText: exercise.loadText,
        notes: exercise.notes,
      }),
      rir: exercise.rir,
    }));
  });
}

function performedForDay(day: string, timeZone: string, now: Date) {
  if (day === dayKey(now, timeZone)) return now;
  const [year, month, date] = day.split("-").map(Number);
  return zonedCivilToUtc(year!, month!, date!, timeZone);
}

export async function startSavedWorkoutForUser(input: {
  userId: string;
  savedWorkoutId: string;
  preferredUnits: LoadUnit;
  timeZone: string;
  now?: Date;
}) {
  const saved = await ownSaved(input.userId, input.savedWorkoutId);
  const exercises = saved.exercises.map(toInput);
  const now = input.now ?? new Date();
  const today = dayKey(now, input.timeZone);
  const open = await prisma.workoutSession.findFirst({
    where: {
      userId: input.userId,
      savedWorkoutId: saved.id,
      dayPlanId: null,
      status: "draft",
      programDayId: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (open && dayKey(open.performedAt, input.timeZone) === today) {
    await prisma.savedWorkout.update({ where: { id: saved.id }, data: { lastUsedAt: now } });
    return prisma.workoutSession.findUniqueOrThrow({
      where: { id: open.id },
      include: { sets: true },
    });
  }
  const setRows = setsForExercises(exercises, input.preferredUnits);
  const session = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      title: saved.name,
      performedAt: now,
      status: "draft",
      savedWorkoutId: saved.id,
      plannedSetCount: setRows.length,
      sets: { create: setRows },
    },
    include: { sets: true },
  });
  await prisma.savedWorkout.update({ where: { id: saved.id }, data: { lastUsedAt: now } });
  return session;
}

export async function applySavedWorkoutToDay(input: {
  userId: string;
  savedWorkoutId: string;
  dayKey: string;
  mode: string;
}) {
  if (!isDayKey(input.dayKey)) {
    throw new AppError("WORKOUT", "Pick a date.");
  }
  if (!isDayPlanMode(input.mode)) {
    throw new AppError("WORKOUT", "Choose replace or an extra session.");
  }
  const saved = await ownSaved(input.userId, input.savedWorkoutId);
  const exercises = saved.exercises.map(toInput);
  if (exercises.length === 0) {
    throw new AppError("WORKOUT", "Add at least one exercise before saving.");
  }
  if (input.mode === "replace") {
    const previous = await prisma.dayWorkoutPlan.findMany({
      where: { userId: input.userId, dayKey: input.dayKey, mode: "replace" },
      select: { id: true },
    });
    const ids = previous.map((row) => row.id);
    if (ids.length > 0) {
      await prisma.workoutSession.updateMany({
        where: { userId: input.userId, dayPlanId: { in: ids } },
        data: { dayPlanId: null },
      });
      await prisma.dayWorkoutPlan.deleteMany({ where: { id: { in: ids } } });
    }
  }
  const plan = await prisma.dayWorkoutPlan.create({
    data: {
      userId: input.userId,
      dayKey: input.dayKey,
      mode: input.mode,
      savedWorkoutId: saved.id,
      name: saved.name,
      exercisesJson: snapshot(exercises),
    },
  });
  await prisma.savedWorkout.update({
    where: { id: saved.id },
    data: { lastUsedAt: new Date() },
  });
  return plan;
}

function customSessionHasMemberWork(sets: {
  completed?: boolean | null;
  reps?: number | null;
  loadValue?: number | null;
  durationSeconds?: number | null;
}[]) {
  return sets.some((set) => Boolean(set.completed) || setHasLoggedWork(set));
}

export async function revertDayToProgram(userId: string, day: string) {
  if (!isDayKey(day)) throw new AppError("WORKOUT", "Pick a date.");
  const plans = await prisma.dayWorkoutPlan.findMany({
    where: { userId, dayKey: day },
    select: { id: true },
  });
  const ids = plans.map((row) => row.id);
  if (ids.length === 0) return;
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, dayPlanId: { in: ids } },
    select: {
      id: true,
      sets: { select: { completed: true, reps: true, loadValue: true, durationSeconds: true } },
    },
  });
  // A draft the member never ticked or edited is the applied plan, not a log.
  // Real ticked or entered work stays, unlinked, so the calendar can show it.
  const dropIds = sessions.filter((session) => !customSessionHasMemberWork(session.sets)).map((session) => session.id);
  const keepIds = sessions.filter((session) => customSessionHasMemberWork(session.sets)).map((session) => session.id);
  if (dropIds.length > 0) {
    await prisma.workoutSession.deleteMany({ where: { userId, id: { in: dropIds } } });
  }
  if (keepIds.length > 0) {
    await prisma.workoutSession.updateMany({
      where: { userId, id: { in: keepIds } },
      data: { dayPlanId: null },
    });
  }
  await prisma.dayWorkoutPlan.deleteMany({ where: { userId, dayKey: day } });
}

export type DayPlanView = {
  id: string;
  dayKey: string;
  mode: DayPlanMode;
  name: string;
  exerciseCount: number;
  exerciseNames: string[];
  exercises: SavedExercise[];
  complete: boolean;
  draftId: string | null;
};

export async function listDayPlansForUser(userId: string, dayKeys: string[]): Promise<DayPlanView[]> {
  const keys = [...new Set(dayKeys.filter(isDayKey))];
  if (keys.length === 0) return [];
  const plans = await prisma.dayWorkoutPlan.findMany({
    where: { userId, dayKey: { in: keys } },
    orderBy: { createdAt: "asc" },
  });
  if (plans.length === 0) return [];
  const ids = plans.map((plan) => plan.id);
  const [done, drafts] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, dayPlanId: { in: ids }, status: "complete", sets: loggedSetSome },
      select: {
        dayPlanId: true,
        status: true,
        plannedSetCount: true,
        sets: {
          select: {
            exerciseName: true,
            completed: true,
            reps: true,
            loadValue: true,
            durationSeconds: true,
          },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId, dayPlanId: { in: ids }, status: "draft" },
      select: { id: true, dayPlanId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const complete = new Set(
    done
      .filter((row) => row.dayPlanId && sessionCountsAsPlannedCompletion(row, []))
      .map((row) => row.dayPlanId)
      .filter((id): id is string => Boolean(id)),
  );
  const draftByPlan = new Map<string, string>();
  for (const draft of drafts) {
    if (draft.dayPlanId && !draftByPlan.has(draft.dayPlanId)) draftByPlan.set(draft.dayPlanId, draft.id);
  }
  return plans.flatMap((plan) => {
    if (!isDayPlanMode(plan.mode)) return [];
    const exercises = readSnapshot(plan.exercisesJson);
    return [
      {
        id: plan.id,
        dayKey: plan.dayKey,
        mode: plan.mode,
        name: plan.name,
        exerciseCount: exercises.length,
        exerciseNames: exercises.map((exercise) => exercise.name),
        exercises,
        complete: complete.has(plan.id),
        draftId: draftByPlan.get(plan.id) ?? null,
      },
    ];
  });
}

export async function startDayPlanForUser(input: {
  userId: string;
  planId: string;
  preferredUnits: LoadUnit;
  timeZone: string;
  now?: Date;
}) {
  const plan = await prisma.dayWorkoutPlan.findUnique({ where: { id: input.planId } });
  if (!plan || plan.userId !== input.userId) throw new ForbiddenError();
  const draft = await prisma.workoutSession.findFirst({
    where: { userId: input.userId, dayPlanId: plan.id, status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  const now = input.now ?? new Date();
  if (plan.savedWorkoutId) {
    await prisma.savedWorkout.updateMany({
      where: { id: plan.savedWorkoutId, userId: input.userId },
      data: { lastUsedAt: now },
    });
  }
  if (draft) {
    return prisma.workoutSession.findUniqueOrThrow({
      where: { id: draft.id },
      include: { sets: true },
    });
  }
  const exercises = readSnapshot(plan.exercisesJson);
  if (exercises.length === 0) {
    throw new AppError("WORKOUT", "Add at least one exercise before saving.");
  }
  const when = performedForDay(plan.dayKey, input.timeZone, now);
  const setRows = setsForExercises(exercises, input.preferredUnits);
  return prisma.workoutSession.create({
    data: {
      userId: input.userId,
      title: plan.name,
      performedAt: when,
      createdAt: when,
      status: "draft",
      savedWorkoutId: plan.savedWorkoutId,
      dayPlanId: plan.id,
      plannedSetCount: setRows.length,
      sets: { create: setRows },
    },
    include: { sets: true },
  });
}
