"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { AppError, publicErrorMessage } from "@/lib/errors";
import { getAppTier } from "@/lib/entitlements";
import {
  createBackfillWorkout,
  deleteBackfillWorkout,
  getBackfillForEdit,
  previewBackfillDay,
  readBackfillForm,
  updateBackfillWorkout,
  type BackfillExisting,
} from "@/lib/backfill-workout";
import { parseOptionalRpe } from "@/lib/backfill-rules";

export type BackfillFormState = {
  error?: string;
  conflict?: BackfillExisting[];
};

async function assertCanLog(user: { id: string; role: string }) {
  if (user.role === "admin" || user.role === "coach") return;
  const tier = await getAppTier(user.id);
  if (tier === "locked") {
    throw new AppError("PAYWALL", "Subscribe to keep training. Logging stays off until you subscribe.");
  }
}

function revalidateTraining() {
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/training/history");
  revalidatePath("/training/history/bike");
  revalidatePath("/progress");
  revalidatePath("/progress/streaks");
}

export async function loadBackfillPreview(dayKey: string) {
  const user = await requireUserOrThrow();
  return previewBackfillDay(user.id, dayKey);
}

export async function loadBackfillEdit(sessionId: string) {
  const user = await requireUserOrThrow();
  return getBackfillForEdit(user.id, sessionId);
}

export async function saveBackfillAction(
  _prev: BackfillFormState,
  formData: FormData,
): Promise<BackfillFormState> {
  let sessionId = "";
  try {
    const user = await requireUserOrThrow();
    await assertCanLog(user);
    const result = await createBackfillWorkout(readBackfillForm(formData, user.id));
    if (!result.ok) return { conflict: result.conflict };
    sessionId = result.sessionId;
    revalidateTraining();
    revalidatePath(`/training/log/${sessionId}`);
    revalidatePath(`/training/log/${sessionId}/done`);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/training/log/${sessionId}/done?celebrate=workout`);
}

export async function updateBackfillAction(
  _prev: BackfillFormState,
  formData: FormData,
): Promise<BackfillFormState> {
  let sessionId = "";
  try {
    const user = await requireUserOrThrow();
    await assertCanLog(user);
    const resolutionRaw = String(formData.get("resolution") ?? "");
    const resolution = resolutionRaw === "extra" || resolutionRaw === "replace" ? resolutionRaw : "";
    const count = Number(formData.get("exerciseCount") ?? 0);
    const exercises = [];
    const total = Number.isFinite(count) ? Math.min(12, Math.max(0, Math.round(count))) : 0;
    for (let index = 0; index < total; index += 1) {
      exercises.push({
        name: String(formData.get(`exerciseName_${index}`) ?? ""),
        sets: Number(formData.get(`exerciseSets_${index}`) ?? 0),
        done: Number(formData.get(`exerciseDone_${index}`) ?? 0),
        reps: String(formData.get(`exerciseReps_${index}`) ?? ""),
        logMode: String(formData.get(`exerciseMode_${index}`) ?? ""),
        prescriptionKey: String(formData.get(`exerciseKey_${index}`) ?? ""),
        setNotes: String(formData.get(`exerciseNotes_${index}`) ?? ""),
      });
    }
    const intervalEdit = String(formData.get("intervalEdit") ?? "") === "yes";
    const intervalKind = String(formData.get("kind") ?? "");
    const result = await updateBackfillWorkout({
      userId: user.id,
      sessionId: String(formData.get("sessionId") ?? ""),
      dayKey: String(formData.get("dayKey") ?? ""),
      title: String(formData.get("title") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      rpe: parseOptionalRpe(String(formData.get("rpe") ?? "")),
      exercises,
      confirmed: String(formData.get("confirm") ?? "") === "yes",
      resolution,
      interval:
        intervalEdit && intervalKind && intervalKind !== "custom"
          ? {
              kind: intervalKind as "bike" | "bag" | "pads" | "sparring" | "grappling",
              sets: Number(formData.get("repeatRounds") ?? 1),
              rounds: Number(formData.get("roundsPerSet") ?? 1),
              workSeconds: Number(formData.get("workSeconds") ?? 0),
              restSeconds: Number(formData.get("restSeconds") ?? 0),
              setRestSeconds: Number(formData.get("restBetweenRoundsSeconds") ?? 0),
              done: Number(formData.get("doneRounds") ?? 0),
            }
          : null,
    });
    if (!result.ok) return { conflict: result.conflict };
    sessionId = result.sessionId;
    revalidateTraining();
    revalidatePath(`/training/log/${sessionId}`);
    revalidatePath(`/training/log/${sessionId}/done`);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/training/log/${sessionId}/done?celebrate=workout`);
}

export async function deleteBackfillAction(
  _prev: BackfillFormState,
  formData: FormData,
): Promise<BackfillFormState> {
  try {
    const user = await requireUserOrThrow();
    await assertCanLog(user);
    await deleteBackfillWorkout({
      userId: user.id,
      sessionId: String(formData.get("sessionId") ?? ""),
      confirmed: String(formData.get("confirm") ?? "") === "yes",
    });
    revalidateTraining();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/training/history");
}
