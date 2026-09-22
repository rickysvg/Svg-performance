"use server";

import { redirect } from "next/navigation";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type OnboardingActionState = { error?: string };

function optionalNumber(raw: string) {
  const value = raw.trim();
  if (value === "") return null;
  return Number(value);
}

export async function completeOnboardingAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const user = await requireUserOrThrow();
    await completeOnboardingForUser(user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      goalKey: String(formData.get("goalKey") ?? ""),
      goalNote: String(formData.get("goalNote") ?? ""),
      experienceLevel: String(formData.get("experienceLevel") ?? ""),
      primaryFocus: String(formData.get("primaryFocus") ?? ""),
      equipment: formData.getAll("equipment").map(String),
      weeklyAvailability: formData.getAll("weeklyAvailability").map(String),
      sessionsPerWeek: optionalNumber(String(formData.get("sessionsPerWeek") ?? "")),
      preferredUnits: String(formData.get("preferredUnits") ?? "lb"),
      trainingLimitations: String(formData.get("trainingLimitations") ?? ""),
      foodPreferences: String(formData.get("foodPreferences") ?? ""),
      allergies: String(formData.get("allergies") ?? ""),
    });
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/home");
}
