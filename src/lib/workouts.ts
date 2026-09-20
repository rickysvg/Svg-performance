import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, AppError } from "@/lib/errors";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { getProgramDayById } from "@/lib/programs";

export type WorkoutSetInput = {
  id?: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: LoadUnit;
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

export async function listWorkoutSessionsForUser(userId: string) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    include: {
      sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] },
      programDay: { include: { program: true } },
    },
  });
}

export async function getWorkoutSessionForUser(
  workoutId: string,
  userId: string,
) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: {
      sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] },
      programDay: { include: { program: true, exercises: true } },
    },
  });
  return assertOwnSession(session, userId);
}

export async function startWorkoutFromDay(input: {
  userId: string;
  programDayId: string;
  preferredUnits: LoadUnit;
}) {
  const day = await getProgramDayById(input.programDayId);
  const sets = day.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets }, (_, index) => ({
      exerciseName: exercise.name,
      setNumber: index + 1,
      sortOrder: exercise.sortOrder * 10 + index,
      reps: null,
      loadValue: null,
      loadUnit: input.preferredUnits,
      completed: false,
    })),
  );

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
}) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
  });
  assertOwnSession(existing, input.userId);
  validateSets(input.sets);

  const title = input.title.trim().slice(0, 120) || "Workout";
  const notes = input.notes.trim().slice(0, 1000);
  if (Number.isNaN(input.performedAt.getTime())) {
    throw new AppError("WORKOUT", "Enter a valid date.");
  }

  return prisma.$transaction(async (tx) => {
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
        sets: {
          create: input.sets.map((set, index) => ({
            exerciseName: set.exerciseName.trim(),
            setNumber: set.setNumber,
            sortOrder: index,
            reps: set.reps,
            loadValue: set.loadValue,
            loadUnit: set.loadUnit,
            completed: set.completed,
            notes: (set.notes ?? "").slice(0, 200),
          })),
        },
      },
      include: { sets: true },
    });
  });
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
