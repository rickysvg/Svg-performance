import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  CHECKOUT_TRIAL_DAYS,
  createSubscriptionCheckoutSession,
  subscriptionTrialDays,
} from "@/lib/stripe";
import { priceIdForPlan } from "@/lib/billing";

type CheckoutCreateParams = Stripe.Checkout.SessionCreateParams;

function restore(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("subscription checkout sessions", () => {
  const envSnapshot = {
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_VIP_MONTHLY: process.env.STRIPE_PRICE_VIP_MONTHLY,
    STRIPE_PRICE_PERFORMANCE_YEAR: process.env.STRIPE_PRICE_PERFORMANCE_YEAR,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  afterEach(() => {
    restore(envSnapshot);
  });

  it("opens Pro and VIP checkout on the env price with a 7-day trial and no payment method list", async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_month";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_year";
    process.env.STRIPE_PRICE_VIP_MONTHLY = "price_vip_month";
    expect(subscriptionTrialDays("performance_monthly")).toBe(CHECKOUT_TRIAL_DAYS);
    expect(subscriptionTrialDays("performance_year")).toBe(7);
    expect(subscriptionTrialDays("coaching_monthly")).toBe(7);
    expect(priceIdForPlan("performance_monthly")).toBe("price_pro_month");

    const calls: CheckoutCreateParams[] = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: CheckoutCreateParams) => {
            calls.push(params);
            return { url: "https://checkout.stripe.com/c/pay/cs_test_sub" };
          },
        },
      },
    } as unknown as Stripe;

    for (const plan of ["performance_monthly", "performance_year", "coaching_monthly"] as const) {
      await createSubscriptionCheckoutSession(stripe, {
        userId: "user_sub",
        email: "member@example.com",
        plan,
        successUrl: "http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "http://localhost:3000/billing/cancel",
      });
    }

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.line_items?.[0]?.price)).toEqual([
      "price_pro_month",
      "price_pro_year",
      "price_vip_month",
    ]);
    for (const call of calls) {
      expect(call.mode).toBe("subscription");
      expect(call.payment_method_types).toBeUndefined();
      expect(call.subscription_data?.trial_period_days).toBe(7);
      expect(call.success_url).toContain("/billing/success");
      expect(call.cancel_url).toContain("/billing/cancel");
      expect(call.client_reference_id).toBe("user_sub");
      expect(call.integration_identifier).toMatch(/^svg_[a-z0-9_]+_[a-z]{8}$/);
    }
  });

  it("accepts the previous Pro yearly env name", () => {
    delete process.env.STRIPE_PRICE_PRO_YEARLY;
    process.env.STRIPE_PRICE_PERFORMANCE_YEAR = "price_year_legacy";
    expect(priceIdForPlan("performance_year")).toBe("price_year_legacy");
  });
});
