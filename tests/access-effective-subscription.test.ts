import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveSubscription,
  getLatestStripeSubscription,
  getLatestSubscription,
  hasWebhookGrantedAccess,
} from "@/lib/access";
import { upsertSubscriptionFromWebhook } from "@/lib/stripe-webhook";
import { makeUser, resetDatabase } from "./helpers";

const future = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const later = () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("effective subscription", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps an active Stripe subscription ahead of a newer expired store row", async () => {
    const user = await makeUser("active-stripe@example.com");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        store: "stripe",
        billingSku: "performance_monthly",
        stripeSubscriptionId: "sub_live",
        currentPeriodEnd: future(),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        store: "app_store",
        source: "revenuecat",
        storeProductId: "svg_pro_monthly",
        storeOriginalTransactionId: "orig-expired",
        currentPeriodEnd: past(),
      },
    });

    expect((await getLatestSubscription(user.id))?.store).toBe("app_store");
    expect((await getEffectiveSubscription(user.id))?.store).toBe("stripe");
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    expect((await getLatestStripeSubscription(user.id))?.stripeSubscriptionId).toBe("sub_live");
  });

  it("keeps an active store subscription ahead of a newer canceled Stripe row", async () => {
    const user = await makeUser("active-store@example.com");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        store: "play_store",
        source: "revenuecat",
        storeProductId: "svg_pro:monthly",
        storeOriginalTransactionId: "play-1",
        currentPeriodEnd: future(),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "canceled",
        store: "stripe",
        stripeSubscriptionId: "sub_old",
        currentPeriodEnd: past(),
      },
    });

    const effective = await getEffectiveSubscription(user.id);
    expect(effective?.store).toBe("play_store");
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
  });

  it("prefers an active VIP row over an active Pro row", async () => {
    const user = await makeUser("both-active@example.com");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "coaching",
        status: "active",
        store: "stripe",
        billingSku: "coaching_monthly",
        currentPeriodEnd: future(),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        store: "app_store",
        source: "revenuecat",
        currentPeriodEnd: later(),
      },
    });

    expect((await getEffectiveSubscription(user.id))?.plan).toBe("coaching");
  });

  it("does not let a Stripe webhook overwrite a store subscription row", async () => {
    const user = await makeUser("webhook-keeps-store@example.com");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        store: "app_store",
        source: "revenuecat",
        storeProductId: "svg_pro_annual",
        storeOriginalTransactionId: "orig-keep",
        currentPeriodEnd: future(),
      },
    });
    await upsertSubscriptionFromWebhook({
      userId: user.id,
      plan: "performance",
      status: "active",
      stripeCustomerId: "cus_new",
      stripeSubscriptionId: "sub_new",
      billingSku: "performance_monthly",
      currentPeriodEnd: future(),
    });
    const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.store === "app_store")?.status).toBe("active");
    expect(rows.find((row) => row.store === "stripe")?.stripeSubscriptionId).toBe("sub_new");
  });
});
