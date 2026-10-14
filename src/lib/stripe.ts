import Stripe from "stripe";
import { AppError } from "@/lib/errors";
import {
  checkoutPaymentMethodTypes,
  isBnplStripeError,
  SKU_AMOUNT_CENTS,
} from "@/lib/bnpl";
import type { CheckoutSkuId } from "@/lib/plans";
import { CHECKOUT_SKUS } from "@/lib/plans";

export type StripeKeyMode = "unconfigured" | "test" | "live" | "invalid";

export function stripeKeyMode(): StripeKeyMode {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "unconfigured";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "invalid";
}

/** Test and live secret keys are both accepted. Admin shows which mode is on. */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    return null;
  }
  const mode = stripeKeyMode();
  if (mode === "invalid") {
    throw new Error("STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_ or sk_live_).");
  }
  return new Stripe(key);
}

export function constructStripeEvent(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}

/** Public origin for Checkout success/cancel and the billing portal return. */
export function appBaseUrl() {
  const raw = process.env.APP_URL?.trim() ?? "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "BILLING",
        "APP_URL is not set. Checkout needs the public app URL.",
      );
    }
    return "http://localhost:3000";
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("BILLING", "APP_URL is not a valid URL.");
  }
  if (process.env.NODE_ENV === "production") {
    if (url.protocol !== "https:") {
      throw new AppError("BILLING", "APP_URL must be https in production.");
    }
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      throw new AppError("BILLING", "APP_URL must be the public site in production.");
    }
  }
  return raw.replace(/\/$/, "");
}

export function billingReturnUrls(base = appBaseUrl()) {
  return {
    successUrl: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/billing/cancel`,
    portalReturnUrl: `${base}/account/billing`,
  };
}

export async function createBillingPortalSession(
  stripe: Stripe,
  input: { customerId: string; returnUrl: string },
) {
  return stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

export async function createBnplCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    plan: CheckoutSkuId;
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
  },
) {
  const sku = CHECKOUT_SKUS[input.plan];
  const price = process.env[sku.envPrice];
  if (!price) {
    throw new Error(`${sku.envPrice} is not set.`);
  }
  const metadata = { userId: input.userId, plan: input.plan, priceId: price };
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: sku.checkoutMode,
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price, quantity: 1 }],
    metadata,
    ...(input.customerId
      ? { customer: input.customerId }
      : sku.checkoutMode === "payment"
        ? { customer_creation: "always" as const }
        : {}),
    ...(sku.checkoutMode === "subscription"
      ? { subscription_data: { metadata } }
      : {}),
  };
  const methods = checkoutPaymentMethodTypes(SKU_AMOUNT_CENTS[input.plan]);
  try {
    return await stripe.checkout.sessions.create({
      ...base,
      payment_method_types: methods as Stripe.Checkout.SessionCreateParams["payment_method_types"],
    });
  } catch (error) {
    if (!isBnplStripeError(error)) throw error;
    try {
      return await stripe.checkout.sessions.create({
        ...base,
        automatic_payment_methods: { enabled: true },
      } as Stripe.Checkout.SessionCreateParams);
    } catch (fallbackError) {
      if (!isBnplStripeError(fallbackError)) throw fallbackError;
      return stripe.checkout.sessions.create({
        ...base,
        payment_method_types: ["card"],
      });
    }
  }
}
