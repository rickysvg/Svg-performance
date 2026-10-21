"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDashboardAdminOrThrow } from "@/lib/admin-access";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { parseVipApplication, applyVipBilling, type VipBillingClient } from "@/lib/vip-coaching";
import {
  dismissVipUpsell,
  getVipCheckoutView,
  reviewVipApplication,
  submitVipApplication,
} from "@/lib/vip-store";

export type VipActionState = { error?: string; message?: string };

function refreshVip() {
  revalidatePath("/pricing");
  revalidatePath("/vip/apply");
  revalidatePath("/vip/checkout");
  revalidatePath("/admin");
  revalidatePath("/admin/vip");
  revalidatePath("/home");
  revalidatePath("/form-check");
  revalidatePath("/fight-camp");
}

export async function submitVipApplicationAction(
  _prev: VipActionState,
  formData: FormData,
): Promise<VipActionState> {
  const user = await requireUserOrThrow();
  const parsed = parseVipApplication({
    goals: String(formData.get("goals") ?? ""),
    experience: String(formData.get("experience") ?? ""),
    fightDate: String(formData.get("fightDate") ?? ""),
    noFight: formData.get("noFight") === "on",
    injuries: String(formData.get("injuries") ?? ""),
    availability: String(formData.get("availability") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };
  try {
    await submitVipApplication(user.id, parsed.value);
    refreshVip();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/vip/apply?sent=1");
}

export async function approveVipApplicationAction(
  _prev: VipActionState,
  formData: FormData,
): Promise<VipActionState> {
  const admin = await requireDashboardAdminOrThrow();
  try {
    await reviewVipApplication({
      applicationId: String(formData.get("applicationId") ?? ""),
      reviewerId: admin.id,
      decision: "approved",
    });
    refreshVip();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/admin/vip");
}

export async function declineVipApplicationAction(
  _prev: VipActionState,
  formData: FormData,
): Promise<VipActionState> {
  const admin = await requireDashboardAdminOrThrow();
  try {
    await reviewVipApplication({
      applicationId: String(formData.get("applicationId") ?? ""),
      reviewerId: admin.id,
      decision: "declined",
    });
    refreshVip();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/admin/vip");
}

export async function startVipCheckoutAction(
  prev: VipActionState,
  formData: FormData,
): Promise<VipActionState> {
  void prev;
  void formData;
  const user = await requireUserOrThrow();
  const view = await getVipCheckoutView(user.id);
  if (!view) return { error: "Checkout stays locked until Ricky approves your application." };
  const origin = process.env.APP_URL || "http://localhost:3000";
  let stripe = null;
  try {
    stripe = getStripe();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  const result = await applyVipBilling({
    stripe: stripe ? (stripe as unknown as VipBillingClient) : null,
    draft: view.draft,
    successUrl: `${origin}/vip/checkout?paid=1`,
    cancelUrl: `${origin}/vip/checkout`,
  });
  if (result.url) redirect(result.url);
  if (result.prorationApplied) {
    refreshVip();
    return { message: "The Pro credit was applied on the existing subscription." };
  }
  return {
    message:
      "Your approval is saved. Checkout is not live until STRIPE_PRICE_COACHING_MONTHLY is set. No charge was made.",
  };
}

export async function dismissVipUpsellAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await dismissVipUpsell(user.id, String(formData.get("trigger") ?? ""));
  refreshVip();
}
