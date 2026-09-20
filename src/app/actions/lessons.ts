"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { requireAdminOrThrow } from "@/lib/roles";
import { canUseMemberTools } from "@/lib/access";
import { AppError } from "@/lib/errors";
import {
  createLessonDraft,
  setLessonStatus,
  toggleLessonBookmark,
  toggleLessonComplete,
  updateLessonForAdmin,
  type LessonInput,
} from "@/lib/lessons";
import { publicErrorMessage } from "@/lib/errors";

export type LessonActionState = { error?: string; success?: string };

function readLessonInput(formData: FormData): LessonInput {
  return {
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    skillLevel: String(formData.get("skillLevel") ?? "beginner"),
    topic: String(formData.get("topic") ?? "stance"),
    coachName: String(formData.get("coachName") ?? ""),
    equipment: String(formData.get("equipment") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    drills: String(formData.get("drills") ?? ""),
    needsSupervision: formData.get("needsSupervision") === "on",
    supervisedNote: String(formData.get("supervisedNote") ?? ""),
    isDemo: formData.get("isDemo") !== "off",
  };
}

export async function toggleBookmarkAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    throw new AppError("PAYWALL", "Learn is locked until Stripe TEST confirms payment.");
  }
  await toggleLessonBookmark(user.id, String(formData.get("lessonId") ?? ""));
  revalidatePath("/learn");
}

export async function toggleCompleteAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    throw new AppError("PAYWALL", "Learn is locked until Stripe TEST confirms payment.");
  }
  await toggleLessonComplete(user.id, String(formData.get("lessonId") ?? ""));
  revalidatePath("/learn");
}

export async function saveLessonAction(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  try {
    await requireAdminOrThrow();
    const lessonId = String(formData.get("lessonId") ?? "");
    const input = readLessonInput(formData);
    if (lessonId) {
      await updateLessonForAdmin(lessonId, input);
    } else {
      await createLessonDraft(input);
    }
    revalidatePath("/learn");
    revalidatePath("/admin/lessons");
    return { success: "Lesson saved as draft or update." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function publishLessonAction(formData: FormData) {
  await requireAdminOrThrow();
  const status = String(formData.get("status") ?? "draft") === "published"
    ? "published"
    : "draft";
  await setLessonStatus(String(formData.get("lessonId") ?? ""), status);
  revalidatePath("/learn");
  revalidatePath("/admin/lessons");
}
