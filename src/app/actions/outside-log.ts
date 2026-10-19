"use server";

import { revalidatePath } from "next/cache";
import { saveSparringLog } from "@/lib/outside-log";
import { writeRecoveryCheckIn } from "@/lib/recovery-ease";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";

export type SparringLogState = {
  error?: string;
  saved?: boolean;
  checkIn?: string;
  coachName?: string;
  coachImage?: string;
  easeNote?: string;
};

function integer(raw: FormDataEntryValue | null) {
  const value = Number(String(raw ?? "").trim());
  return Number.isFinite(value) ? Math.round(value) : Number.NaN;
}

export async function saveSparringLogAction(
  _prev: SparringLogState,
  formData: FormData,
): Promise<SparringLogState> {
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const log = await saveSparringLog(user.id, {
      dateKey: String(formData.get("dateKey") ?? ""),
      weekday: String(formData.get("weekday") ?? ""),
      rounds: integer(formData.get("rounds")),
      minutesPerRound: integer(formData.get("minutesPerRound")),
      intensity: String(formData.get("intensity") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      sessionRating: integer(formData.get("sessionRating")),
      bodyRating: integer(formData.get("bodyRating")),
      soreSpots: formData.getAll("soreSpots").map(String),
      timeZone,
    });
    const checkIn = await writeRecoveryCheckIn(user.id, log);
    revalidatePath("/home");
    revalidatePath("/sparring");
    revalidatePath("/training");
    revalidatePath("/training/calendar");
    revalidatePath("/progress");
    revalidatePath("/coach");
    return {
      saved: true,
      checkIn: checkIn?.message,
      coachName: checkIn?.coachName,
      coachImage: checkIn?.coachImage,
      easeNote: checkIn?.easeNote,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
