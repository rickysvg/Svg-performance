"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { publicErrorMessage } from "@/lib/errors";
import {
  createBodyMetricForUser,
  deleteBodyMetricForUser,
  deletePhotoPlaceholderForUser,
  upsertPhotoPlaceholderForUser,
} from "@/lib/body-metrics";
import {
  createProgressPhotoForUser,
  deleteProgressPhotoForUser,
  updateProgressPhotoForUser,
} from "@/lib/progress-photos";

export type BodyMetricActionState = { error?: string; success?: string };

function parseRecordedAt(raw: string) {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`);
  }
  return new Date(trimmed);
}

export async function saveBodyMetricAction(
  _prev: BodyMetricActionState,
  formData: FormData,
): Promise<BodyMetricActionState> {
  try {
    const user = await requireUserOrThrow();
    await createBodyMetricForUser(user.id, {
      kind: String(formData.get("kind") ?? ""),
      value: Number(formData.get("value") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      recordedAt: parseRecordedAt(String(formData.get("recordedAt") ?? "")),
      notes: String(formData.get("notes") ?? ""),
    });
    revalidatePath("/progress");
    revalidatePath("/home");
    return { success: "Metric saved. This is a number you typed — not a watch or wearable." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteBodyMetricAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteBodyMetricForUser(String(formData.get("metricId") ?? ""), user.id);
  revalidatePath("/progress");
  revalidatePath("/home");
}

export async function savePhotoPlaceholderAction(
  _prev: BodyMetricActionState,
  formData: FormData,
): Promise<BodyMetricActionState> {
  try {
    const user = await requireUserOrThrow();
    await upsertPhotoPlaceholderForUser(user.id, {
      slot: String(formData.get("slot") ?? ""),
      caption: String(formData.get("caption") ?? ""),
      recordedAt: parseRecordedAt(String(formData.get("recordedAt") ?? "")),
    });
    revalidatePath("/progress");
    return { success: "Placeholder saved. No photo file was uploaded." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deletePhotoPlaceholderAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deletePhotoPlaceholderForUser(String(formData.get("photoId") ?? ""), user.id);
  revalidatePath("/progress");
}

export async function uploadProgressPhotoAction(
  _prev: BodyMetricActionState,
  formData: FormData,
): Promise<BodyMetricActionState> {
  try {
    const user = await requireUserOrThrow();
    const uploaded = formData.get("file");
    if (!(uploaded instanceof Blob) || uploaded.size === 0) {
      return { error: "Choose a jpeg, png, or webp photo." };
    }
    const bytes = new Uint8Array(await uploaded.arrayBuffer());
    await createProgressPhotoForUser(user.id, {
      bytes,
      claimedType: uploaded.type,
      caption: String(formData.get("caption") ?? ""),
      recordedAt: parseRecordedAt(String(formData.get("recordedAt") ?? "")),
    });
    revalidatePath("/progress");
    revalidatePath("/home");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/progress?celebrate=photo");
}

export async function updateProgressPhotoAction(
  _prev: BodyMetricActionState,
  formData: FormData,
): Promise<BodyMetricActionState> {
  try {
    const user = await requireUserOrThrow();
    await updateProgressPhotoForUser(String(formData.get("photoId") ?? ""), user.id, {
      caption: String(formData.get("caption") ?? ""),
      recordedAt: parseRecordedAt(String(formData.get("recordedAt") ?? "")),
    });
    revalidatePath("/progress");
    revalidatePath(`/progress/photos/${String(formData.get("photoId") ?? "")}`);
    return { success: "Caption and date updated." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteProgressPhotoAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteProgressPhotoForUser(String(formData.get("photoId") ?? ""), user.id);
  revalidatePath("/progress");
  revalidatePath("/home");
}
