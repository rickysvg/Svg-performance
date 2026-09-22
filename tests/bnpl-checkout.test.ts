import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  AFFIRM_MIN_CENTS,
  AFTERPAY_MIN_CENTS,
  BNPL_COPY,
  checkoutPaymentMethodTypes,
  financingStatusCopy,
  isBnplStripeError,
  KLARNA_MIN_CENTS,
  skuHighlightsFinancing,
  skuOffersBnpl,
  SKU_AMOUNT_CENTS,
} from "@/lib/bnpl";
import { createBnplCheckoutSession, getStripe } from "@/lib/stripe";

function restoreStripeEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Affirm / Klarna TEST checkout helpers", () => {
  const envSnapshot = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_PLATINUM: process.env.STRIPE_PRICE_PLATINUM,
    STRIPE_PRICE_STANDALONE: process.env.STRIPE_PRICE_STANDALONE,
  };

  afterEach(() => {
    restoreStripeEnv(envSnapshot);
  });

  it("keeps card only below Klarna’s typical USD minimum", () => {
    expect(checkoutPaymentMethodTypes(KLARNA_MIN_CENTS - 1)).toEqual(["card"]);
  });

  it("adds Klarna from about $10 USD, Afterpay from $35, Affirm from $50", () => {
    expect(checkoutPaymentMethodTypes(KLARNA_MIN_CENTS)).toEqual(["card", "klarna"]);
    expect(checkoutPaymentMethodTypes(AFTERPAY_MIN_CENTS)).toEqual([
      "card",
      "klarna",
      "afterpay_clearpay",
    ]);
    expect(checkoutPaymentMethodTypes(AFFIRM_MIN_CENTS)).toEqual([
      "card",
      "klarna",
      "afterpay_clearpay",
      "affirm",
    ]);
    expect(checkoutPaymentMethodTypes(1900, "eur")).toEqual(["card"]);
  });

  it("offers Klarna on $19/$29 Performance SKUs but not Affirm", () => {
    expect(SKU_AMOUNT_CENTS.gym).toBe(1900);
    expect(SKU_AMOUNT_CENTS.standalone).toBe(2900);
    expect(checkoutPaymentMethodTypes(SKU_AMOUNT_CENTS.gym)).toEqual(["card", "klarna"]);
    expect(skuOffersBnpl("gym")).toBe(true);
    expect(skuHighlightsFinancing("gym")).toBe(false);
    expect(skuHighlightsFinancing("standalone")).toBe(false);
  });

  it("highlights higher-ticket plans that meet the Affirm minimum", () => {
    expect(skuHighlightsFinancing("conditioning_gym")).toBe(false);
    expect(skuHighlightsFinancing("conditioning_non")).toBe(true);
    expect(skuHighlightsFinancing("platinum")).toBe(true);
    expect(checkoutPaymentMethodTypes(SKU_AMOUNT_CENTS.platinum)).toContain("affirm");
    expect(checkoutPaymentMethodTypes(SKU_AMOUNT_CENTS.platinum)).toContain("klarna");
  });

  it("uses coming-soon copy without keys and TEST copy when keys exist", () => {
    expect(financingStatusCopy(false)).toBe(BNPL_COPY.comingSoon);
    expect(financingStatusCopy(true)).toBe(BNPL_COPY.keysOn);
    expect(BNPL_COPY.whenAvailable).toContain("Pay over time with Affirm or Klarna when available");
    expect(BNPL_COPY.whenAvailable).toContain("SVG does not store loan details");
    expect(BNPL_COPY.whenAvailable).toContain("Not everyone qualifies");
    expect(BNPL_COPY.comingSoon).toContain("coming soon");
    expect(BNPL_COPY.comingSoon).toContain("We do not fake a successful buy");
  });

  it("detects BNPL payment-method Stripe errors without swallowing unrelated ones", () => {
    expect(
      isBnplStripeError({
        message: "Invalid payment_method_types: affirm is not enabled",
      }),
    ).toBe(true);
    expect(isBnplStripeError({ raw: { param: "automatic_payment_methods" } })).toBe(true);
    expect(isBnplStripeError({ message: "No such price: price_missing" })).toBe(false);
    expect(isBnplStripeError(null)).toBe(false);
  });

  it("returns no Stripe client without keys and rejects live secrets", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getStripe()).toBeNull();
    process.env.STRIPE_SECRET_KEY = "sk_live_not_allowed";
    expect(() => getStripe()).toThrow(/Live Stripe secret keys are not allowed/);
  });

  it("asks Checkout for Affirm/Klarna when the amount allows", async () => {
    process.env.STRIPE_PRICE_PLATINUM = "price_plat_test";
    const calls: Stripe.Checkout.SessionCreateParams[] = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            calls.push(params);
            return { url: "https://checkout.stripe.com/c/pay/cs_test_bnpl" };
          },
        },
      },
    } as unknown as Stripe;

    await createBnplCheckoutSession(stripe, {
      userId: "user_1",
      plan: "platinum",
      successUrl: "http://localhost:3000/billing/success",
      cancelUrl: "http://localhost:3000/billing/cancel",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].mode).toBe("subscription");
    expect(calls[0].payment_method_types).toEqual([
      "card",
      "klarna",
      "afterpay_clearpay",
      "affirm",
    ]);
    expect(calls[0].automatic_payment_methods).toBeUndefined();
  });

  it("falls back to automatic payment methods, then card, if Stripe rejects BNPL types", async () => {
    process.env.STRIPE_PRICE_PLATINUM = "price_plat_test";
    const calls: Stripe.Checkout.SessionCreateParams[] = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            calls.push(params);
            if (params.payment_method_types?.includes("affirm")) {
              throw { message: "The payment method type `affirm` is invalid for this mode" };
            }
            if (params.automatic_payment_methods?.enabled) {
              throw { message: "automatic_payment_methods is not compatible with this session" };
            }
            return { url: "https://checkout.stripe.com/c/pay/cs_test_card" };
          },
        },
      },
    } as unknown as Stripe;

    const session = await createBnplCheckoutSession(stripe, {
      userId: "user_2",
      plan: "platinum",
      successUrl: "http://localhost:3000/billing/success",
      cancelUrl: "http://localhost:3000/billing/cancel",
    });

    expect(calls).toHaveLength(3);
    expect(calls[0].payment_method_types).toContain("affirm");
    expect(calls[1].automatic_payment_methods).toEqual({ enabled: true });
    expect(calls[2].payment_method_types).toEqual(["card"]);
    expect(session.url).toContain("cs_test_card");
  });

  it("does not swallow a missing TEST price id as a fake BNPL success", async () => {
    delete process.env.STRIPE_PRICE_STANDALONE;
    const stripe = {
      checkout: {
        sessions: {
          create: async () => {
            throw new Error("should not create a session");
          },
        },
      },
    } as unknown as Stripe;

    await expect(
      createBnplCheckoutSession(stripe, {
        userId: "user_3",
        plan: "standalone",
        successUrl: "http://localhost:3000/billing/success",
        cancelUrl: "http://localhost:3000/billing/cancel",
      }),
    ).rejects.toThrow("STRIPE_PRICE_STANDALONE is not set");
  });
});
