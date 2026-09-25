"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import {
  continueWithFreePlan,
  dismissThirdWorkoutCard,
  startTrialForUser,
} from "@/lib/trial";

export type TrialActionState = { error?: string };

function safeNext(raw: string) {
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")) {
    return raw;
  }
  return "/home";
}

export async function startTrialAction(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "/home"));
  try {
    const user = await requireUserOrThrow();
    await startTrialForUser(user.id);
  } catch (error) {
    throw new Error(publicErrorMessage(error));
  }
  revalidatePath("/");
  redirect(next);
}

export async function continueFreePlanAction(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? "/onboarding/deeper"));
  const user = await requireUserOrThrow();
  await continueWithFreePlan(user.id);
  revalidatePath("/");
  redirect(next);
}

export async function dismissThirdWorkoutCardAction() {
  const user = await requireUserOrThrow();
  await dismissThirdWorkoutCard(user.id);
  revalidatePath("/home");
}
