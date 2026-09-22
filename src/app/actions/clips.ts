"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { requireStaffOrThrow } from "@/lib/roles";
import {
  addClipTimestampNote,
  createTrainingClipForUser,
  deleteTrainingClipForUser,
  markClipFeedbackSeen,
} from "@/lib/clips";
import { publicErrorMessage } from "@/lib/errors";

export type ClipActionState = { error?: string; success?: string };

export async function uploadTrainingClipAction(
  _prev: ClipActionState,
  formData: FormData,
): Promise<ClipActionState> {
  try {
    const user = await requireUserOrThrow();
    const file = formData.get("clip");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose an mp4 or webm clip." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await createTrainingClipForUser({
      userId: user.id,
      title: String(formData.get("title") ?? ""),
      memberNote: String(formData.get("memberNote") ?? ""),
      bytes,
      claimedType: file.type,
    });
    revalidatePath("/clips");
    revalidatePath("/admin/queues");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/clips");
}

export async function deleteTrainingClipAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteTrainingClipForUser(user.id, String(formData.get("clipId") ?? ""));
  revalidatePath("/clips");
  redirect("/clips");
}

export async function addClipNoteAction(
  _prev: ClipActionState,
  formData: FormData,
): Promise<ClipActionState> {
  try {
    const staff = await requireStaffOrThrow();
    const clipId = String(formData.get("clipId") ?? "");
    await addClipTimestampNote({
      staffUserId: staff.id,
      staffRole: staff.role,
      clipId,
      timestamp: String(formData.get("timestamp") ?? ""),
      correction: String(formData.get("correction") ?? ""),
      drill: String(formData.get("drill") ?? ""),
    });
    revalidatePath(`/clips/${clipId}`);
    revalidatePath("/admin/queues");
    revalidatePath("/staff/coaching");
    return { success: "Timestamped note saved. SVG does not live-stream this clip." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function markClipFeedbackSeenAction(clipId: string) {
  const user = await requireUserOrThrow();
  await markClipFeedbackSeen(user.id, clipId);
}
