"use server";

import { revalidatePath } from "next/cache";
import { updateProfileForUser } from "@/lib/profile";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type ProfileActionState = { error?: string; success?: string };

export async function saveProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const user = await requireUserOrThrow();
    const hoursRaw = String(formData.get("hoursPerWeek") ?? "").trim();
    const sessionsRaw = String(formData.get("sessionsPerWeek") ?? "").trim();
    const optionalNumber = (key: string) => {
      const raw = String(formData.get(key) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    };
    await updateProfileForUser(user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      goalKey: String(formData.get("goalKey") ?? ""),
      goalNote: String(formData.get("goalNote") ?? ""),
      experienceLevel: String(formData.get("experienceLevel") ?? "beginner"),
      primaryFocus: String(formData.get("primaryFocus") ?? ""),
      equipment: formData.getAll("equipment").map(String),
      weeklyAvailability: formData.getAll("weeklyAvailability").map(String),
      hoursPerWeek: hoursRaw === "" ? null : Number(hoursRaw),
      sessionsPerWeek: sessionsRaw === "" ? null : Number(sessionsRaw),
      preferredUnits: String(formData.get("preferredUnits") ?? "lb"),
      claimsGymMembership: formData.get("claimsGymMembership") === "on",
      foodPreferences: String(formData.get("foodPreferences") ?? ""),
      allergies: String(formData.get("allergies") ?? ""),
      trainingLimitations: String(formData.get("trainingLimitations") ?? ""),
      calorieTarget: optionalNumber("calorieTarget"),
      proteinTargetG: optionalNumber("proteinTargetG"),
      carbsTargetG: optionalNumber("carbsTargetG"),
      fatTargetG: optionalNumber("fatTargetG"),
    });
    revalidatePath("/home");
    revalidatePath("/profile");
    revalidatePath("/training");
    revalidatePath("/progress");
    return { success: "Profile saved." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
