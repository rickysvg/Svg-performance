"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { publicErrorMessage } from "@/lib/errors";
import { trainingBlockKey } from "@/lib/exercise-swap";
import {
  removeSessionExercise,
  undoExerciseRemoval,
} from "@/lib/exercise-removal-store";
import type { WorkoutSet } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";

export type RemoveExerciseInput = {
  programSlug: string;
  dayNumber: number;
  programDayId?: string;
  originalName: string;
  exerciseName: string;
  workoutSessionId?: string;
  currentSets?: WorkoutSetInput[];
};

export type RemoveExerciseResult =
  | { ok: true; removalId: string; sets: WorkoutSet[] | null }
  | { ok: false; error: string };

function revalidateWorkout(programDayId?: string, workoutSessionId?: string) {
  revalidatePath("/training");
  if (programDayId) revalidatePath(`/training/${programDayId}`);
  if (workoutSessionId) {
    revalidatePath(`/training/log/${workoutSessionId}`);
    revalidatePath(`/training/log/${workoutSessionId}/done`);
  }
}

export async function removeExerciseAction(
  input: RemoveExerciseInput,
): Promise<RemoveExerciseResult> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const applied = await removeSessionExercise({
      userId: user.id,
      programSlug: input.programSlug.trim(),
      dayNumber: Number.isFinite(input.dayNumber) ? input.dayNumber : 0,
      programDayId: input.programDayId,
      originalName: input.originalName,
      exerciseName: input.exerciseName,
      workoutSessionId: input.workoutSessionId || undefined,
      blockKey: trainingBlockKey(new Date(), timeZone, profile?.onboardingCompletedAt ?? null),
      currentSets: input.currentSets,
    });
    revalidateWorkout(input.programDayId, input.workoutSessionId);
    return { ok: true, removalId: applied.id, sets: applied.sets };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error) };
  }
}

export async function undoExerciseRemovalAction(input: {
  removalId: string;
  programDayId?: string;
  workoutSessionId?: string;
  currentSets?: WorkoutSetInput[];
}): Promise<{ ok: true; sets: WorkoutSet[] | null } | { ok: false; error: string }> {
  try {
    const user = await requireUserOrThrow();
    const restored = await undoExerciseRemoval({
      userId: user.id,
      removalId: input.removalId,
      currentSets: input.currentSets,
    });
    revalidateWorkout(input.programDayId, input.workoutSessionId);
    return { ok: true, sets: restored.sets };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error) };
  }
}
