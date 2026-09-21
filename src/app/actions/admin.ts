"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { setGymMembershipVerified } from "@/lib/admin";
import { assignPlanForPilot } from "@/lib/billing";
import { markCreditUsed } from "@/lib/credits";
import { setBookingStatus } from "@/lib/bookings";
import { publicErrorMessage } from "@/lib/errors";

export type AdminActionState = { error?: string; success?: string };

function refreshAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/plan");
  revalidatePath("/book");
}

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
    refreshAdminPaths();
    return { success: "Gym verification updated." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function assignPlanAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    const row = await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: String(formData.get("targetUserId") ?? ""),
      plan: String(formData.get("plan") ?? ""),
    });
    refreshAdminPaths();
    return { success: `Assigned ${row.label} for the 30-day pilot window.` };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function markCreditUsedAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await markCreditUsed({
      actorUserId: admin.id,
      actorRole: admin.role,
      targetUserId: String(formData.get("targetUserId") ?? ""),
      kind: String(formData.get("kind") ?? ""),
    });
    refreshAdminPaths();
    return { success: "Marked one credit used for this billing month." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function setBookingStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await setBookingStatus({
      adminUserId: admin.id,
      requestId: String(formData.get("requestId") ?? ""),
      status: String(formData.get("status") ?? ""),
    });
    refreshAdminPaths();
    return { success: "Booking request updated." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
