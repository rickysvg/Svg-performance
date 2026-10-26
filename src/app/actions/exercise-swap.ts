"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { publicErrorMessage } from "@/lib/errors";
import { applyExerciseSwap, undoExerciseSwap } from "@/lib/exercise-swap-store";
import { trainingBlockKey, type SwapScope } from "@/lib/exercise-swap";
import { isLogMode, type LogMode } from "@/lib/exercise-log-mode";
import type { WorkoutSet } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";

export type SwapExerciseInput = {
  programSlug: string;
  dayNumber: number;
  programDayId?: string;
  originalName: string;
  currentName: string;
  replacementName: string;
  scope: SwapScope;
  workoutSessionId?: string;
  source: {
    sets: number;
    reps: string;
    loadText: string;
    restSeconds: number;
    logMode?: string;
    notes?: string;
  };
  currentSets?: WorkoutSetInput[];
};

export type SwapExerciseResult =
  | {
      ok: true;
      replacementName: string;
      sets: WorkoutSet[] | null;
      retiredNames: string[];
      updatedAt: string | null;
      prescription: {
        sets: number;
        reps: string;
        loadText: string;
        restSeconds: number;
        logMode: string;
        notes: string;
      };
    }
  | { ok: false; error: string };

export async function swapExerciseAction(input: SwapExerciseInput): Promise<SwapExerciseResult> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const scope: SwapScope = input.scope === "block" ? "block" : "session";
    if (scope === "block" && !input.programSlug) {
      return { ok: false, error: "Rest of the block is only for a programmed day." };
    }
    const applied = await applyExerciseSwap({
      userId: user.id,
      programSlug: input.programSlug.trim(),
      dayNumber: Number.isFinite(input.dayNumber) ? input.dayNumber : 0,
      originalName: input.originalName,
      currentName: input.currentName,
      replacementName: input.replacementName,
      scope,
      workoutSessionId: input.workoutSessionId || undefined,
      blockKey: trainingBlockKey(new Date(), timeZone, profile?.onboardingCompletedAt ?? null),
      source: {
        sets: input.source.sets,
        reps: input.source.reps,
        loadText: input.source.loadText,
        restSeconds: input.source.restSeconds,
        logMode: isLogMode(input.source.logMode) ? (input.source.logMode as LogMode) : undefined,
      },
      currentSets: input.currentSets,
    });
    revalidatePath("/training");
    if (input.programDayId) revalidatePath(`/training/${input.programDayId}`);
    if (input.workoutSessionId) {
      revalidatePath(`/training/log/${input.workoutSessionId}`);
      revalidatePath(`/training/log/${input.workoutSessionId}/done`);
    }
    revalidatePath("/progress");
    return {
      ok: true,
      replacementName: applied.prescription.name,
      sets: applied.sets,
      retiredNames: applied.retiredNames,
      updatedAt: applied.updatedAt,
      prescription: {
        sets: applied.prescription.sets,
        reps: applied.prescription.reps,
        loadText: applied.prescription.loadText,
        restSeconds: applied.prescription.restSeconds,
        logMode: applied.prescription.logMode,
        notes: applied.prescription.notes,
      },
    };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error) };
  }
}

export async function undoExerciseSwapAction(input: {
  programSlug: string;
  dayNumber: number;
  programDayId?: string;
  originalName: string;
  restoredName: string;
  undoneName: string;
  scope: SwapScope;
  workoutSessionId?: string;
  currentSets?: WorkoutSetInput[];
  setDelta?: number;
}): Promise<{ ok: true; sets: WorkoutSet[] | null } | { ok: false; error: string }> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const scope: SwapScope = input.scope === "block" ? "block" : "session";
    const undone = await undoExerciseSwap({
      userId: user.id,
      programSlug: input.programSlug.trim(),
      dayNumber: Number.isFinite(input.dayNumber) ? input.dayNumber : 0,
      originalName: input.originalName,
      restoredName: input.restoredName,
      undoneName: input.undoneName,
      scope,
      workoutSessionId: input.workoutSessionId || undefined,
      blockKey: trainingBlockKey(new Date(), timeZone, profile?.onboardingCompletedAt ?? null),
      currentSets: input.currentSets,
      setDelta: input.setDelta,
    });
    if (!undone.reverted) {
      return { ok: false, error: "That swap was already changed." };
    }
    revalidatePath("/training");
    if (input.programDayId) revalidatePath(`/training/${input.programDayId}`);
    if (input.workoutSessionId) {
      revalidatePath(`/training/log/${input.workoutSessionId}`);
      revalidatePath(`/training/log/${input.workoutSessionId}/done`);
    }
    return { ok: true, sets: undone.sets };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error) };
  }
}
