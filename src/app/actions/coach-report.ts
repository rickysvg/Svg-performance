"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { requireDashboardAdminOrThrow } from "@/lib/admin-access";
import { markCoachReplyReviewed, reportCoachReply } from "@/lib/coach-reply-report";
import { publicErrorMessage } from "@/lib/errors";

export type CoachReportState = { error?: string; success?: string };

export async function reportCoachReplyAction(
  _prev: CoachReportState,
  formData: FormData,
): Promise<CoachReportState> {
  try {
    const user = await requireUserOrThrow();
    const result = await reportCoachReply({
      userId: user.id,
      messageId: String(formData.get("messageId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    return {
      success: result.already
        ? "You already reported this reply. A coach will review it."
        : "Thanks, a coach will review this reply.",
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function markCoachReplyReviewedAction(formData: FormData) {
  await requireDashboardAdminOrThrow();
  await markCoachReplyReviewed(String(formData.get("reportId") ?? ""));
  revalidatePath("/admin/coach-reports");
}
