"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { requireStaffOrThrow } from "@/lib/roles";
import {
  createHelpRequest,
  isHelpStatus,
  setHelpRequestStatus,
} from "@/lib/help";
import { publicErrorMessage } from "@/lib/errors";

export type HelpActionState = { error?: string; success?: string };

export async function createHelpRequestAction(
  _prev: HelpActionState,
  formData: FormData,
): Promise<HelpActionState> {
  try {
    const user = await requireUserOrThrow();
    await createHelpRequest({
      memberUserId: user.id,
      topic: String(formData.get("topic") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/home");
    revalidatePath("/coach");
    revalidatePath("/staff/help");
    return { success: "Request sent. Status starts as open — not a 24/7 promise." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function updateHelpRequestStatusAction(formData: FormData) {
  const staff = await requireStaffOrThrow();
  const statusRaw = String(formData.get("status") ?? "");
  if (!isHelpStatus(statusRaw)) {
    return;
  }
  await setHelpRequestStatus({
    staffUserId: staff.id,
    staffRole: staff.role,
    requestId: String(formData.get("requestId") ?? ""),
    status: statusRaw,
  });
  revalidatePath("/staff/help");
  revalidatePath("/staff/reports");
  revalidatePath("/home");
}
