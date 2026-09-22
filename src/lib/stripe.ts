import Stripe from "stripe";
import {
  checkoutPaymentMethodTypes,
  isBnplStripeError,
  SKU_AMOUNT_CENTS,
} from "@/lib/bnpl";
import type { CheckoutSkuId } from "@/lib/plans";
import { CHECKOUT_SKUS } from "@/lib/plans";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (key.startsWith("sk_live_")) {
    throw new Error("Live Stripe secret keys are not allowed in this preview.");
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

export async function createBnplCheckoutSession(
  stripe: Stripe,
  input: {
    userId: string;
    plan: CheckoutSkuId;
    successUrl: string;
    cancelUrl: string;
  },
) {
  const price = process.env[CHECKOUT_SKUS[input.plan].envPrice];
  if (!price) {
    throw new Error(`${CHECKOUT_SKUS[input.plan].envPrice} is not set.`);
  }
  const base: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price, quantity: 1 }],
    metadata: { userId: input.userId, plan: input.plan },
    subscription_data: { metadata: { userId: input.userId, plan: input.plan } },
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
