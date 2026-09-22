"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { assignMemberToCoach } from "@/lib/reports";
import { publicErrorMessage } from "@/lib/errors";

export type StaffActionState = { error?: string; success?: string };

export async function assignCoachAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: String(formData.get("coachUserId") ?? ""),
      memberUserId: String(formData.get("memberUserId") ?? ""),
    });
    revalidatePath("/staff/reports");
    revalidatePath("/admin");
    return { success: "Coach assignment saved." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
