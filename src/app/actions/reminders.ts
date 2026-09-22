"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { saveReminderPrefs } from "@/lib/reminders";
import { publicErrorMessage } from "@/lib/errors";

export type ReminderActionState = { error?: string; success?: string };

export async function saveReminderPrefsAction(
  _prev: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  try {
    const user = await requireUserOrThrow();
    await saveReminderPrefs(user.id, {
      workoutEnabled: formData.get("workoutEnabled") === "on",
      foodEnabled: formData.get("foodEnabled") === "on",
      quoteEnabled: formData.get("quoteEnabled") === "on",
      bookingEnabled: formData.get("bookingEnabled") === "on",
      preferredHour: Number(formData.get("preferredHour") ?? 18),
      timezoneOffsetMinutes: Number(formData.get("timezoneOffsetMinutes") ?? 0),
    });
    revalidatePath("/profile");
    revalidatePath("/home");
    return { success: "Reminder settings saved. You can turn them off anytime." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
