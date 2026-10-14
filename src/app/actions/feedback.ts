"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireUserOrThrow } from "@/lib/session";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import {
  createMemberFeedback,
  setMemberFeedbackStatus,
} from "@/lib/feedback";
import { ForbiddenError, publicErrorMessage } from "@/lib/errors";

export type FeedbackActionState = { error?: string; savedAt?: number };

async function requestUserAgent() {
  try {
    const incoming = await headers();
    return incoming.get("user-agent") ?? "";
  } catch {
    return "";
  }
}

export async function submitFeedbackAction(
  _prev: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  try {
    const user = await requireUserOrThrow();
    const file = formData.get("screenshot");
    const bytes =
      file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
    await createMemberFeedback({
      userId: user.id,
      userEmail: user.email,
      type: String(formData.get("type") ?? ""),
      message: String(formData.get("message") ?? ""),
      route: String(formData.get("route") ?? ""),
      workoutId: String(formData.get("workoutId") ?? ""),
      userAgent: await requestUserAgent(),
      bytes,
      claimedType: file instanceof File ? file.type : undefined,
    });
    revalidatePath("/admin/feedback");
    return { savedAt: Date.now() };
  } catch (error) {
    return { error: publicErrorMessage(error), savedAt: _prev.savedAt };
  }
}

export async function setFeedbackStatusAction(formData: FormData) {
  const user = await requireUserOrThrow();
  if (!isFeedbackAdmin(user)) {
    throw new ForbiddenError("Only an admin can review member feedback.");
  }
  await setMemberFeedbackStatus({
    actor: user,
    feedbackId: String(formData.get("feedbackId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  revalidatePath("/admin/feedback");
}
