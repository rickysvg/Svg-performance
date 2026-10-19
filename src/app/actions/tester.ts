"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { createTesterInvite, redeemTesterCode } from "@/lib/tester";
import { publicErrorMessage } from "@/lib/errors";

export type TesterActionState = { error?: string; success?: string; code?: string };

function refreshTesterPaths() {
  revalidatePath("/admin/testers");
  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/plan");
  revalidatePath("/pricing");
  revalidatePath("/home");
}

export async function createTesterCodeAction(
  _prev: TesterActionState,
  formData: FormData,
): Promise<TesterActionState> {
  try {
    const actor = await requireUserOrThrow();
    const maxUses = Number(formData.get("maxUses"));
    const row = await createTesterInvite({
      actor,
      maxUses,
      note: String(formData.get("note") ?? ""),
    });
    refreshTesterPaths();
    return {
      success: `Code ${row.code} is ready. ${row.maxUses} ${row.maxUses === 1 ? "use" : "uses"}.`,
      code: row.code,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function redeemTesterCodeAction(
  _prev: TesterActionState,
  formData: FormData,
): Promise<TesterActionState> {
  try {
    const user = await requireUserOrThrow();
    const row = await redeemTesterCode(user.id, String(formData.get("code") ?? ""));
    refreshTesterPaths();
    return {
      success: `Tester code ${row.code} applied. Full Pro until Nov 16. No card and no billing.`,
      code: row.code,
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
