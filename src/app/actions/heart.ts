"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { publicErrorMessage } from "@/lib/errors";
import {
  createRestingSampleForUser,
  createWorkoutHrForUser,
  deleteRestingSampleForUser,
  deleteWorkoutHrForUser,
  disconnectPolarConnectionForUser,
  importHeartCsvForUser,
  loadDemoHeartDataForUser,
  syncPolarForUser,
} from "@/lib/heart";

export type HeartActionState = { error?: string; success?: string };

function parseDate(raw: string) {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`);
  }
  return new Date(trimmed);
}

function revalidateHeart() {
  revalidatePath("/heart");
  revalidatePath("/progress");
  revalidatePath("/home");
}

export async function saveRestingHrAction(
  _prev: HeartActionState,
  formData: FormData,
): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    await createRestingSampleForUser(user.id, {
      bpm: Number(formData.get("bpm") ?? ""),
      recordedAt: parseDate(String(formData.get("recordedAt") ?? "")),
      source: "manual",
    });
    revalidateHeart();
    return { success: "Resting HR saved. Typed by you — not a live watch stream." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function saveWorkoutHrAction(
  _prev: HeartActionState,
  formData: FormData,
): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    const startedAt = parseDate(String(formData.get("startedAt") ?? ""));
    const endedRaw = String(formData.get("endedAt") ?? "").trim();
    const endedAt = endedRaw ? parseDate(endedRaw) : new Date(startedAt.getTime() + 45 * 60 * 1000);
    await createWorkoutHrForUser(user.id, {
      workoutSessionId: String(formData.get("workoutSessionId") ?? "") || null,
      startedAt,
      endedAt,
      avgBpm: Number(formData.get("avgBpm") ?? ""),
      maxBpm: Number(formData.get("maxBpm") ?? ""),
      source: "manual",
      zone1Seconds: Number(formData.get("zone1Seconds") ?? 0),
      zone2Seconds: Number(formData.get("zone2Seconds") ?? 0),
      zone3Seconds: Number(formData.get("zone3Seconds") ?? 0),
      zone4Seconds: Number(formData.get("zone4Seconds") ?? 0),
      zone5Seconds: Number(formData.get("zone5Seconds") ?? 0),
    });
    revalidateHeart();
    revalidatePath(`/training/log/${String(formData.get("workoutSessionId") ?? "")}`);
    return { success: "Workout HR saved. Manual avg/max — not a live device stream." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function importHeartCsvAction(
  _prev: HeartActionState,
  formData: FormData,
): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    const uploaded = formData.get("file");
    const pasted = String(formData.get("csv") ?? "");
    let csv = pasted;
    if (uploaded instanceof Blob && uploaded.size > 0) {
      csv = await uploaded.text();
    }
    const result = await importHeartCsvForUser(user.id, csv);
    revalidateHeart();
    return {
      success: `Imported ${result.resting} resting and ${result.workouts} workout row(s). Labeled import — Apple Watch is not connected on the web.`,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function loadDemoHeartAction(
  _formData?: FormData,
): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    const result = await loadDemoHeartDataForUser(user.id);
    revalidateHeart();
    if (!result.created) {
      return { success: "DEMO heart-rate samples are already on this account." };
    }
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/heart?demo=1");
}

export async function syncPolarAction(_formData?: FormData): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    const result = await syncPolarForUser(user.id);
    revalidateHeart();
    return {
      success: `Pulled ${result.workouts} Polar workout(s) and ${result.resting} overnight HR sample(s).`,
    };
  } catch (error) {
    revalidatePath("/heart");
    return { error: publicErrorMessage(error) };
  }
}

export async function disconnectPolarAction(
  _formData?: FormData,
): Promise<HeartActionState> {
  try {
    const user = await requireUserOrThrow();
    await disconnectPolarConnectionForUser(user.id);
    revalidateHeart();
    return { success: "Polar disconnected on this preview." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteRestingHrAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteRestingSampleForUser(String(formData.get("sampleId") ?? ""), user.id);
  revalidateHeart();
}

export async function deleteWorkoutHrAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteWorkoutHrForUser(String(formData.get("sessionId") ?? ""), user.id);
  revalidateHeart();
}
