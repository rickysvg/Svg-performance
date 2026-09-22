"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import {
  deleteWorkoutSessionForUser,
  rateWorkoutSessionForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
  type WorkoutSetInput,
} from "@/lib/workouts";
import { hasActivityOnLocalDay } from "@/lib/home";
import { publicErrorMessage } from "@/lib/errors";
import { isLoadUnit, type LoadUnit } from "@/lib/units";

export type WorkoutActionState = { error?: string; success?: string };

export async function startSessionAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const profile = await getProfileForUser(user.id);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const session = await startWorkoutFromDay({
    userId: user.id,
    programDayId: String(formData.get("programDayId") ?? ""),
    preferredUnits: units,
  });
  redirect(`/training/log/${session.id}`);
}

function parseSets(formData: FormData): WorkoutSetInput[] {
  const count = Number(formData.get("setCount") ?? 0);
  const sets: WorkoutSetInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const repsRaw = String(formData.get(`sets.${i}.reps`) ?? "").trim();
    const loadRaw = String(formData.get(`sets.${i}.loadValue`) ?? "").trim();
    const unitRaw = String(formData.get(`sets.${i}.loadUnit`) ?? "lb");
    sets.push({
      exerciseName: String(formData.get(`sets.${i}.exerciseName`) ?? ""),
      setNumber: Number(formData.get(`sets.${i}.setNumber`) ?? i + 1),
      reps: repsRaw === "" ? null : Number(repsRaw),
      loadValue: loadRaw === "" ? null : Number(loadRaw),
      loadUnit: isLoadUnit(unitRaw) ? unitRaw : "lb",
      completed: formData.get(`sets.${i}.completed`) === "on",
    });
  }
  return sets;
}

export async function saveWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  let redirectPath = "";
  try {
    const user = await requireUserOrThrow();
    const workoutId = String(formData.get("workoutId") ?? "");
    const intent = String(formData.get("intent") ?? "complete");
    const performedAt = new Date(String(formData.get("performedAt") ?? ""));
    const alreadyActive =
      intent === "complete" ? await hasActivityOnLocalDay(user.id, performedAt) : true;
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      title: String(formData.get("title") ?? "Workout"),
      performedAt,
      notes: String(formData.get("notes") ?? ""),
      status: intent === "draft" ? "draft" : "complete",
      sets: parseSets(formData),
    });
    revalidatePath("/home");
    revalidatePath("/training");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath(`/training/log/${workoutId}`);
    if (intent === "complete") {
      const celebrate = alreadyActive ? "workout" : "streak";
      redirectPath = `/training/log/${workoutId}?celebrate=${celebrate}&rate=1`;
    } else {
      return { success: "Draft saved. You can finish it later." };
    }
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(redirectPath);
}

export async function rateWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    const workoutId = String(formData.get("workoutId") ?? "");
    await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      difficultyRating: String(formData.get("difficultyRating") ?? ""),
    });
    revalidatePath("/home");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath(`/training/log/${workoutId}`);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/training/log/${String(formData.get("workoutId") ?? "")}`);
}

export async function deleteWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteWorkoutSessionForUser(
    String(formData.get("workoutId") ?? ""),
    user.id,
  );
  revalidatePath("/home");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  redirect("/training/history");
}
