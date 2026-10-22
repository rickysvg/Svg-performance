import { memberWeekIndex } from "@/lib/bike-sessions";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isLogMode } from "@/lib/exercise-log-mode";
import { applySwapsToExercises } from "@/lib/exercise-swap";
import { listSwapsForDay } from "@/lib/exercise-swap-store";
import {
  activeRemovals,
  omitRemovedSlots,
  parseRemovalSnapshot,
  restoreSnapshotSets,
  snapshotRemovedSets,
  withoutExerciseName,
  withoutRemovedExercises,
  visibleExerciseCount,
  type RemovalRecord,
  type RemovalSnapshot,
} from "@/lib/exercise-removal";
import { getProfileForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";
import { normalizeWeightAccess } from "@/lib/weight-access";
import type { WorkoutSet, WorkoutSession } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";

export type { RemovalRecord };

function toRecord(row: {
  id: string;
  originalName: string;
  exerciseName: string;
  workoutSessionId: string;
  snapshotJson: string;
}): RemovalRecord & { id: string; snapshotJson: string } {
  return {
    id: row.id,
    originalName: row.originalName,
    exerciseName: row.exerciseName,
    workoutSessionId: row.workoutSessionId,
    snapshotJson: row.snapshotJson,
  };
}

function setsFromRows(
  sets: Array<{
    exerciseName: string;
    setNumber: number;
    reps: number | null;
    loadValue: number | null;
    loadUnit: string;
    logMode: string;
    durationSeconds: number | null;
    completed: boolean;
    notes: string;
    prescriptionKey: string;
    rir: string;
  }>,
): WorkoutSetInput[] {
  return sets.map((set) => ({
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
}

export async function listRemovalsForDay(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
}) {
  if (!input.programSlug) return [];
  const rows = await prisma.exerciseRemoval.findMany({
    where: {
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}

export async function listRemovalsForSession(userId: string, workoutSessionId: string) {
  if (!workoutSessionId) return [];
  const rows = await prisma.exerciseRemoval.findMany({
    where: { userId, workoutSessionId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}

/** Removals that apply to this session. Pending rows are already bound at start. */
export async function activeRemovalsForSession(userId: string, workoutId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    select: {
      programDay: {
        select: { dayNumber: true, program: { select: { slug: true } } },
      },
    },
  });
  const removals = session?.programDay
    ? await listRemovalsForDay({
        userId,
        programSlug: session.programDay.program.slug,
        dayNumber: session.programDay.dayNumber,
      })
    : await listRemovalsForSession(userId, workoutId);
  return activeRemovals(removals, { sessionId: workoutId, includePending: false });
}

export function setsKeepingRemovals<T extends { exerciseName: string }>(
  sets: T[],
  removals: RemovalRecord[],
) {
  return withoutRemovedExercises(sets, removals);
}

export async function bindPendingRemovals(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
  workoutSessionId: string;
}) {
  if (!input.programSlug || !input.workoutSessionId) return;
  await prisma.exerciseRemoval.updateMany({
    where: {
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
      workoutSessionId: "",
    },
    data: { workoutSessionId: input.workoutSessionId },
  });
}

async function planSlots(input: {
  userId: string;
  programDayId?: string | null;
  workoutSessionId?: string;
  blockKey: string;
  removals: RemovalRecord[];
}) {
  if (!input.programDayId) return null;
  let raw;
  try {
    raw = await getProgramDayById(input.programDayId);
  } catch {
    return null;
  }
  const profile = await getProfileForUser(input.userId);
  const scaled = scaleProgramDay(raw, {
    band: scaleBandFromPrefs({
      experienceLevel: profile?.experienceLevel,
      competitionStatus: profile?.competitionStatus,
    }),
    weekIndex: memberWeekIndex(new Date(), profile?.onboardingCompletedAt ?? new Date()),
    programSlug: raw.program.slug,
    weightAccess: normalizeWeightAccess(profile?.weightAccess),
  });
  const swaps = await listSwapsForDay({
    userId: input.userId,
    programSlug: raw.program.slug,
    dayNumber: raw.dayNumber,
  });
  const swapped = applySwapsToExercises(scaled.exercises, swaps, {
    sessionId: input.workoutSessionId,
    blockKey: input.blockKey,
    includePending: !input.workoutSessionId,
  });
  return omitRemovedSlots(scaled.exercises, swapped, input.removals, {
    sessionId: input.workoutSessionId,
    includePending: !input.workoutSessionId,
  });
}

async function ownDraft(userId: string, workoutSessionId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutSessionId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session) throw new NotFoundError("Workout not found.");
  if (session.userId !== userId) {
    throw new ForbiddenError("You cannot change another member's workout.");
  }
  if (session.status === "complete") {
    throw new AppError("WORKOUT", "This session is already finished.");
  }
  return session;
}

async function saveSets(
  session: WorkoutSession & { sets: WorkoutSet[] },
  sets: WorkoutSetInput[],
  clearRest: boolean,
) {
  const { updateWorkoutSessionForUser } = await import("@/lib/workouts");
  return updateWorkoutSessionForUser({
    userId: session.userId,
    workoutId: session.id,
    title: session.title,
    performedAt: session.performedAt,
    notes: session.notes,
    status: "draft",
    sets,
    rest: clearRest ? null : undefined,
  });
}

export async function removeSessionExercise(input: {
  userId: string;
  programSlug: string;
  dayNumber: number;
  programDayId?: string;
  originalName: string;
  exerciseName: string;
  workoutSessionId?: string;
  blockKey: string;
  currentSets?: WorkoutSetInput[];
}) {
  const exerciseName = input.exerciseName.trim();
  const originalName = input.originalName.trim() || exerciseName;
  if (!exerciseName || exerciseName.length > 80 || originalName.length > 80) {
    throw new AppError("WORKOUT", "Exercise name is too long.");
  }

  const session = input.workoutSessionId
    ? await ownDraft(input.userId, input.workoutSessionId)
    : null;
  const programDayId = input.programDayId || session?.programDayId || undefined;
  const sessionId = session?.id ?? "";
  const baseSets =
    input.currentSets && input.currentSets.length > 0
      ? input.currentSets
      : session
        ? setsFromRows(session.sets)
        : [];

  const stored = input.programSlug
    ? await listRemovalsForDay({
        userId: input.userId,
        programSlug: input.programSlug,
        dayNumber: input.dayNumber,
      })
    : session
      ? await listRemovalsForSession(input.userId, session.id)
      : [];
  const before = await planSlots({
    userId: input.userId,
    programDayId,
    workoutSessionId: sessionId || undefined,
    blockKey: input.blockKey,
    removals: stored,
  });
  const presentOnPlan = before?.shown.some((row) => row.name === exerciseName) ?? false;
  const presentInSets = baseSets.some((set) => set.exerciseName === exerciseName);
  if (!presentOnPlan && !presentInSets) {
    throw new AppError("WORKOUT", "That exercise is not in this session.");
  }

  // The logger renames the card before the page reloads, so the client often
  // sends the swapped name as the programmed slot. Bind the removal to the
  // slot that is actually showing that name.
  const slotIndex = before?.shown.findIndex((row) => row.name === exerciseName) ?? -1;
  const programmedName = slotIndex >= 0 ? before?.programmed[slotIndex]?.name : undefined;
  const slotOriginal = programmedName || originalName;

  const proposed: RemovalRecord = {
    originalName: slotOriginal,
    exerciseName,
    workoutSessionId: sessionId,
  };
  const after = await planSlots({
    userId: input.userId,
    programDayId,
    workoutSessionId: sessionId || undefined,
    blockKey: input.blockKey,
    removals: [...stored, proposed],
  });
  const stillShown = after?.shown.some((row) => row.name === exerciseName) ?? false;
  const nextSets = stillShown ? baseSets : withoutExerciseName(baseSets, exerciseName);
  const slot = slotIndex >= 0 ? before?.shown[slotIndex] : undefined;
  const prescribed =
    slot && "sets" in slot && typeof slot.sets === "number" && Number.isFinite(slot.sets)
      ? Math.max(0, Math.round(slot.sets))
      : 0;
  const plannedRemoved = session && !stillShown && slotIndex >= 0 ? prescribed : 0;
  const remaining = after
    ? visibleExerciseCount(after.shown, nextSets)
    : new Set(nextSets.map((set) => set.exerciseName)).size;
  if (remaining < 1 || (session && nextSets.length === 0)) {
    throw new AppError("WORKOUT", "Keep at least one exercise in this session.");
  }

  const snapshot: RemovalSnapshot = stillShown
    ? { index: 0, sets: [], plannedSets: 0 }
    : { ...snapshotRemovedSets(baseSets, exerciseName), plannedSets: plannedRemoved };
  // The row lands before the set write so a swap or draft still in flight
  // sees the removal and cannot put the exercise back.
  const row = await prisma.exerciseRemoval.create({
    data: {
      userId: input.userId,
      programSlug: input.programSlug,
      dayNumber: input.dayNumber,
      originalName: slotOriginal,
      exerciseName,
      workoutSessionId: sessionId,
      snapshotJson: JSON.stringify(snapshot),
    },
  });
  let sets: WorkoutSet[] | null = null;
  try {
    if (session && nextSets.length !== baseSets.length) {
      const updated = await saveSets(session, nextSets, session.restExerciseName === exerciseName);
      sets = updated.sets;
    } else if (session) {
      sets = session.sets;
    }
  } catch (error) {
    await prisma.exerciseRemoval.delete({ where: { id: row.id } }).catch(() => undefined);
    throw error;
  }
  if (
    session &&
    plannedRemoved > 0 &&
    typeof session.plannedSetCount === "number" &&
    session.plannedSetCount > 0
  ) {
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { plannedSetCount: Math.max(0, session.plannedSetCount - plannedRemoved) },
    });
  }
  return { id: row.id, sets };
}

export async function undoExerciseRemoval(input: {
  userId: string;
  removalId: string;
  currentSets?: WorkoutSetInput[];
}) {
  const row = await prisma.exerciseRemoval.findUnique({ where: { id: input.removalId } });
  if (!row || row.userId !== input.userId) {
    throw new NotFoundError("That exercise is already back.");
  }
  const snapshot = parseRemovalSnapshot(row.snapshotJson);
  await prisma.exerciseRemoval.delete({ where: { id: row.id } });
  if (!row.workoutSessionId) return { sets: null };

  const session = await ownDraft(input.userId, row.workoutSessionId);
  const base = input.currentSets ?? setsFromRows(session.sets);
  const restored = restoreSnapshotSets(base, snapshot);
  if (restored.length === 0) return { sets: session.sets };
  const updated = await saveSets(session, restored, false);
  const addBack = snapshot?.plannedSets ?? 0;
  if (addBack > 0 && typeof session.plannedSetCount === "number") {
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { plannedSetCount: session.plannedSetCount + addBack },
    });
  }
  return { sets: updated.sets };
}
