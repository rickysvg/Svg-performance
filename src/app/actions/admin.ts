"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { setGymMembershipVerified } from "@/lib/admin";
import { assignPlanForPilot } from "@/lib/billing";
import { markCreditUsed, restoreCredit } from "@/lib/credits";
import { setBookingStatus } from "@/lib/bookings";
import { createPilotInvite, deletePilotInvite } from "@/lib/invites";
import { publicErrorMessage } from "@/lib/errors";

export type AdminActionState = { error?: string; success?: string };

function refreshAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/invites");
  revalidatePath("/admin/queues");
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

export async function restoreCreditAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await restoreCredit({
      adminUserId: admin.id,
      targetUserId: String(formData.get("targetUserId") ?? ""),
      kind: String(formData.get("kind") ?? ""),
    });
    refreshAdminPaths();
    return { success: "Restored one credit for this billing month." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function createInviteAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const admin = await requireAdminOrThrow();
    await createPilotInvite({
      adminUserId: admin.id,
      email: String(formData.get("email") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    refreshAdminPaths();
    return { success: "Invite saved. Status stays invited until they create an account." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function deleteInviteAction(formData: FormData) {
  const admin = await requireAdminOrThrow();
  await deletePilotInvite(admin.id, String(formData.get("inviteId") ?? ""));
  refreshAdminPaths();
}
