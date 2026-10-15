"use server";

import { revalidatePath } from "next/cache";
import { saveSparringLog } from "@/lib/outside-log";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type SparringLogState = { error?: string; saved?: boolean };

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
    await saveSparringLog(user.id, {
      dateKey: String(formData.get("dateKey") ?? ""),
      weekday: String(formData.get("weekday") ?? ""),
      rounds: integer(formData.get("rounds")),
      minutesPerRound: integer(formData.get("minutesPerRound")),
      intensity: String(formData.get("intensity") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/progress");
  return { saved: true };
}
