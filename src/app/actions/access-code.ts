"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireDashboardAdminOrThrow } from "@/lib/admin-access";
import {
  createProAccessCode,
  parseAccessCodeDuration,
  redeemProAccessCode,
  revokeProAccessCode,
} from "@/lib/access-codes";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";

export type AccessCodeActionState = { error?: string; success?: string };

function refreshAccessCodePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/access-codes");
  revalidatePath("/admin/members");
  revalidatePath("/plan");
  revalidatePath("/profile");
  revalidatePath("/pricing");
}

async function clientAddress() {
  try {
    const incoming = await headers();
    const forwarded = incoming.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
    return incoming.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function createAccessCodeAction(
  _prev: AccessCodeActionState,
  formData: FormData,
): Promise<AccessCodeActionState> {
  try {
    const admin = await requireDashboardAdminOrThrow();
    const created = await createProAccessCode({
      actor: admin,
      label: String(formData.get("label") ?? ""),
      emailLock: String(formData.get("emailLock") ?? ""),
      durationDays: parseAccessCodeDuration(String(formData.get("durationDays") ?? "")),
    });
    refreshAccessCodePaths();
    return { success: `Code ${created.code} is ready. Copy it from the list.` };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function revokeAccessCodeAction(formData: FormData) {
  const admin = await requireDashboardAdminOrThrow();
  await revokeProAccessCode({
    actor: admin,
    codeId: String(formData.get("codeId") ?? ""),
  });
  refreshAccessCodePaths();
}

export async function redeemAccessCodeAction(
  _prev: AccessCodeActionState,
  formData: FormData,
): Promise<AccessCodeActionState> {
  try {
    const user = await requireUserOrThrow();
    await redeemProAccessCode({
      userId: user.id,
      email: user.email,
      code: String(formData.get("code") ?? ""),
      rateKeys: [`user:${user.id}`, `email:${user.email}`, `ip:${await clientAddress()}`],
    });
    refreshAccessCodePaths();
    return { success: "Pro is on this account. No card was charged." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
