"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { canUseFormCheck, isFormCheckReviewer } from "@/lib/form-check-access";
import { FORM_CHECK_LOCKED_TITLE } from "@/lib/form-check-shared";
import {
  createFormCheckForUser,
  markFormCheckFeedbackSeen,
  markFormCheckInReview,
  saveFormCheckFeedback,
} from "@/lib/form-check";
import { ForbiddenError, publicErrorMessage } from "@/lib/errors";

export type FormCheckActionState = { error?: string };

function refreshFormCheck(checkId?: string) {
  revalidatePath("/form-check");
  revalidatePath("/home");
  revalidatePath("/admin/form-checks");
  if (checkId) revalidatePath(`/admin/form-checks`);
}

async function assertFormCheckMember() {
  const user = await requireUserOrThrow();
  if (!(await canUseFormCheck(user))) {
    throw new ForbiddenError(FORM_CHECK_LOCKED_TITLE);
  }
  return user;
}

export async function uploadFormCheckAction(
  _prev: FormCheckActionState,
  formData: FormData,
): Promise<FormCheckActionState> {
  try {
    const user = await assertFormCheckMember();
    const file = formData.get("clip");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose an mp4, mov, or webm clip." };
    }
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    await createFormCheckForUser({
      userId: user.id,
      movementId: String(formData.get("movement") ?? ""),
      customMovement: String(formData.get("customMovement") ?? ""),
      note: String(formData.get("note") ?? ""),
      durationSeconds: Number(formData.get("durationSeconds") ?? ""),
      bytes,
      claimedType: file.type,
      now: new Date(),
      timeZone,
    });
    refreshFormCheck();
  } catch (error) {
    if (error instanceof ForbiddenError) throw error;
    return { error: publicErrorMessage(error) };
  }
  redirect("/form-check");
}

export async function markFormCheckSeenAction() {
  const user = await assertFormCheckMember();
  await markFormCheckFeedbackSeen(user.id);
  revalidatePath("/home");
  revalidatePath("/form-check");
}

async function requireReviewer() {
  const user = await requireUserOrThrow();
  if (!isFormCheckReviewer(user)) {
    throw new ForbiddenError("Only an admin can review form checks.");
  }
  return user;
}

export async function markFormCheckInReviewAction(formData: FormData) {
  const actor = await requireReviewer();
  const checkId = String(formData.get("checkId") ?? "");
  await markFormCheckInReview({ actor, checkId });
  refreshFormCheck(checkId);
}

export async function saveFormCheckFeedbackAction(
  _prev: FormCheckActionState,
  formData: FormData,
): Promise<FormCheckActionState> {
  try {
    const actor = await requireReviewer();
    const checkId = String(formData.get("checkId") ?? "");
    await saveFormCheckFeedback({
      actor,
      checkId,
      feedback: String(formData.get("feedback") ?? ""),
    });
    refreshFormCheck(checkId);
  } catch (error) {
    if (error instanceof ForbiddenError) throw error;
    return { error: publicErrorMessage(error) };
  }
  redirect("/admin/form-checks");
}
