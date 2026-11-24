"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { setAiCoachConsent } from "@/lib/coach/consent";
import { publicErrorMessage } from "@/lib/errors";

export type CoachConsentState = { error?: string; success?: string };

export async function setAiCoachConsentAction(agreed: boolean): Promise<CoachConsentState> {
  try {
    const user = await requireUserOrThrow();
    await setAiCoachConsent(user.id, agreed);
    revalidatePath("/coach");
    revalidatePath("/profile");
    return { success: agreed ? "SVG Coach can use your training context." : "SVG Coach will stay closed." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
