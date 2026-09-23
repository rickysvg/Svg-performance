"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { publicErrorMessage } from "@/lib/errors";
import { askExerciseNoteForUser, upsertExerciseNoteForUser } from "@/lib/exercise-notes";

export type ExerciseNoteState = {
  error?: string;
  success?: string;
  body?: string;
  aiReply?: string;
  aiOffline?: boolean;
};

function revalidateTrain(programDayId: string, workoutId: string) {
  revalidatePath("/training");
  if (programDayId) revalidatePath(`/training/${programDayId}`);
  if (workoutId) revalidatePath(`/training/log/${workoutId}`);
}

export async function saveExerciseNoteAction(
  _prev: ExerciseNoteState,
  formData: FormData,
): Promise<ExerciseNoteState> {
  try {
    const user = await requireUserOrThrow();
    const programDayId = String(formData.get("programDayId") ?? "");
    const workoutId = String(formData.get("workoutId") ?? "");
    const saved = await upsertExerciseNoteForUser({
      userId: user.id,
      exerciseName: String(formData.get("exerciseName") ?? ""),
      programDayId,
      body: String(formData.get("body") ?? ""),
    });
    revalidateTrain(programDayId, workoutId);
    return {
      success: saved.body ? "Note saved." : "Note cleared.",
      body: saved.body,
      aiReply: saved.aiReply,
      aiOffline: saved.aiOffline,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function askExerciseNoteAction(
  _prev: ExerciseNoteState,
  formData: FormData,
): Promise<ExerciseNoteState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const programDayId = String(formData.get("programDayId") ?? "");
    const workoutId = String(formData.get("workoutId") ?? "");
    const saved = await askExerciseNoteForUser({
      userId: user.id,
      exerciseName: String(formData.get("exerciseName") ?? ""),
      programDayId,
      body: String(formData.get("body") ?? ""),
      logMode: String(formData.get("logMode") ?? ""),
      plannedLine: String(formData.get("plannedLine") ?? ""),
      experienceLevel: profile?.experienceLevel,
      coachingTone: profile?.coachingTone,
    });
    revalidateTrain(programDayId, workoutId);
    return {
      success: saved.refused ? "SVG Coach could not answer that." : "SVG Coach replied.",
      body: saved.body,
      aiReply: saved.aiReply,
      aiOffline: saved.aiOffline,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
