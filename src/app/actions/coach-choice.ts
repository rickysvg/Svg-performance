"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dismissCoachPromptForUser, saveCoachChoiceForUser } from "@/lib/coach-choice";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type CoachChoiceState = { error?: string; success?: string };

function safeOnboardingNext(raw: string) {
  if (raw === "/onboarding/deeper") return raw;
  return "";
}

export async function saveCoachChoiceAction(
  _prev: CoachChoiceState,
  formData: FormData,
): Promise<CoachChoiceState> {
  const next = safeOnboardingNext(String(formData.get("next") ?? ""));
  try {
    const user = await requireUserOrThrow();
    await saveCoachChoiceForUser(user.id, {
      coachId: String(formData.get("aiCoachId") ?? ""),
      coachingStyle: String(formData.get("coachingStyle") ?? ""),
    });
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  revalidatePath("/", "layout");
  if (next) redirect(next);
  return { success: "Coach saved." };
}

export async function dismissCoachPromptAction() {
  const user = await requireUserOrThrow();
  await dismissCoachPromptForUser(user.id);
  revalidatePath("/", "layout");
}
