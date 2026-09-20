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
      type: "invoice.payment_failed",
      data: {
        object: {
          metadata: { userId: user.id, plan: "standalone" },
          subscription: "sub_test_2",
        },
      },
    });
    expect(await hasWebhookGrantedAccess(user.id)).toBe(false);

    await setGymMembershipVerified({
      adminUserId: admin.id,
      targetUserId: user.id,
      verified: true,
    });
  });
});
