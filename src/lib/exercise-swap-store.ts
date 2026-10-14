import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { isLogMode, resolveLogMode, type LogMode } from "@/lib/exercise-log-mode";
import { libraryExercise } from "@/lib/exercise-library";
import {
  applySwapsToExercises,
  replacementForSlot,
  sensiblePrescription,
  trainingBlockKey,
  type SwapRecord,
  type SwapScope,
} from "@/lib/exercise-swap";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { rirFromLoadText } from "@/lib/rir";
import { scaleBandFromPrefs, scaleProgramDay, type ScalePrefs } from "@/lib/training-scale";
import type { WorkoutSetInput } from "@/lib/workouts";

export type { SwapRecord, SwapScope };

function parseRetired(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name): name is string => typeof name === "string" && name.length > 0);
  } catch {
    return [];
  }
}

function toRecord(row: {
  originalName: string;
  replacementName: string;
  scope: string;
  workoutSessionId: string;
  blockKey: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: string;
  notes: string;
  retiredNamesJson: string;
}): SwapRecord {
  return {
    originalName: row.originalName,
    replacementName: row.replacementName,
    scope: row.scope === "block" ? "block" : "session",
    workoutSessionId: row.workoutSessionId,
    blockKey: row.blockKey,
    sets: row.sets,
    reps: row.reps,
    loadText: row.loadText,
    restSeconds: row.restSeconds,
    logMode: row.logMode,
    notes: row.notes,
    retiredNames: parseRetired(row.retiredNamesJson),
  };
}

export async function listSwapsForDay(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
}) {
  if (!input.programSlug) return [];
  const rows = await prisma.exerciseSwap.findMany({
    where: {
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toRecord);
}

export function mergeReplacementSets(
  existing: WorkoutSetInput[],
  fromNames: string[],
  replacement: {
    name: string;
    sets: number;
    reps: string;
    loadText: string;
    logMode: LogMode;
  },
  place: { programSlug: string; dayNumber: number; loadUnit: "lb" },
): WorkoutSetInput[] {
  const from = new Set(fromNames);
  const created: WorkoutSetInput[] = Array.from({ length: replacement.sets }, (_, index) => ({
    exerciseName: replacement.name,
    setNumber: index + 1,
    reps: null,
    loadValue: null,
    loadUnit: place.loadUnit,
    logMode: replacement.logMode,
    durationSeconds: null,
    completed: false,
    notes: "",
    prescriptionKey: prescriptionSlotKey({
      exerciseName: replacement.name,
      reps: replacement.reps,
      programSlug: place.programSlug,
      dayNumber: place.dayNumber,
    }),
    rir: rirFromLoadText(replacement.loadText) ?? "",
  }));
  const next: WorkoutSetInput[] = [];
  let inserted = false;
  for (const set of existing) {
    if (from.has(set.exerciseName)) {
      if (!inserted) {
        next.push(...created);
        inserted = true;
      }
      continue;
    }
    next.push(set);
  }
  if (!inserted) next.push(...created);
  return next;
}

async function saveSwapRow(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
  originalName: string;
  replacementName: string;
  scope: SwapScope;
  workoutSessionId: string;
  blockKey: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: string;
  notes: string;
  retiredNames: string[];
}) {
  const where = {
    userId: input.userId,
    programSlug: input.programSlug,
    dayNumber: input.dayNumber,
    originalName: input.originalName,
    scope: input.scope,
    workoutSessionId: input.workoutSessionId,
    blockKey: input.blockKey,
  };
  const data = {
    replacementName: input.replacementName,
    sets: input.sets,
    reps: input.reps,
    loadText: input.loadText,
    restSeconds: input.restSeconds,
    logMode: input.logMode,
    notes: input.notes,
    retiredNamesJson: JSON.stringify(input.retiredNames),
  };
  const existing = await prisma.exerciseSwap.findFirst({ where });
  if (existing) {
    return prisma.exerciseSwap.update({ where: { id: existing.id }, data });
  }
  return prisma.exerciseSwap.create({ data: { ...where, ...data } });
}

export async function bindPendingSwaps(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
  workoutSessionId: string;
  originalNames: string[];
}) {
  if (input.originalNames.length === 0) return;
  await prisma.exerciseSwap.updateMany({
    where: {
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
      scope: "session",
      workoutSessionId: "",
      originalName: { in: input.originalNames },
    },
    data: { workoutSessionId: input.workoutSessionId },
  });
}

async function rewriteSessionSets(input: {
  userId: string;
  workoutId: string;
  fromNames: string[];
  replacement: {
    name: string;
    sets: number;
    reps: string;
    loadText: string;
    logMode: LogMode;
  };
  programSlug: string;
  dayNumber: number;
  currentSets?: WorkoutSetInput[];
}) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session) throw new AppError("WORKOUT", "Workout not found.");
  if (session.userId !== input.userId) {
    throw new ForbiddenError("You cannot change another member's workout.");
  }
  if (session.status === "complete") {
    throw new AppError("WORKOUT", "This session is already finished.");
  }
  const base: WorkoutSetInput[] =
    input.currentSets && input.currentSets.length > 0
      ? input.currentSets
      : session.sets.map((set) => ({
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: set.reps,
          loadValue: set.loadValue,
          loadUnit: "lb",
          logMode: isLogMode(set.logMode) ? set.logMode : undefined,
          durationSeconds: set.durationSeconds,
          completed: set.completed,
          notes: set.notes,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        }));
  const merged = mergeReplacementSets(base, input.fromNames, input.replacement, {
    programSlug: input.programSlug,
    dayNumber: input.dayNumber,
    loadUnit: "lb",
  });
  const clearRest = input.fromNames.includes(session.restExerciseName);
  const { updateWorkoutSessionForUser } = await import("@/lib/workouts");
  return updateWorkoutSessionForUser({
    userId: input.userId,
    workoutId: session.id,
    title: session.title,
    performedAt: session.performedAt,
    notes: session.notes,
    status: "draft",
    sets: merged,
    rest: clearRest ? null : undefined,
  });
}

export async function applyExerciseSwap(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
  originalName: string;
  currentName: string;
  replacementName: string;
  scope: SwapScope;
  workoutSessionId?: string;
  blockKey: string;
  source: {
    sets: number;
    reps: string;
    loadText: string;
    restSeconds: number;
    logMode?: string | null;
    notes?: string;
  };
  currentSets?: WorkoutSetInput[];
}) {
  const replacement = libraryExercise(input.replacementName);
  if (!replacement) {
    throw new AppError("WORKOUT", "That exercise is not in the library.");
  }
  if (input.replacementName === input.currentName) {
    throw new AppError("WORKOUT", "Pick a different exercise.");
  }
  const prescription = sensiblePrescription(
    {
      name: input.currentName,
      sets: input.source.sets,
      reps: input.source.reps,
      loadText: input.source.loadText,
      restSeconds: input.source.restSeconds,
      logMode: input.source.logMode,
    },
    input.replacementName,
  );
  if (!prescription) {
    throw new AppError("WORKOUT", "That exercise is not in the library.");
  }
  const originalName = input.originalName.trim() || input.currentName.trim();
  if (!originalName || originalName.length > 80 || input.replacementName.length > 80) {
    throw new AppError("WORKOUT", "Exercise name is too long.");
  }

  const existing = input.programSlug
    ? await prisma.exerciseSwap.findFirst({
        where: {
          userId: input.userId,
          programSlug: input.programSlug,
          dayNumber: input.dayNumber,
          originalName,
          scope: input.scope,
          workoutSessionId: input.scope === "session" ? input.workoutSessionId ?? "" : "",
          blockKey: input.scope === "block" ? input.blockKey : "",
        },
      })
    : null;
  const retired = new Set(existing ? parseRetired(existing.retiredNamesJson) : []);
  if (input.currentName && input.currentName !== input.replacementName) retired.add(input.currentName);
  if (originalName !== input.replacementName) retired.add(originalName);
  retired.delete(input.replacementName);

  const sessionId = input.scope === "session" ? input.workoutSessionId ?? "" : "";
  const blockKey = input.scope === "block" ? input.blockKey : "";
  if (input.programSlug && input.scope === "session" && sessionId) {
    await prisma.exerciseSwap.deleteMany({
      where: {
        userId: input.userId,
        programSlug: input.programSlug,
        dayNumber: input.dayNumber,
        originalName,
        scope: "session",
        workoutSessionId: "",
      },
    });
  }
  if (input.programSlug) {
    await saveSwapRow({
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
      originalName,
      replacementName: prescription.name,
      scope: input.scope,
      workoutSessionId: sessionId,
      blockKey,
      sets: prescription.sets,
      reps: prescription.reps,
      loadText: prescription.loadText,
      restSeconds: prescription.restSeconds,
      logMode: prescription.logMode,
      notes: prescription.notes,
      retiredNames: [...retired],
    });
  }

  let sets = null;
  if (input.workoutSessionId) {
    const fromNames = [...retired, input.currentName, originalName].filter(
      (name) => name && name !== prescription.name,
    );
    const updated = await rewriteSessionSets({
      userId: input.userId,
      workoutId: input.workoutSessionId,
      fromNames: [...new Set(fromNames)],
      replacement: prescription,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
      currentSets: input.currentSets,
    });
    sets = updated.sets;
  }

  return { prescription, sets, retiredNames: [...retired] };
}

export async function alignWorkoutWithSwaps<
  T extends {
    id: string;
    userId: string;
    status: string;
    programDayId: string | null;
    programDay: {
      dayNumber: number;
      focus: string;
      program: { slug: string };
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        loadText: string;
        restSeconds: number;
        logMode: string;
        notes: string;
        sortOrder: number;
        formVideoUrl: string;
        formVideoPending: boolean;
      }>;
    } | null;
    sets: Array<{ exerciseName: string }>;
  },
>(session: T, prefs: ScalePrefs | null, timeZone: string) {
  if (!session.programDay || session.status === "complete") return session;
  const slug = session.programDay.program.slug;
  const swaps = await listSwapsForDay({
    userId: session.userId,
    programSlug: slug,
    dayNumber: session.programDay.dayNumber,
  });
  if (swaps.length === 0) return session;
  const blockKey = trainingBlockKey(new Date(), timeZone);
  const scaled = scaleProgramDay(session.programDay, {
    band: scaleBandFromPrefs(prefs),
    programSlug: slug,
    weightAccess: prefs?.weightAccess,
  });
  const names = new Set(session.sets.map((set) => set.exerciseName));
  let changed = false;
  for (const exercise of scaled.exercises) {
    const swap = replacementForSlot(swaps, exercise.name, {
      sessionId: session.id,
      blockKey,
      includePending: false,
    });
    if (!swap || names.has(swap.replacementName)) continue;
    const fromNames = [exercise.name, ...swap.retiredNames].filter(
      (name) => names.has(name) && name !== swap.replacementName,
    );
    if (fromNames.length === 0) continue;
    const mode = isLogMode(swap.logMode)
      ? swap.logMode
      : resolveLogMode({ name: swap.replacementName, reps: swap.reps });
    await rewriteSessionSets({
      userId: session.userId,
      workoutId: session.id,
      fromNames,
      replacement: {
        name: swap.replacementName,
        sets: swap.sets,
        reps: swap.reps,
        loadText: swap.loadText,
        logMode: mode,
      },
      programSlug: slug,
      dayNumber: session.programDay.dayNumber,
    });
    changed = true;
    for (const name of fromNames) names.delete(name);
    names.add(swap.replacementName);
  }
  if (!changed) return session;
  const fresh = await prisma.workoutSession.findUnique({
    where: { id: session.id },
    include: {
      sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] },
      programDay: { include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  return (fresh ?? session) as T;
}

export { applySwapsToExercises, trainingBlockKey };
