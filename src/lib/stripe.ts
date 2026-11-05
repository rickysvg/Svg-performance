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

/** Pro monthly, Pro yearly, and VIP monthly. Stripe trials the subscription for 7 days. */
export const CHECKOUT_TRIAL_DAYS = 7;

const TRIAL_PLANS = new Set<CheckoutSkuId>([
  "performance_monthly",
  "performance_year",
  "coaching_monthly",
]);

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

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    throw new Error("Live Stripe secret keys are not allowed in this preview.");
  }
  return new StripeClient(key);
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
    plan: CheckoutSkuId;
    successUrl: string;
    cancelUrl: string;
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
  const trialDays = subscriptionTrialDays(input.plan);
  const metadata: Record<string, string> = {
    userId: input.userId,
    plan: input.plan,
    priceId: price,
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price, quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    integration_identifier: checkoutIntegrationId(input.plan),
  };
  if (input.email) {
    params.customer_email = input.email;
  }
  return stripe.checkout.sessions.create(params);
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
