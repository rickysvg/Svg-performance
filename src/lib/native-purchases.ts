"use client";

import { nativePlatform, type NativePlatform } from "@/lib/native-app";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

type PurchasesModule = typeof import("@revenuecat/purchases-capacitor").Purchases;

let configuredFor: string | null = null;

function publicKey(platform: NativePlatform) {
  const value =
    platform === "ios"
      ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  return value?.trim() ?? "";
}

async function purchases(): Promise<PurchasesModule | null> {
  const platform = nativePlatform();
  if (!platform) return null;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases;
}

export async function configurePurchases(userId: string) {
  const platform = nativePlatform();
  const apiKey = platform ? publicKey(platform) : "";
  if (!platform || !apiKey || !userId) return false;
  if (configuredFor === userId) return true;
  const Purchases = await purchases();
  if (!Purchases) return false;
  await Purchases.configure({ apiKey, appUserID: userId });
  configuredFor = userId;
  return true;
}

export async function logOutPurchases() {
  if (!configuredFor) return;
  configuredFor = null;
  const Purchases = await purchases();
  if (!Purchases) return;
  await Purchases.logOut().catch(() => undefined);
}

export type ProPackageView = {
  id: string;
  title: string;
  period: string;
  priceString: string;
  pkg: PurchasesPackage;
};

function periodLabel(period: string | null, packageType: string) {
  if (period === "P1M" || packageType === "MONTHLY") return "1 month";
  if (period === "P1Y" || packageType === "ANNUAL") return "1 year";
  if (packageType === "MONTHLY") return "1 month";
  if (packageType === "ANNUAL") return "1 year";
  return "subscription period";
}

export async function getProOffering(): Promise<ProPackageView[]> {
  const Purchases = await purchases();
  if (!Purchases) return [];
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  const packages = [current.monthly, current.annual].filter((pkg): pkg is PurchasesPackage => Boolean(pkg));
  const list = packages.length > 0 ? packages : current.availablePackages;
  return list.map((pkg) => ({
    id: pkg.identifier,
    title: pkg.product.title || "SVG Pro",
    period: periodLabel(pkg.product.subscriptionPeriod, pkg.packageType),
    priceString: pkg.product.priceString,
    pkg,
  }));
}

export type PurchaseOutcome = "purchased" | "cancelled" | "pending" | "error";

export async function purchasePackage(pkg: PurchasesPackage): Promise<{ outcome: PurchaseOutcome; message: string }> {
  const Purchases = await purchases();
  if (!Purchases) return { outcome: "error", message: "Subscriptions aren't available in this build." };
  try {
    await Purchases.purchasePackage({ aPackage: pkg });
    return { outcome: "purchased", message: "" };
  } catch (error) {
    const record = error as { code?: string | number; userCancelled?: boolean | null; message?: string };
    const code = String(record.code ?? "");
    if (record.userCancelled || code === "1") return { outcome: "cancelled", message: "" };
    if (code === "20") return { outcome: "pending", message: "Purchase pending. Access opens when the store approves it." };
    return { outcome: "error", message: "The store couldn't complete that purchase." };
  }
}

export async function restorePurchases(): Promise<{ ok: boolean; message: string }> {
  const Purchases = await purchases();
  if (!Purchases) return { ok: false, message: "Restore isn't available in this build." };
  try {
    await Purchases.restorePurchases();
    return { ok: true, message: "Purchases restored." };
  } catch {
    return { ok: false, message: "Couldn't restore purchases. Try again." };
  }
}

/** Opens the store's subscription management. Never the website checkout. */
export async function manageSubscriptions() {
  const Purchases = await purchases();
  if (!Purchases) return false;
  const extra = Purchases as PurchasesModule & { showManageSubscriptions?: () => Promise<void> };
  if (typeof extra.showManageSubscriptions === "function") {
    await extra.showManageSubscriptions();
    return true;
  }
  const info = await Purchases.getCustomerInfo();
  const url =
    info.customerInfo.managementURL ||
    (nativePlatform() === "android"
      ? "https://play.google.com/store/account/subscriptions"
      : "https://apps.apple.com/account/subscriptions");
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export async function syncStorePurchase() {
  const response = await fetch("/api/revenuecat/sync", { method: "POST" });
  return response.ok;
}
