import { afterAll, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyStripeEvent } from "@/lib/billing";
import { constructStripeEvent } from "@/lib/stripe";
import { hasWebhookGrantedAccess } from "@/lib/access";
import { setGymMembershipVerified } from "@/lib/admin";
import { ForbiddenError } from "@/lib/errors";
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
    ).rejects.toBeInstanceOf(ForbiddenError);
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
});
