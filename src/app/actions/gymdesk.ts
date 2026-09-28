"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/lib/roles";
import { requireUserOrThrow } from "@/lib/session";
import { publicErrorMessage } from "@/lib/errors";
import { setGymMembershipOverride } from "@/lib/admin";
import { parseGymdeskCsv } from "@/lib/gymdesk/csv";
import { applyGymdeskCsv, previewGymdeskCsv, type CsvDiff } from "@/lib/gymdesk/csv-apply";
import { approveQueueItem, dismissQueueItem } from "@/lib/gymdesk/match";
import {
  confirmEmailVerificationCode,
  sendEmailVerificationCode,
} from "@/lib/gymdesk/email-code";

export type GymdeskActionState = {
  error?: string;
  success?: string;
  diff?: CsvDiff;
  parseErrors?: string[];
};

function refreshGymdesk() {
  revalidatePath("/admin");
  revalidatePath("/admin/gymdesk");
  revalidatePath("/profile");
  revalidatePath("/pricing");
  revalidatePath("/home");
}

async function clientIp() {
  try {
    const incoming = await headers();
    const forwarded = incoming.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
    return incoming.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function overrideGymMemberAction(
  _prev: GymdeskActionState,
  formData: FormData,
): Promise<GymdeskActionState> {
  try {
    const admin = await requireAdminOrThrow();
    const overrideRaw = String(formData.get("override") ?? "none");
    const override =
      overrideRaw === "force_on" || overrideRaw === "force_off" ? overrideRaw : "none";
    await setGymMembershipOverride({
      adminUserId: admin.id,
      targetUserId: String(formData.get("targetUserId") ?? ""),
      override,
      note: String(formData.get("note") ?? ""),
    });
    refreshGymdesk();
    return { success: "Membership override saved." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function gymdeskCsvAction(
  _prev: GymdeskActionState,
  formData: FormData,
): Promise<GymdeskActionState> {
  try {
    await requireAdminOrThrow();
    const intent = String(formData.get("intent") ?? "preview");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a Gymdesk member-list CSV first." };
    }
    const text = await file.text();
    const parsed = parseGymdeskCsv(text);
    if (parsed.rows.length === 0) {
      return { error: parsed.errors[0] ?? "CSV has no member rows.", parseErrors: parsed.errors };
    }
    if (intent === "apply") {
      const diff = await applyGymdeskCsv(parsed.rows);
      refreshGymdesk();
      return {
        success: `Roster updated from ${parsed.rows.length} rows. The CSV file was discarded.`,
        diff,
        parseErrors: parsed.errors,
      };
    }
    const diff = await previewGymdeskCsv(parsed.rows);
    return { diff, parseErrors: parsed.errors };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function approveGymdeskQueueAction(formData: FormData) {
  const admin = await requireAdminOrThrow();
  await approveQueueItem(admin.id, String(formData.get("queueId") ?? ""));
  refreshGymdesk();
}

export async function dismissGymdeskQueueAction(formData: FormData) {
  const admin = await requireAdminOrThrow();
  await dismissQueueItem(admin.id, String(formData.get("queueId") ?? ""));
  refreshGymdesk();
}

export type EmailCodeState = { error?: string; success?: string };

export async function sendEmailCodeAction(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  void formData;
  try {
    const user = await requireUserOrThrow();
    await sendEmailVerificationCode({
      userId: user.id,
      email: user.email,
      ip: await clientIp(),
    });
    return { success: "We sent a 6-digit code to your email. It expires in 15 minutes." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function confirmEmailCodeAction(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  try {
    const user = await requireUserOrThrow();
    const match = await confirmEmailVerificationCode({
      userId: user.id,
      code: String(formData.get("code") ?? ""),
    });
    revalidatePath("/verify-email");
    revalidatePath("/profile");
    revalidatePath("/onboarding/plan");
    revalidatePath("/home");
    if (match.kind === "verified") {
      return { success: "Email confirmed. You are matched to SVG MMA Academy records." };
    }
    if (match.kind === "suggested") {
      return {
        success:
          "Email confirmed. We sent a suggested match to the academy team for one-click review.",
      };
    }
    if (match.kind === "conflict") {
      return {
        success: "Email confirmed. A coach will review this match before member pricing applies.",
      };
    }
    return {
      success:
        "Email confirmed. No academy record matched yet. Member pricing stays off until we can match you.",
    };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
