import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/timing-safe";

const SYNC_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "UNCANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_PAUSED",
  "SUBSCRIPTION_EXTENDED",
  "TRANSFER",
]);

const MONTHLY_PRODUCTS = new Set(["svg_pro_monthly", "svg_pro:monthly"]);
const ANNUAL_PRODUCTS = new Set(["svg_pro_annual", "svg_pro:annual"]);

export type RevenueCatSubscription = {
  expires_date?: string | null;
  period_type?: string | null;
  store?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  is_sandbox?: boolean;
  store_transaction_id?: string | null;
  original_transaction_id?: string | null;
  refunded_at?: string | null;
};

export type RevenueCatSubscriber = {
  subscriptions?: Record<string, RevenueCatSubscription | null> | null;
};

type RevenueCatEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  environment?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
};

export function proSkuFromStoreProduct(productId: string): {
  plan: "performance";
  billingSku: "performance_monthly" | "performance_year";
} | null {
  const id = productId.trim().toLowerCase();
  if (MONTHLY_PRODUCTS.has(id)) return { plan: "performance", billingSku: "performance_monthly" };
  if (ANNUAL_PRODUCTS.has(id)) return { plan: "performance", billingSku: "performance_year" };
  return null;
}

export function storeFromRevenueCat(store: string | null | undefined): "app_store" | "play_store" | null {
  const value = (store ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (value === "app_store" || value === "mac_app_store") return "app_store";
  if (value === "play_store") return "play_store";
  return null;
}

export function sandboxPurchasesAccepted() {
  return process.env.REVENUECAT_ACCEPT_SANDBOX === "1";
}

export function subscriptionStatusFromStore(
  sub: RevenueCatSubscription,
  now = new Date(),
): { status: "active" | "trialing" | "canceled" | "past_due"; cancelAtPeriodEnd: boolean; periodEnd: Date | null } {
  const periodEnd = sub.expires_date ? new Date(sub.expires_date) : null;
  const periodOk = periodEnd instanceof Date && !Number.isNaN(periodEnd.getTime());
  const end = periodOk ? periodEnd : null;
  const expired = Boolean(end && end.getTime() < now.getTime());
  const cancelAtPeriodEnd = Boolean(sub.unsubscribe_detected_at);
  if (sub.refunded_at || expired) return { status: "canceled", cancelAtPeriodEnd, periodEnd: end };
  if (sub.billing_issues_detected_at) return { status: "past_due", cancelAtPeriodEnd, periodEnd: end };
  const period = (sub.period_type ?? "").toUpperCase();
  if (period === "TRIAL") return { status: "trialing", cancelAtPeriodEnd, periodEnd: end };
  return { status: "active", cancelAtPeriodEnd, periodEnd: end };
}

function secretKey() {
  return process.env.REVENUECAT_SECRET_API_KEY?.trim() ?? "";
}

export function revenueCatConfigured() {
  return Boolean(secretKey());
}

export async function fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriber> {
  const key = secretKey();
  if (!key) {
    throw new Error("RevenueCat is not configured.");
  }
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`RevenueCat subscriber lookup failed (${response.status}).`);
  }
  const body = (await response.json()) as { subscriber?: RevenueCatSubscriber };
  return body.subscriber ?? {};
}

export async function applyRevenueCatSubscriber(
  userId: string,
  subscriber: RevenueCatSubscriber,
  now = new Date(),
) {
  const seen = new Set<string>();
  const subscriptions = subscriber.subscriptions ?? {};
  let considered = 0;
  let skippedSandbox = 0;
  for (const [productId, raw] of Object.entries(subscriptions)) {
    if (!raw) continue;
    const sku = proSkuFromStoreProduct(productId);
    const store = storeFromRevenueCat(raw.store);
    if (!sku || !store) continue;
    considered += 1;
    const sandbox = Boolean(raw.is_sandbox);
    if (sandbox && !sandboxPurchasesAccepted()) {
      skippedSandbox += 1;
      continue;
    }
    const originalId = (raw.original_transaction_id || raw.store_transaction_id || `${store}:${productId}`).trim();
    const mapped = subscriptionStatusFromStore(raw, now);
    const data = {
      userId,
      plan: sku.plan,
      billingSku: sku.billingSku,
      status: mapped.status,
      currentPeriodEnd: mapped.periodEnd,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      source: "revenuecat",
      store,
      storeProductId: productId,
      storeOriginalTransactionId: originalId,
      revenueCatAppUserId: userId,
      environment: sandbox ? "sandbox" : "production",
    };
    const existing = await prisma.subscription.findFirst({
      where: { store, storeOriginalTransactionId: originalId },
    });
    if (existing) {
      await prisma.subscription.update({ where: { id: existing.id }, data });
    } else {
      await prisma.subscription.create({ data });
    }
    seen.add(originalId);
  }

  if (considered > 0 && skippedSandbox === considered) return { applied: 0 };

  const owned = await prisma.subscription.findMany({
    where: { userId, source: "revenuecat" },
  });
  for (const row of owned) {
    if (seen.has(row.storeOriginalTransactionId)) continue;
    if (row.status === "canceled") continue;
    const end = row.currentPeriodEnd && row.currentPeriodEnd.getTime() < now.getTime() ? row.currentPeriodEnd : now;
    await prisma.subscription.update({
      where: { id: row.id },
      data: { status: "canceled", currentPeriodEnd: end, cancelAtPeriodEnd: false },
    });
  }
  return { applied: seen.size };
}

export async function deleteRevenueCatSubscriber(appUserId: string) {
  const key = secretKey();
  if (!key) return { deleted: false, skipped: true };
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${key}` } },
  );
  if (response.status === 404) return { deleted: false, skipped: false };
  if (!response.ok) return { deleted: false, skipped: false };
  return { deleted: true, skipped: false };
}

function stringIds(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => stringIds(entry));
}

function eventUserIds(event: RevenueCatEvent) {
  const ids = new Set<string>();
  for (const id of stringIds(event.app_user_id)) ids.add(id);
  if (String(event.type ?? "").toUpperCase() === "TRANSFER") {
    for (const id of [...stringIds(event.transferred_from), ...stringIds(event.transferred_to)]) ids.add(id);
  }
  return [...ids];
}

function authHeaderMatches(header: string) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH?.trim() ?? "";
  if (!secret) return false;
  if (timingSafeEqualString(header, secret)) return true;
  if (!secret.toLowerCase().startsWith("bearer ")) {
    return timingSafeEqualString(header, `Bearer ${secret}`);
  }
  return false;
}

async function syncExistingUsers(ids: string[]) {
  let wrote = false;
  for (const id of ids) {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      console.info("[revenuecat] unknown app user");
      continue;
    }
    const subscriber = await fetchSubscriber(id);
    await applyRevenueCatSubscriber(id, subscriber);
    wrote = true;
  }
  return wrote;
}

export async function handleRevenueCatWebhook(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!authHeaderMatches(header)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: { event?: RevenueCatEvent } & RevenueCatEvent;
  try {
    payload = (await request.json()) as { event?: RevenueCatEvent } & RevenueCatEvent;
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }
  const event = payload.event ?? payload;
  const type = String(event.type ?? "").toUpperCase();
  const id = String(event.id ?? "").trim();
  if (type === "TEST") return NextResponse.json({ ok: true });
  if (!id) return NextResponse.json({ error: "Missing event id." }, { status: 400 });

  const existing = await prisma.revenueCatEvent.findUnique({ where: { id } });
  if (existing?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
  if (!existing) {
    try {
      await prisma.revenueCatEvent.create({
        data: { id, type, appUserId: String(event.app_user_id ?? "") },
      });
    } catch (error) {
      const again = await prisma.revenueCatEvent.findUnique({ where: { id } });
      if (again?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
      if (!again) throw error;
    }
  }

  try {
    const environment = String(event.environment ?? "").toUpperCase();
    const sandboxEvent = environment === "SANDBOX";
    if (sandboxEvent && !sandboxPurchasesAccepted()) {
      await prisma.revenueCatEvent.update({ where: { id }, data: { processedAt: new Date() } });
      return NextResponse.json({ ok: true, ignored: "sandbox" });
    }
    if (SYNC_TYPES.has(type)) {
      if (!revenueCatConfigured()) {
        return NextResponse.json({ error: "RevenueCat is not configured." }, { status: 500 });
      }
      const ids = eventUserIds(event);
      if (ids.length === 0) {
        console.info("[revenuecat] event had no app user", { type });
      } else {
        await syncExistingUsers(ids);
      }
    }
    await prisma.revenueCatEvent.update({ where: { id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[revenuecat] webhook failed", { type });
    void error;
    return NextResponse.json({ error: "RevenueCat webhook could not be applied." }, { status: 500 });
  }
}
