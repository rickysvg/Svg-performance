"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppTier } from "@/lib/entitlements";
import { AppError, publicErrorMessage } from "@/lib/errors";
import {
  deleteCustomBagWorkoutForUser,
  logBagworkSessionForUser,
  saveCustomBagWorkoutForUser,
} from "@/lib/bagwork-store";
import { parseSessionRpe } from "@/lib/bagwork";
import { requireUserOrThrow } from "@/lib/session";

export type BagworkFormState = { error?: string };

async function requireBagworkUser() {
  const user = await requireUserOrThrow();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  return user;
}

export async function saveCustomBagWorkoutAction(
  _prev: BagworkFormState,
  formData: FormData,
): Promise<BagworkFormState> {
  try {
    const user = await requireBagworkUser();
    const id = String(formData.get("id") ?? "").trim();
    const saved = await saveCustomBagWorkoutForUser({
      userId: user.id,
      id: id || undefined,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      regions: String(formData.get("regions") ?? ""),
    });
    revalidatePath("/bagwork");
    redirect(`/bagwork/saved/${saved.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    if (typeof error === "object" && error && "digest" in error) throw error;
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteCustomBagWorkoutAction(formData: FormData) {
  const user = await requireBagworkUser();
  await deleteCustomBagWorkoutForUser(user.id, String(formData.get("id") ?? ""));
  revalidatePath("/bagwork");
  redirect("/bagwork");
}

export async function logBagworkSessionAction(input: {
  workoutKey: string;
  rounds: number;
  workSeconds: number;
  notes: string;
  rpe: number | null;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  try {
    const user = await requireBagworkUser();
    const session = await logBagworkSessionForUser({
      userId: user.id,
      workoutKey: input.workoutKey,
      rounds: input.rounds,
      workSeconds: input.workSeconds,
      notes: input.notes ?? "",
      rpe: parseSessionRpe(input.rpe),
    });
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath("/home");
    return { ok: true, sessionId: session.id };
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    if (error instanceof AppError && error.code === "AUTH") {
      return { ok: false, error: "Sign in to log the session." };
    }
    return { ok: false, error: publicErrorMessage(error) };
  }
}
