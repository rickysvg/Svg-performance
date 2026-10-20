"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { cancelFightCampForUser, saveFightCampForUser } from "@/lib/fight-camp";
import { publicErrorMessage } from "@/lib/errors";

export type CampActionState = { error?: string; saved?: boolean };

function refreshCamp() {
  revalidatePath("/fight-camp");
  revalidatePath("/home");
  revalidatePath("/training");
}

function nextAfterCamp(formData: FormData) {
  return String(formData.get("next") ?? "") === "/training" ? "/training" : "/fight-camp";
}

export async function saveFightCampAction(
  _prev: CampActionState,
  formData: FormData,
): Promise<CampActionState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const next = nextAfterCamp(formData);
    const weightClass = String(formData.get("weightClass") ?? "");
    if (next === "/training" && !weightClass.trim()) {
      return { error: "Enter a weight class." };
    }
    await saveFightCampForUser(
      user.id,
      {
        fightDate: String(formData.get("fightDate") ?? ""),
        weightClass,
        discipline: String(formData.get("discipline") ?? ""),
      },
      new Date(),
      timeZone,
    );
    refreshCamp();
    if (next === "/training") return { saved: true };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(nextAfterCamp(formData));
}

export async function cancelFightCampAction(
  prev: CampActionState,
  formData: FormData,
): Promise<CampActionState> {
  void prev;
  const next = nextAfterCamp(formData);
  try {
    const user = await requireUserOrThrow();
    await cancelFightCampForUser(user.id);
    refreshCamp();
    if (next === "/training") return { saved: true };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(next);
}
