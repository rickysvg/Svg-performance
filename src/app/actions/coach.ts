"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { canUseMemberTools } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { sendCoachMessage } from "@/lib/coach/chat";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";
import { publicErrorMessage } from "@/lib/errors";

export type CoachActionState = { error?: string };

export async function sendCoachMessageAction(
  _prev: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  try {
    const user = await requireUserOrThrow();
    const access = await canUseMemberTools(user.id);
    if (!access.allowed) {
      throw new AppError(
        "PAYWALL",
        `${COACH_PUBLIC_NAME} is locked until Stripe TEST confirms payment.`,
      );
    }
    const profile = await getProfileForUser(user.id);
    const mentioned = String(formData.get("mentionedUserId") ?? "").trim();
    await sendCoachMessage({
      userId: user.id,
      message: String(formData.get("message") ?? ""),
      experienceLevel: profile?.experienceLevel,
      coachingTone: profile?.coachingTone,
      mentionedUserId: mentioned || undefined,
      topic: String(formData.get("topic") ?? ""),
      art: String(formData.get("art") ?? ""),
    });
    revalidatePath("/coach");
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
