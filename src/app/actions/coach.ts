"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { consumeAiUse, AiCapError } from "@/lib/ai-usage";
import { canUseCoachChat, COACH_CHAT_LOCKED } from "@/lib/entitlements";
import { sendCoachMessage } from "@/lib/coach/chat";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";
import { publicErrorMessage } from "@/lib/errors";

export type CoachActionState = { error?: string };

export async function sendCoachMessageAction(
  _prev: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  try {
    const user = await requireUserOrThrow();
    if (!(await canUseCoachChat(user))) {
      throw new AiCapError("locked", COACH_CHAT_LOCKED);
    }
    await consumeAiUse({ userId: user.id, kind: "message", surface: "chat" });
    const profile = await getProfileForUser(user.id);
    const coach = resolveAiCoach(profile?.aiCoachId);
    const style = resolveCoachingStyle(profile?.coachingStyle);
    const mentioned = String(formData.get("mentionedUserId") ?? "").trim();
    await sendCoachMessage({
      userId: user.id,
      message: String(formData.get("message") ?? ""),
      experienceLevel: profile?.experienceLevel,
      coachingTone: profile?.coachingTone,
      coachingStyle: style.value,
      coachName: coach.name,
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
