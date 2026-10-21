"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getAppTier } from "@/lib/entitlements";
import { publicErrorMessage } from "@/lib/errors";
import {
  applySavedWorkoutToDay,
  createSavedWorkout,
  deleteSavedWorkoutForUser,
  renameSavedWorkout,
  revertDayToProgram,
  saveWorkoutFromSession,
  startSavedWorkoutForUser,
  updateSavedWorkoutExercises,
} from "@/lib/my-workouts";
import { getWorkoutSessionForUser } from "@/lib/workouts";
import { defaultSavedWorkoutName } from "@/lib/my-workout-plan";

export type SavedWorkoutActionState = {
  error?: string;
  saved?: boolean;
  renamed?: boolean;
};

function revalidateTraining() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/training/history");
  revalidatePath("/training/my-workouts");
  revalidatePath("/home");
  revalidatePath("/progress");
}

async function memberUnits(userId: string) {
  const profile = await getProfileForUser(userId);
  const timeZone = await timeZoneForUser(userId, profile?.timeZone ?? null);
  return { profile, timeZone, units: profile?.preferredUnits ?? "lb" as const };
}

async function assertCanTrain(userId: string, role: string) {
  const tier = await getAppTier(userId);
  if (tier === "locked" && role !== "admin" && role !== "coach") {
    redirect("/home");
  }
}

export async function saveMyWorkoutAction(
  _prev: SavedWorkoutActionState,
  formData: FormData,
): Promise<SavedWorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    const { timeZone } = await memberUnits(user.id);
    const workoutId = String(formData.get("workoutId") ?? "");
    const name = String(formData.get("name") ?? "");
    const raw = String(formData.get("exercises") ?? "");
    if (raw) {
      await getWorkoutSessionForUser(workoutId, user.id);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { error: "Could not read that exercise list." };
      }
      await createSavedWorkout({
        userId: user.id,
        name,
        exercises: parsed,
        fallbackName: defaultSavedWorkoutName({ title: "Workout", date: new Date(), timeZone }),
      });
    } else {
      await saveWorkoutFromSession({ userId: user.id, workoutId, name, timeZone });
    }
    revalidateTraining();
    return { saved: true };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function renameSavedWorkoutAction(
  _prev: SavedWorkoutActionState,
  formData: FormData,
): Promise<SavedWorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    await renameSavedWorkout(
      user.id,
      String(formData.get("savedWorkoutId") ?? ""),
      String(formData.get("name") ?? ""),
    );
    revalidateTraining();
    return { renamed: true };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function updateSavedWorkoutAction(
  _prev: SavedWorkoutActionState,
  formData: FormData,
): Promise<SavedWorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    const id = String(formData.get("savedWorkoutId") ?? "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(formData.get("exercises") ?? "[]"));
    } catch {
      return { error: "Could not read that exercise list." };
    }
    await updateSavedWorkoutExercises(user.id, id, String(formData.get("name") ?? ""), parsed);
    revalidateTraining();
    return { saved: true };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteSavedWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteSavedWorkoutForUser(user.id, String(formData.get("savedWorkoutId") ?? ""));
  revalidateTraining();
  redirect("/training/my-workouts");
}

export async function startSavedWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await assertCanTrain(user.id, user.role);
  const { timeZone, units } = await memberUnits(user.id);
  const session = await startSavedWorkoutForUser({
    userId: user.id,
    savedWorkoutId: String(formData.get("savedWorkoutId") ?? ""),
    preferredUnits: units,
    timeZone,
  });
  revalidateTraining();
  redirect(`/training/log/${session.id}`);
}

export async function applySavedWorkoutAction(
  _prev: SavedWorkoutActionState,
  formData: FormData,
): Promise<SavedWorkoutActionState> {
  const user = await requireUserOrThrow();
  const dayKey = String(formData.get("dayKey") ?? "");
  const mode = String(formData.get("mode") ?? "");
  try {
    await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: String(formData.get("savedWorkoutId") ?? ""),
      dayKey,
      mode,
    });
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  revalidateTraining();
  redirect(`/training/calendar?day=${encodeURIComponent(dayKey)}`);
}

export async function revertDayAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const dayKey = String(formData.get("dayKey") ?? "");
  const next = String(formData.get("next") ?? "/training");
  await revertDayToProgram(user.id, dayKey);
  revalidateTraining();
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/training";
  redirect(safe);
}
