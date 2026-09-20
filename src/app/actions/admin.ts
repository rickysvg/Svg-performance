"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { setGymMembershipVerified } from "@/lib/admin";
import { publicErrorMessage } from "@/lib/errors";

export type AdminActionState = { error?: string; success?: string };

export async function verifyGymMemberAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await setGymMembershipVerified({
      adminUserId: admin.id,
      targetUserId: String(formData.get("targetUserId") ?? ""),
      verified: formData.get("verified") === "on",
    });
    revalidatePath("/admin");
    revalidatePath("/pricing");
    return { success: "Gym verification updated." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
