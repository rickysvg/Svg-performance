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
    await updateProfileForUser(user.id, {
      displayName: String(formData.get("displayName") ?? ""),
      goals: String(formData.get("goals") ?? ""),
      experienceLevel: String(formData.get("experienceLevel") ?? "beginner"),
      equipment: formData.getAll("equipment").map(String),
      weeklyAvailability: formData.getAll("weeklyAvailability").map(String),
      hoursPerWeek: hoursRaw === "" ? null : Number(hoursRaw),
      preferredUnits: String(formData.get("preferredUnits") ?? "lb"),
      claimsGymMembership: formData.get("claimsGymMembership") === "on",
    });
    revalidatePath("/home");
    revalidatePath("/profile");
    revalidatePath("/training");
    return { success: "Profile saved." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
