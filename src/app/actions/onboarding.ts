"use server";

import { redirect } from "next/navigation";
import {
  completeOnboardingForUser,
  getOnboardingStatus,
  saveDeepOnboardingForUser,
} from "@/lib/onboarding";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type OnboardingActionState = { error?: string };

function optionalNumber(raw: string) {
  const value = raw.trim();
  if (value === "") return null;
  return Number(value);
}

function optionalDate(raw: string) {
  const value = raw.trim();
  if (value === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
  redirect("/onboarding/plan");
}

export async function skipDeepOnboardingAction() {
  const user = await requireUserOrThrow();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  redirect("/home");
}

export async function saveDeepOnboardingAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const user = await requireUserOrThrow();
    await saveDeepOnboardingForUser(user.id, {
      currentWeight: optionalNumber(String(formData.get("currentWeight") ?? "")),
      goalWeight: optionalNumber(String(formData.get("goalWeight") ?? "")),
      sessionLengthMin: optionalNumber(String(formData.get("sessionLengthMin") ?? "")),
      trainingLocation: String(formData.get("trainingLocation") ?? ""),
      competitionStatus: String(formData.get("competitionStatus") ?? ""),
      nextFightDate: optionalDate(String(formData.get("nextFightDate") ?? "")),
      coachingTone: String(formData.get("coachingTone") ?? ""),
      obstacles: formData.getAll("obstacles").map(String),
    });
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/home");
}
