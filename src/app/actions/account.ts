"use server";

import { redirect } from "next/navigation";
import { deleteAccountForUser } from "@/lib/account-data";
import { publicErrorMessage } from "@/lib/errors";
import { clearSessionCookie, requireUserOrThrow, readSessionToken } from "@/lib/session";
import { destroySession } from "@/lib/auth";

export type DeleteAccountState = { error?: string };

export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  try {
    const user = await requireUserOrThrow();
    await deleteAccountForUser(user, String(formData.get("confirmation") ?? ""));
    await destroySession(await readSessionToken());
    await clearSessionCookie();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/?deleted=1");
}
