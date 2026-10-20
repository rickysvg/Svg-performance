"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAdminOrThrow } from "@/lib/admin-access";
import {
  announcementResultLine,
  deliverAnnouncement,
  validateAnnouncementDraft,
} from "@/lib/announcements";
import { publicErrorMessage } from "@/lib/errors";

export type AnnouncementActionState = { error?: string; success?: string };

export async function sendAnnouncementAction(
  _prev: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  try {
    await requireDashboardAdminOrThrow();
    const parsed = validateAnnouncementDraft({
      confirm: String(formData.get("confirm") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      channel: String(formData.get("channel") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    if (!parsed.ok) return { error: parsed.error };
    const result = await deliverAnnouncement(parsed.draft);
    if (!result.ok) return { error: result.error };
    revalidatePath("/admin/announcements");
    return { success: announcementResultLine(result) };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
