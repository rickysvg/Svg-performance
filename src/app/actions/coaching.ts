"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrThrow } from "@/lib/roles";
import { addJournalFeedback } from "@/lib/journal";
import { addCoachingAdjustment, upsertWeeklyCoachComment } from "@/lib/weekly-report";
import { setBookingNextSteps } from "@/lib/bookings";
import { publicErrorMessage } from "@/lib/errors";

export type CoachingActionState = { error?: string; success?: string };

function refreshCoaching(memberUserId: string) {
  revalidatePath("/staff/coaching");
  revalidatePath("/staff/reports");
  revalidatePath("/report");
  revalidatePath("/journal");
  revalidatePath("/book");
  revalidatePath("/home");
  revalidatePath("/admin/plans");
  void memberUserId;
}

export async function saveWeeklyCommentAction(
  _prev: CoachingActionState,
  formData: FormData,
): Promise<CoachingActionState> {
  try {
    const staff = await requireStaffOrThrow();
    await upsertWeeklyCoachComment({
      staffUserId: staff.id,
      staffRole: staff.role,
      memberUserId: String(formData.get("memberUserId") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    refreshCoaching(String(formData.get("memberUserId") ?? ""));
    return { success: "Comment saved. Empty until you write it — we do not invent Ricky’s voice." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function addAdjustmentAction(
  _prev: CoachingActionState,
  formData: FormData,
): Promise<CoachingActionState> {
  try {
    const staff = await requireStaffOrThrow();
    await addCoachingAdjustment({
      staffUserId: staff.id,
      staffRole: staff.role,
      memberUserId: String(formData.get("memberUserId") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    refreshCoaching(String(formData.get("memberUserId") ?? ""));
    return { success: "Adjustment logged." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function addJournalFeedbackAction(
  _prev: CoachingActionState,
  formData: FormData,
): Promise<CoachingActionState> {
  try {
    const staff = await requireStaffOrThrow();
    await addJournalFeedback({
      staffUserId: staff.id,
      staffRole: staff.role,
      entryId: String(formData.get("entryId") ?? ""),
      body: String(formData.get("body") ?? ""),
      actionItems: String(formData.get("actionItems") ?? ""),
    });
    refreshCoaching("");
    return { success: "Feedback saved for the member to read." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function saveBookingNextStepsAction(
  _prev: CoachingActionState,
  formData: FormData,
): Promise<CoachingActionState> {
  try {
    const staff = await requireStaffOrThrow();
    await setBookingNextSteps({
      staffUserId: staff.id,
      staffRole: staff.role,
      requestId: String(formData.get("requestId") ?? ""),
      nextSteps: String(formData.get("nextSteps") ?? ""),
    });
    refreshCoaching("");
    return { success: "Next steps saved. The member can read them on Book." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
