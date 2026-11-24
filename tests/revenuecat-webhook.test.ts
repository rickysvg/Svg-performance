import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasWebhookGrantedAccess } from "@/lib/access";
import { POST as syncPurchase } from "@/app/api/revenuecat/sync/route";
import { handleRevenueCatWebhook } from "@/lib/revenuecat";
import { clearRateLimits } from "@/lib/rate-limit-memory";
import { getCurrentUser } from "@/lib/session";
import { makeUser, resetDatabase } from "./helpers";

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

const currentUser = vi.mocked(getCurrentUser);
const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function subscriber(productId: string, overrides: Record<string, unknown> = {}) {
  return {
    subscriptions: {
      [productId]: {
        expires_date: future,
        period_type: "normal",
        store: "app_store",
        is_sandbox: false,
        original_transaction_id: `orig-${productId}`,
        ...overrides,
      },
    },
  };
}

function eventRequest(event: Record<string, unknown>, authorization = "test-webhook-secret") {
  return new Request("https://svgperformance.app/api/revenuecat/webhook", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({ event }),
  });
}

describe("RevenueCat webhook", () => {
  const subscribers = new Map<string, ReturnType<typeof subscriber> | { subscriptions: Record<string, never> }>();

  beforeEach(async () => {
    await resetDatabase();
    clearRateLimits();
    subscribers.clear();
    process.env.REVENUECAT_WEBHOOK_AUTH = "test-webhook-secret";
    process.env.REVENUECAT_SECRET_API_KEY = "sk_test_revenuecat";
    delete process.env.REVENUECAT_ACCEPT_SANDBOX;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const id = decodeURIComponent(String(url).split("/subscribers/")[1] ?? "");
        return new Response(JSON.stringify({ subscriber: subscribers.get(id) ?? { subscriptions: {} } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    delete process.env.REVENUECAT_SECRET_API_KEY;
    delete process.env.REVENUECAT_ACCEPT_SANDBOX;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a missing or wrong authorization header", async () => {
    const denied = await handleRevenueCatWebhook(eventRequest({ id: "evt_1", type: "TEST" }, "nope"));
    expect(denied.status).toBe(401);
    expect(await prisma.revenueCatEvent.count()).toBe(0);
  });

  it("stores an initial purchase once and ignores a duplicate event id", async () => {
    const user = await makeUser("rc-buyer@example.com");
    subscribers.set(user.id, subscriber("svg_pro_monthly"));
    const event = { id: "evt_buy", type: "INITIAL_PURCHASE", app_user_id: user.id, environment: "PRODUCTION" };
    expect((await handleRevenueCatWebhook(eventRequest(event))).status).toBe(200);
    expect((await handleRevenueCatWebhook(eventRequest(event))).status).toBe(200);
    const rows = await prisma.subscription.findMany({ where: { userId: user.id, source: "revenuecat" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.billingSku).toBe("performance_monthly");
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.store).toBe("app_store");
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    expect(await prisma.revenueCatEvent.count()).toBe(1);
  });

  it("removes access when the store subscription expires", async () => {
    const user = await makeUser("rc-expired@example.com");
    subscribers.set(user.id, subscriber("svg_pro_annual", { expires_date: past }));
    const response = await handleRevenueCatWebhook(
      eventRequest({ id: "evt_exp", type: "EXPIRATION", app_user_id: user.id, environment: "PRODUCTION" }),
    );
    expect(response.status).toBe(200);
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
    expect((await prisma.subscription.findFirst({ where: { userId: user.id } }))?.status).toBe("canceled");
  });

  it("moves access on a transfer and never grants VIP", async () => {
    const from = await makeUser("rc-from@example.com");
    const to = await makeUser("rc-to@example.com");
    await prisma.subscription.create({
      data: {
        userId: from.id,
        plan: "performance",
        status: "active",
        store: "app_store",
        source: "revenuecat",
        storeProductId: "svg_pro_monthly",
        storeOriginalTransactionId: "orig-svg_pro_monthly",
        currentPeriodEnd: new Date(future),
      },
    });
    subscribers.set(from.id, { subscriptions: {} });
    subscribers.set(to.id, {
      subscriptions: {
        ...subscriber("svg_pro_monthly").subscriptions,
        svg_vip_monthly: {
          expires_date: future,
          period_type: "normal",
          store: "app_store",
          is_sandbox: false,
          original_transaction_id: "orig-vip",
        },
      },
    });
    const response = await handleRevenueCatWebhook(
      eventRequest({
        id: "evt_transfer",
        type: "TRANSFER",
        app_user_id: to.id,
        environment: "PRODUCTION",
        transferred_from: [from.id],
        transferred_to: [to.id],
      }),
    );
    expect(response.status).toBe(200);
    expect(await hasWebhookGrantedAccess(to.id)).toBe(true);
    expect(await hasWebhookGrantedAccess(from.id)).toBe(false);
    const plans = await prisma.subscription.findMany({ where: { userId: to.id } });
    expect(plans.every((row) => row.plan !== "coaching")).toBe(true);
  });

  it("ignores sandbox events unless the preview flag is set", async () => {
    const user = await makeUser("rc-sandbox@example.com");
    subscribers.set(user.id, subscriber("svg_pro_monthly", { is_sandbox: true }));
    const response = await handleRevenueCatWebhook(
      eventRequest({ id: "evt_sand", type: "INITIAL_PURCHASE", app_user_id: user.id, environment: "SANDBOX" }),
    );
    expect(response.status).toBe(200);
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(0);
  });

  it("acknowledges an unknown app user and a test event without writing a subscription", async () => {
    expect((await handleRevenueCatWebhook(eventRequest({ id: "evt_test", type: "TEST" }))).status).toBe(200);
    const response = await handleRevenueCatWebhook(
      eventRequest({
        id: "evt_unknown",
        type: "RENEWAL",
        app_user_id: "ckunknownuser00000000000000",
        environment: "PRODUCTION",
      }),
    );
    expect(response.status).toBe(200);
    expect(await prisma.subscription.count()).toBe(0);
  });

  it("rate-limits the signed-in sync route", async () => {
    const user = await makeUser("rc-sync@example.com");
    currentUser.mockResolvedValue(user);
    subscribers.set(user.id, subscriber("svg_pro:annual", { store: "play_store" }));
    expect((await syncPurchase()).status).toBe(200);
    expect((await syncPurchase()).status).toBe(429);
    expect((await prisma.subscription.findFirst({ where: { userId: user.id } }))?.billingSku).toBe("performance_year");
  });
});
