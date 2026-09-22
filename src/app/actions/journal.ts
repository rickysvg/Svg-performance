"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { createJournalEntryForUser, deleteJournalEntryForUser } from "@/lib/journal";
import { publicErrorMessage } from "@/lib/errors";

export type JournalActionState = { error?: string; success?: string };

export async function createJournalEntryAction(
  _prev: JournalActionState,
  formData: FormData,
): Promise<JournalActionState> {
  try {
    const user = await requireUserOrThrow();
    await createJournalEntryForUser(user.id, {
      kind: String(formData.get("kind") ?? ""),
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
    revalidatePath("/journal");
    revalidatePath("/home");
    revalidatePath("/paths");
    return { success: "Saved to your journal. Private to you until a coach writes feedback." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteJournalEntryAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteJournalEntryForUser(user.id, String(formData.get("entryId") ?? ""));
  revalidatePath("/journal");
}
