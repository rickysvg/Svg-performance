import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent } from "@/lib/billing";
import { constructStripeEvent } from "@/lib/stripe";
import { hasWebhookGrantedAccess, subscriptionGrantsAccess } from "@/lib/access";
import { setGymMembershipVerified } from "@/lib/admin";
import { makeUser, resetDatabase } from "./helpers";
import { POST } from "@/app/api/stripe/webhook/route";

const WEBHOOK_SECRET = "whsec_test_svg_performance";

describe("stripe webhook path", () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterAll(async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await prisma.$disconnect();
  });

  it("rejects a payload without a valid signature", () => {
    expect(() =>
      constructStripeEvent(JSON.stringify({ type: "ping" }), "bad-signature"),
    ).toThrow();
  });

  it("accepts a signed gym checkout for an unverified member without asking Stripe to retry", async () => {
    const user = await makeUser("pay@example.com", true);
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          metadata: { userId: user.id, plan: "gym", priceId: "price_gym" },
          client_reference_id: user.id,
          customer: "cus_gym_unverified",
          subscription: "sub_test_1",
          payment_status: "paid",
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const event = constructStripeEvent(payload, signature);
    expect(event.type).toBe("checkout.session.completed");

    const response = await POST(
      new Request("https://svg-performance.vercel.app/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(response.status).toBe(200);
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({
      plan: "performance",
      status: "active",
      source: "gym_unverified",
      stripePriceId: "price_gym",
      stripeCustomerId: "cus_gym_unverified",
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
  });

  it("grants access only after a verified webhook for an allowed plan", async () => {
    const admin = await makeUser("stripe-admin@example.com", false, "admin");
    const user = await makeUser("paid@example.com");
    await applyStripeEvent({
      id: "evt_grant_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_2",
          metadata: { userId: user.id, plan: "standalone" },
          client_reference_id: user.id,
          subscription: "sub_test_2",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await applyStripeEvent({
      id: "evt_fail_1",
      type: "invoice.payment_failed",
      data: {
        object: {
          metadata: { userId: user.id, plan: "standalone" },
          subscription: "sub_test_2",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);

    await applyStripeEvent({
      id: "evt_renew_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { userId: user.id, plan: "standalone" },
          subscription: "sub_test_2",
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await setGymMembershipVerified({
      adminUserId: admin.id,
      targetUserId: user.id,
      verified: true,
    });
  });

  it("skips duplicate event ids", async () => {
    const user = await makeUser("dup@example.com");
    const event = {
      id: "evt_duplicate",
      type: "checkout.session.completed" as const,
      data: {
        object: {
          metadata: { userId: user.id, plan: "standalone" },
          subscription: "sub_dup",
        },
      },
    };
    await applyStripeEvent(event);
    const second = await applyStripeEvent(event);
    expect(second).toMatchObject({ skipped: true, reason: "duplicate" });
    expect(await prisma.stripeEventLog.count({ where: { stripeEventId: "evt_duplicate" } })).toBe(
      1,
    );
  });

  it("treats cancel and expired period as no access", async () => {
    const user = await makeUser("cancel@example.com");
    await applyStripeEvent({
      id: "evt_active_then_cancel",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: user.id, plan: "standalone" },
          subscription: "sub_cancel",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await applyStripeEvent({
      id: "evt_canceled",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_cancel",
          metadata: { userId: user.id, plan: "standalone" },
          status: "canceled",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);

    const expiring = await makeUser("expire@example.com");
    await applyStripeEvent({
      id: "evt_expired_period",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: expiring.id, plan: "standalone" },
          subscription: "sub_exp",
          current_period_end: Math.floor(Date.now() / 1000) - 60,
        },
      },
    });
    expect(await hasWebhookGrantedAccess(expiring.id)).toBe(false);
  });

  it("grants access the same way after Affirm or Klarna TEST checkout completes", async () => {
    const affirmUser = await makeUser("affirm@example.com");
    await applyStripeEvent({
      id: "evt_bnpl_affirm",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_affirm",
          metadata: { userId: affirmUser.id, plan: "platinum" },
          client_reference_id: affirmUser.id,
          subscription: "sub_affirm",
          payment_method_types: ["affirm"],
        },
      },
    });
    expect(await hasWebhookGrantedAccess(affirmUser.id)).toBe(true);
    const affirmSub = await prisma.subscription.findFirst({ where: { userId: affirmUser.id } });
    expect(affirmSub).toMatchObject({
      plan: "platinum",
      status: "active",
      source: "webhook",
    });
    expect(affirmSub?.currentPeriodEnd).toBeTruthy();
    const monthMs = 28 * 24 * 60 * 60 * 1000;
    expect(affirmSub!.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + monthMs - 60_000);
    expect(affirmSub!.currentPeriodEnd!.getTime()).toBeLessThan(Date.now() + 32 * 24 * 60 * 60 * 1000);
    expect(affirmSub).not.toHaveProperty("loanDetails");
    expect(Object.keys(affirmSub ?? {})).not.toEqual(expect.arrayContaining(["loanId", "loan"]));

    const klarnaUser = await makeUser("klarna@example.com");
    await applyStripeEvent({
      id: "evt_bnpl_klarna",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_klarna",
          metadata: { userId: klarnaUser.id, plan: "vip" },
          client_reference_id: klarnaUser.id,
          subscription: "sub_klarna",
          payment_method_types: ["klarna"],
        },
      },
    });
    expect(await hasWebhookGrantedAccess(klarnaUser.id)).toBe(true);
    const vipSub = await prisma.subscription.findFirst({ where: { userId: klarnaUser.id } });
    expect(vipSub?.plan).toBe("vip");
    expect(vipSub?.currentPeriodEnd).toBeTruthy();
    await prisma.subscription.update({
      where: { id: vipSub!.id },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    expect(await hasWebhookGrantedAccess(klarnaUser.id)).toBe(false);
    await prisma.subscription.update({
      where: { id: vipSub!.id },
      data: { currentPeriodEnd: vipSub!.currentPeriodEnd },
    });

    await applyStripeEvent({
      id: "evt_bnpl_klarna_fail",
      type: "invoice.payment_failed",
      data: {
        object: {
          metadata: { userId: klarnaUser.id, plan: "vip" },
          subscription: "sub_klarna",
          payment_method_types: ["klarna"],
        },
      },
    });
    expect(await hasWebhookGrantedAccess(klarnaUser.id)).toBe(false);
  });

  it("applies gym-SKU cancellations and failures even if the member has lapsed", async () => {
    const user = await makeUser("lapsed-gym@example.com", true);
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "gym",
        status: "active",
        stripeSubscriptionId: "sub_gym_lapsed",
        source: "webhook",
      },
    });
    expect(await prisma.profile.findUnique({ where: { userId: user.id } })).toMatchObject({
      gymMembershipVerified: false,
    });

    await applyStripeEvent({
      id: "evt_gym_lapsed_fail",
      type: "invoice.payment_failed",
      data: {
        object: {
          metadata: { userId: user.id, plan: "gym" },
          subscription: "sub_gym_lapsed",
        },
      },
    });
    expect(
      await prisma.subscription.findFirst({ where: { stripeSubscriptionId: "sub_gym_lapsed" } }),
    ).toMatchObject({ status: "past_due" });

    await applyStripeEvent({
      id: "evt_gym_lapsed_cancel",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_gym_lapsed",
          metadata: { userId: user.id, plan: "gym" },
          status: "canceled",
        },
      },
    });
    expect(
      await prisma.subscription.findFirst({ where: { stripeSubscriptionId: "sub_gym_lapsed" } }),
    ).toMatchObject({ status: "canceled" });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
  });

  it("renews and marks past_due from invoice fixtures that have no member id", async () => {
    const user = await makeUser("renew@example.com");
    const periodEnd = Math.floor(Date.now() / 1000) + 40 * 24 * 60 * 60;
    await applyStripeEvent({
      id: "evt_checkout_price",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_price",
          metadata: { userId: user.id, plan: "elite_non", priceId: "price_elite_non" },
          client_reference_id: user.id,
          customer: "cus_renew",
          subscription: "sub_renew",
          payment_status: "paid",
          current_period_end: periodEnd,
        },
      },
    });
    const started = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(started).toMatchObject({
      plan: "elite",
      status: "active",
      stripePriceId: "price_elite_non",
      stripeCustomerId: "cus_renew",
      stripeSubscriptionId: "sub_renew",
    });
    expect(started?.currentPeriodEnd?.toISOString()).toBe(new Date(periodEnd * 1000).toISOString());

    const renewedEnd = periodEnd + 30 * 24 * 60 * 60;
    const paidPayload = JSON.stringify({
      id: "evt_invoice_paid_fixture",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_renew",
          object: "invoice",
          customer: "cus_renew",
          subscription: "sub_renew",
          lines: {
            data: [
              {
                price: { id: "price_elite_non" },
                period: { end: renewedEnd },
              },
            ],
          },
        },
      },
    });
    const paidSignature = Stripe.webhooks.generateTestHeaderString({
      payload: paidPayload,
      secret: WEBHOOK_SECRET,
    });
    const paidEvent = constructStripeEvent(paidPayload, paidSignature);
    await applyStripeEvent({
      id: paidEvent.id,
      type: paidEvent.type,
      data: { object: paidEvent.data.object as never },
    });
    const renewed = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: "sub_renew" },
    });
    expect(renewed).toMatchObject({
      userId: user.id,
      status: "active",
      stripePriceId: "price_elite_non",
    });
    expect(renewed?.currentPeriodEnd?.toISOString()).toBe(new Date(renewedEnd * 1000).toISOString());
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await applyStripeEvent({
      id: "evt_invoice_fail_by_customer",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_fail",
          customer: "cus_renew",
        },
      },
    });
    expect(
      await prisma.subscription.findFirst({ where: { stripeSubscriptionId: "sub_renew" } }),
    ).toMatchObject({ status: "past_due", stripePriceId: "price_elite_non" });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
  });

  it("returns 200 when an invoice cannot be matched to a member", async () => {
    const payload = JSON.stringify({
      id: "evt_invoice_orphan",
      object: "event",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_orphan",
          object: "invoice",
          customer: "cus_unknown",
          subscription: "sub_unknown",
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const response = await POST(
      new Request("https://svg-performance.vercel.app/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(response.status).toBe(200);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.stripeEventLog.count({ where: { stripeEventId: "evt_invoice_orphan" } })).toBe(
      1,
    );

    const bad = await POST(
      new Request("https://svg-performance.vercel.app/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "bad" },
        body: payload,
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("loads subscription metadata when the invoice has neither a local row nor a member id", async () => {
    const user = await makeUser("remote-sub@example.com");
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const result = await applyStripeEvent(
      {
        id: "evt_remote_invoice",
        type: "invoice.paid",
        data: {
          object: {
            id: "in_remote",
            customer: "cus_remote",
            parent: {
              subscription_details: {
                subscription: "sub_remote",
              },
            },
          },
        },
      },
      {
        loadSubscription: async () => ({
          id: "sub_remote",
          customerId: "cus_remote",
          metadata: { userId: user.id, plan: "conditioning_non" },
          status: "active",
          priceId: "price_conditioning_non",
          currentPeriodEnd: periodEnd,
        }),
      },
    );
    expect(result).toMatchObject({
      userId: user.id,
      plan: "fighter_conditioning",
      status: "active",
      stripePriceId: "price_conditioning_non",
      stripeSubscriptionId: "sub_remote",
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
  });

  it("maps Stripe subscription statuses and stores price plus period end", async () => {
    const user = await makeUser("status-map@example.com");
    const periodEnd = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
    await applyStripeEvent({
      id: "evt_sub_incomplete",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_status",
          metadata: { userId: user.id, plan: "standalone" },
          customer: "cus_status",
          status: "incomplete",
          items: {
            data: [{ price: { id: "price_standalone" }, current_period_end: periodEnd }],
          },
        },
      },
    });
    expect(
      await prisma.subscription.findFirst({ where: { stripeSubscriptionId: "sub_status" } }),
    ).toMatchObject({
      status: "incomplete",
      stripePriceId: "price_standalone",
      stripeCustomerId: "cus_status",
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);

    await applyStripeEvent({
      id: "evt_sub_trialing",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_status",
          metadata: { userId: user.id, plan: "standalone" },
          status: "trialing",
          items: {
            data: [{ price: { id: "price_standalone" }, current_period_end: periodEnd }],
          },
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await applyStripeEvent({
      id: "evt_sub_unpaid",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_status",
          metadata: { userId: user.id, plan: "standalone" },
          status: "unpaid",
        },
      },
    });
    expect(
      await prisma.subscription.findFirst({ where: { stripeSubscriptionId: "sub_status" } }),
    ).toMatchObject({ status: "canceled", stripePriceId: "price_standalone" });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
  });

  it("keeps admin comps with no period end, and does not let a one-time invoice shorten VIP", async () => {
    const comped = await makeUser("comped@example.com");
    await prisma.subscription.create({
      data: {
        userId: comped.id,
        plan: "elite",
        status: "active",
        source: "admin",
        currentPeriodEnd: null,
      },
    });
    expect(
      subscriptionGrantsAccess({
        status: "active",
        source: "admin",
        currentPeriodEnd: null,
      }),
    ).toBe(true);
    expect(await hasWebhookGrantedAccess(comped.id)).toBe(true);
    expect(
      subscriptionGrantsAccess({
        status: "incomplete",
        source: "webhook",
        currentPeriodEnd: null,
      }),
    ).toBe(false);

    const vip = await makeUser("vip-month@example.com");
    await applyStripeEvent({
      id: "evt_vip_month",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_vip",
          metadata: { userId: vip.id, plan: "vip", priceId: "price_vip" },
          customer: "cus_vip",
          payment_status: "paid",
          mode: "payment",
        },
      },
    });
    const first = await prisma.subscription.findFirst({ where: { userId: vip.id } });
    const originalEnd = first!.currentPeriodEnd!.getTime();
    await applyStripeEvent({
      id: "evt_vip_invoice",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_vip",
          customer: "cus_vip",
          lines: {
            data: [{ price: { id: "price_vip" }, period: { end: Math.floor(Date.now() / 1000) } }],
          },
        },
      },
    });
    const after = await prisma.subscription.findFirst({ where: { userId: vip.id } });
    expect(after?.status).toBe("active");
    expect(after?.currentPeriodEnd?.getTime()).toBe(originalEnd);
    expect(await hasWebhookGrantedAccess(vip.id)).toBe(true);
  });
});
