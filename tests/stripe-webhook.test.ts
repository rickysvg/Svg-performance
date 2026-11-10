import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent } from "@/lib/billing";
import { constructStripeEvent } from "@/lib/stripe";
import { hasWebhookGrantedAccess } from "@/lib/access";
import { setGymMembershipVerified } from "@/lib/admin";
import { makeUser, resetDatabase } from "./helpers";

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

  it("accepts a correctly signed event and still withholds gym access if unverified", async () => {
    const user = await makeUser("pay@example.com", true);
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          metadata: { userId: user.id, plan: "gym" },
          client_reference_id: user.id,
          subscription: "sub_test_1",
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const event = constructStripeEvent(payload, signature);
    expect(event.type).toBe("checkout.session.completed");

    await expect(
      applyStripeEvent({
        type: event.type,
        data: { object: event.data.object as never },
      }),
    ).resolves.toMatchObject({ refused: true });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
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

  it("waits for async payment success and then grants the plan", async () => {
    const user = await makeUser("async-pay@example.com");
    await applyStripeEvent({
      id: "evt_async_unpaid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_async",
          metadata: { userId: user.id, plan: "performance_monthly", priceId: "price_pro_mo" },
          client_reference_id: user.id,
          subscription: "sub_async",
          payment_status: "unpaid",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);

    await applyStripeEvent({
      id: "evt_async_paid",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_async",
          metadata: { userId: user.id, plan: "performance_monthly", priceId: "price_pro_mo" },
          client_reference_id: user.id,
          subscription: "sub_async",
          customer: "cus_async",
          payment_status: "paid",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({
      plan: "performance",
      status: "active",
      stripePriceId: "price_pro_mo",
    });
  });

  it("grants a trial checkout when no payment is required and drops it on delete", async () => {
    const user = await makeUser("trial-checkout@example.com");
    await applyStripeEvent({
      id: "evt_trial_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: user.id, plan: "performance_year", priceId: "price_pro_yr" },
          subscription: "sub_trial_checkout",
          payment_status: "no_payment_required",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);

    await applyStripeEvent({
      id: "evt_trial_checkout_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_trial_checkout",
          metadata: { userId: user.id, plan: "performance_year" },
          status: "canceled",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
  });

  it("updates the stored plan when a subscription changes", async () => {
    const user = await makeUser("sub-updated@example.com");
    await applyStripeEvent({
      id: "evt_sub_created",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_updated",
          metadata: { userId: user.id, plan: "coaching_monthly" },
          customer: "cus_updated",
          status: "trialing",
          items: { data: [{ price: { id: "price_vip" } }] },
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({ plan: "coaching", status: "trialing", stripePriceId: "price_vip" });
  });

  it("stores a portal cancel at the period end", async () => {
    const user = await makeUser("cancel-later@example.com");
    const cancelAt = Math.floor(new Date("2026-11-17T18:00:00.000Z").getTime() / 1000);
    await applyStripeEvent({
      id: "evt_cancel_scheduled",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_cancel_later",
          metadata: { userId: user.id, plan: "performance_monthly" },
          status: "active",
          cancel_at_period_end: true,
          cancel_at: cancelAt,
          current_period_end: cancelAt,
        },
      },
    });
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row?.cancelAtPeriodEnd).toBe(true);
    expect(row?.cancelAt?.toISOString()).toBe("2026-11-17T18:00:00.000Z");
    expect(row?.status).toBe("active");
  });

  it("resolves invoice.paid from the stored subscription when the invoice has no member id", async () => {
    const user = await makeUser("invoice-lookup@example.com");
    await applyStripeEvent({
      id: "evt_sub_for_invoice",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_invoice_lookup",
          metadata: { userId: user.id, plan: "performance_monthly", priceId: "price_pro_mo" },
          customer: "cus_invoice_lookup",
          status: "active",
        },
      },
    });
    await applyStripeEvent({
      id: "evt_invoice_paid_no_meta",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid",
          customer: "cus_invoice_lookup",
          subscription: "sub_invoice_lookup",
          amount_paid: 999,
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row?.stripeSubscriptionId).toBe("sub_invoice_lookup");
    expect(row?.stripeSubscriptionId.startsWith("cs_")).toBe(false);
  });

  it("locks access on past_due and returns an ignore for an unknown event", async () => {
    const user = await makeUser("pastdue-lock@example.com");
    await applyStripeEvent({
      id: "evt_paid_then_due",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_paid_then_due",
          metadata: { userId: user.id, plan: "performance_monthly" },
          subscription: "sub_paid_then_due",
          payment_status: "paid",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(true);
    await applyStripeEvent({
      id: "evt_invoice_failed_lookup",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_failed",
          subscription: "sub_paid_then_due",
          customer: "",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);
    const ignored = await applyStripeEvent({
      id: "evt_unknown_ping",
      type: "payment_method.attached",
      data: { object: { id: "pm_1" } },
    });
    expect(ignored).toMatchObject({ ignored: true });
  });

  it("stores the subscription id from checkout, not the session id", async () => {
    const user = await makeUser("session-id@example.com");
    await applyStripeEvent({
      id: "evt_cs_real_sub",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_not_a_sub",
          metadata: { userId: user.id, plan: "coaching_monthly", priceId: "price_vip" },
          subscription: { id: "sub_real_vip" },
          customer: "cus_vip",
          payment_status: "paid",
        },
      },
    });
    const row = await prisma.subscription.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({
      plan: "coaching",
      billingSku: "coaching_monthly",
      status: "active",
      stripeSubscriptionId: "sub_real_vip",
      stripePriceId: "price_vip",
    });
  });
});
