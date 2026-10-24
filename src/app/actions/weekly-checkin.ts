"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { optionalBodyFatPercent, parseOneDecimal } from "@/lib/body-metrics";
import { publicErrorMessage } from "@/lib/errors";
import {
  isWeeklyCheckInCoach,
  markCheckInReviewed,
  saveCheckInPrefs,
  saveCheckInReply,
  setWeeklyCheckInOverride,
  submitWeeklyCheckIn,
} from "@/lib/weekly-checkin";

export type CheckInActionState = { error?: string; success?: string };

function refresh() {
  revalidatePath("/checkin");
  revalidatePath("/home");
  revalidatePath("/progress");
  revalidatePath("/coach/checkins");
}

export async function submitWeeklyCheckInAction(
  _prev: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const file = formData.get("clip");
    const video =
      file instanceof File && file.size > 0
        ? {
            bytes: new Uint8Array(await file.arrayBuffer()),
            claimedType: file.type,
            durationSeconds: Number(formData.get("durationSeconds") ?? ""),
          }
        : null;
    const regions = String(formData.get("regions") ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    await submitWeeklyCheckIn({
      userId: user.id,
      now: new Date(),
      timeZone,
      bodyweightLb: parseOneDecimal(formData.get("bodyweightLb")),
      sleepQuality: Number(formData.get("sleepQuality") ?? ""),
      energy: Number(formData.get("energy") ?? ""),
      stress: Number(formData.get("stress") ?? ""),
      regions,
      sorenessNotes: String(formData.get("sorenessNotes") ?? ""),
      wins: String(formData.get("wins") ?? ""),
      struggles: String(formData.get("struggles") ?? ""),
      memberNotes: String(formData.get("memberNotes") ?? ""),
      bodyFatPercent: optionalBodyFatPercent(formData.get("bodyFatPercent")),
      video,
    });
    refresh();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/checkin?sent=1");
}

export async function saveCheckInPrefsAction(
  _prev: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  try {
    const user = await requireUserOrThrow();
    const [weekday, minuteOfDay] = String(formData.get("when") ?? "0:1080").split(":");
    await saveCheckInPrefs(user.id, Number(weekday), Number(minuteOfDay));
    refresh();
    return { success: "Reminder time saved." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

async function requireCoach() {
  const user = await requireUserOrThrow();
  if (!isWeeklyCheckInCoach(user)) {
    return { user: null, error: "Only an admin can review weekly check-ins." as const };
  }
  return { user, error: null };
}

export async function coachCheckInAction(
  _prev: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  try {
    const { user, error } = await requireCoach();
    if (!user) return { error: error ?? "Only an admin can review weekly check-ins." };
    const checkInId = String(formData.get("checkInId") ?? "");
    const reply = String(formData.get("reply") ?? "");
    const intent = String(formData.get("intent") ?? "");
    if (intent === "review") {
      await markCheckInReviewed({ actor: user, checkInId, reply });
      refresh();
      return { success: "Marked reviewed." };
    }
    if (intent === "save") {
      await saveCheckInReply({ actor: user, checkInId, reply, send: false });
      refresh();
      return { success: "Edit saved." };
    }
    await saveCheckInReply({ actor: user, checkInId, reply, send: true });
    refresh();
    return { success: "Reply sent." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function setCheckInOverrideAction(
  _prev: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  try {
    const { user, error } = await requireCoach();
    if (!user) return { error: error ?? "Only an admin can turn on weekly check-ins." };
    const email = String(formData.get("email") ?? "");
    const enabled = String(formData.get("enabled") ?? "") === "1";
    const result = await setWeeklyCheckInOverride({ actor: user, email, enabled });
    refresh();
    return {
      success: enabled
        ? `Weekly check-ins are on for ${result.email}.`
        : `Weekly check-ins override is off for ${result.email}.`,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
