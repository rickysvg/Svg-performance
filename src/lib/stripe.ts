import Stripe from "stripe";
import {
  checkoutPaymentMethodTypes,
  isBnplStripeError,
  SKU_AMOUNT_CENTS,
} from "@/lib/bnpl";
import type { CheckoutSkuId } from "@/lib/plans";
import { CHECKOUT_SKUS } from "@/lib/plans";
import { randomLetterSuffix, readPriceEnv } from "@/lib/stripe-prices";

/**
 * The Node SDK exports the client class as `Stripe`. Call it StripeClient
 * and always construct an instance. Do not assign a module-level API key.
 */
const StripeClient = Stripe;

/** Full no-card allowance for a new member. VIP never uses this. */
export const CHECKOUT_TRIAL_DAYS = 7;

const TRIAL_PLANS = new Set<CheckoutSkuId>(["performance_monthly", "performance_year"]);

/**
 * Buy-now-pay-later does not fit a recurring plan. Card, Link, and card wallets
 * stay available through dynamic payment methods.
 */
export const SUBSCRIPTION_EXCLUDED_PAYMENT_METHODS = [
  "affirm",
  "afterpay_clearpay",
  "alma",
  "billie",
  "klarna",
  "scalapay",
  "sunbit",
  "zip",
] as const;

export function appBaseUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export function checkoutIntegrationId(flow: string) {
  return `svg_${flow}_${randomLetterSuffix()}`;
}

export function subscriptionTrialDays(plan: CheckoutSkuId) {
  return TRIAL_PLANS.has(plan) ? CHECKOUT_TRIAL_DAYS : undefined;
}

export function isLiveStripeKey(key: string) {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/** Live charges only on the production deployment. Preview and local dev stay on test keys. */
export function liveStripeKeysAllowed() {
  return process.env.VERCEL_ENV === "production";
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    return null;
  }
  if (isLiveStripeKey(key) && !liveStripeKeysAllowed()) {
    throw new Error("Live Stripe secret keys are not allowed outside production.");
  }
  return new StripeClient(key);
}

/** Existing customer wins. Otherwise prefill the signed-in email. Stripe rejects both at once. */
export function checkoutCustomerFields(input: { email?: string | null; customerId?: string | null }) {
  const customerId = input.customerId?.trim();
  if (customerId) return { customer: customerId };
  const email = input.email?.trim();
  if (email) return { customer_email: email };
  return {};
}

export function constructStripeEvent(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  // Signature checks use STRIPE_WEBHOOK_SECRET. A placeholder instance is only
  // for the method call when the API key is absent. It is not logged.
  let client: Stripe | null = null;
  try {
    client = getStripe();
  } catch {
    client = null;
  }
  const stripe = client ?? new StripeClient("sk_test_signature_only");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function createSubscriptionCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    email?: string;
    customerId?: string | null;
    plan: CheckoutSkuId;
    successUrl: string;
    cancelUrl: string;
    /** Pass 0 to bill today. Omit to use the plan default (Pro 7, VIP none). */
    trialPeriodDays?: number;
  },
) {
  const sku = CHECKOUT_SKUS[input.plan];
  if (sku.checkoutMode !== "subscription") {
    throw new Error(`${input.plan} is not a subscription.`);
  }
  const price = readPriceEnv(sku.envPrice);
  if (!price) {
    throw new Error(`${sku.envPrice} is not set.`);
  }
  const trialDays =
    input.trialPeriodDays === undefined
      ? subscriptionTrialDays(input.plan)
      : input.trialPeriodDays > 0
        ? input.trialPeriodDays
        : undefined;
  const metadata: Record<string, string> = {
    userId: input.userId,
    plan: input.plan,
    priceId: price,
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    ...checkoutCustomerFields({ email: input.email, customerId: input.customerId }),
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price, quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    excluded_payment_method_types: [...SUBSCRIPTION_EXCLUDED_PAYMENT_METHODS],
    integration_identifier: checkoutIntegrationId(input.plan),
  };
  return stripe.checkout.sessions.create(params);
}

export async function createBillingPortalSession(
  stripe: Stripe,
  input: { customerId: string; returnUrl: string },
) {
  const configuration = process.env.STRIPE_PORTAL_CONFIG_ID?.trim();
  return stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
    ...(configuration ? { configuration } : {}),
  });
}

export async function createBnplCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    plan: CheckoutSkuId;
    successUrl: string;
    cancelUrl: string;
  },
) {
  const sku = CHECKOUT_SKUS[input.plan];
  const price = process.env[sku.envPrice];
  if (!price) {
    throw new Error(`${sku.envPrice} is not set.`);
  }
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: sku.checkoutMode,
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price, quantity: 1 }],
    metadata: { userId: input.userId, plan: input.plan },
    ...(sku.checkoutMode === "subscription"
      ? { subscription_data: { metadata: { userId: input.userId, plan: input.plan } } }
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
