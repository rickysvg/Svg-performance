"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOrThrow } from "@/lib/roles";
import { requireUserOrThrow } from "@/lib/session";
import { createOrUpdateChallenge, enrollInChallenge } from "@/lib/challenges";
import { publicErrorMessage } from "@/lib/errors";

export type ChallengeActionState = { error?: string; success?: string };

export async function saveChallengeAction(
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await createOrUpdateChallenge({
      adminUserId: admin.id,
      title: String(formData.get("title") ?? ""),
      monthKey: String(formData.get("monthKey") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      beginnerGoalDays: Number(formData.get("beginnerGoalDays") ?? 8),
      advancedGoalDays: Number(formData.get("advancedGoalDays") ?? 16),
      active: formData.get("active") === "on",
      isDemo: formData.get("isDemo") === "on",
    });
    revalidatePath("/admin/challenges");
    revalidatePath("/challenges");
    revalidatePath("/home");
    return { success: "Challenge saved. Consistency scoring only — not heaviest lift." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function joinChallengeAction(
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  try {
    const user = await requireUserOrThrow();
    await enrollInChallenge(user.id, String(formData.get("track") ?? "beginner"));
    revalidatePath("/challenges");
    revalidatePath("/home");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/challenges");
}
