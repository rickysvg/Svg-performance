"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { enrollUserInPath, markPathStepComplete } from "@/lib/paths";
import { publicErrorMessage } from "@/lib/errors";

export type PathActionState = { error?: string; success?: string };

export async function enrollPathAction(
  _prev: PathActionState,
  formData: FormData,
): Promise<PathActionState> {
  try {
    const user = await requireUserOrThrow();
    const slug = String(formData.get("pathSlug") ?? "");
    await enrollUserInPath(user.id, slug);
    revalidatePath("/home");
    revalidatePath("/paths");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/paths/${String(formData.get("pathSlug") ?? "")}`);
}

export async function completePathStepAction(
  _prev: PathActionState,
  formData: FormData,
): Promise<PathActionState> {
  let celebrate = false;
  let slug = "";
  try {
    const user = await requireUserOrThrow();
    slug = String(formData.get("pathSlug") ?? "");
    const stepKey = String(formData.get("stepKey") ?? "");
    const result = await markPathStepComplete(user.id, slug, stepKey);
    celebrate = result.newlyCompleted;
    revalidatePath("/home");
    revalidatePath("/paths");
    revalidatePath(`/paths/${slug}`);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(celebrate ? `/paths/${slug}?celebrate=milestone` : `/paths/${slug}`);
}
