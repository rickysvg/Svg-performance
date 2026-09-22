import type { CheckoutSkuId } from "@/lib/plans";

/** Stripe TEST only. Live Affirm/Klarna keys are not used in this preview. */

/** Stripe Affirm Checkout: USD, typically $50–$30,000. */
export const AFFIRM_MIN_CENTS = 5000;

/** Stripe Klarna Checkout: USD; pay-over-time often from about $10. */
export const KLARNA_MIN_CENTS = 1000;

/** Afterpay/Clearpay (similar BNPL) often from about $35 USD. */
export const AFTERPAY_MIN_CENTS = 3500;

export const BNPL_CURRENCY = "usd";

export const BNPL_COPY = {
  whenAvailable:
    "Pay over time with Affirm or Klarna when available. Affirm or Klarna decide approval — SVG does not store loan details. Not everyone qualifies. Higher-ticket plans and intensives are the main use case.",
  comingSoon:
    "Affirm / Klarna at checkout is coming soon. It turns on when Stripe TEST keys are set and Affirm and Klarna are enabled in the Stripe Dashboard (TEST). We do not fake a successful buy.",
  keysOn:
    "TEST checkout can offer Affirm, Klarna, or similar pay-over-time when the amount, currency, and Stripe Dashboard payment methods allow. Still TEST — no live charges. Approval is theirs, not SVG’s.",
} as const;

export const SKU_AMOUNT_CENTS: Record<CheckoutSkuId, number> = {
  gym: 1900,
  standalone: 2900,
  performance_gym: 1900,
  performance_non: 2900,
  conditioning_gym: 4900,
  conditioning_non: 5900,
  development_gym: 14900,
  development_non: 17900,
  elite_gym: 29900,
  elite_non: 34900,
  vip: 69900,
  platinum: 119900,
};

export type CheckoutPaymentMethod = "card" | "klarna" | "affirm" | "afterpay_clearpay";

export function checkoutPaymentMethodTypes(
  amountCents: number,
  currency = BNPL_CURRENCY,
): CheckoutPaymentMethod[] {
  const methods: CheckoutPaymentMethod[] = ["card"];
  if (currency.toLowerCase() !== BNPL_CURRENCY) {
    return methods;
  }
  if (amountCents >= KLARNA_MIN_CENTS) methods.push("klarna");
  if (amountCents >= AFTERPAY_MIN_CENTS) methods.push("afterpay_clearpay");
  if (amountCents >= AFFIRM_MIN_CENTS) methods.push("affirm");
  return methods;
}

export function skuOffersBnpl(plan: CheckoutSkuId) {
  return checkoutPaymentMethodTypes(SKU_AMOUNT_CENTS[plan]).some((method) => method !== "card");
}

/** Highlight copy on higher-ticket SKUs (Affirm minimum and up). */
export function skuHighlightsFinancing(plan: CheckoutSkuId) {
  return SKU_AMOUNT_CENTS[plan] >= AFFIRM_MIN_CENTS;
}

export function financingStatusCopy(stripeConfigured: boolean) {
  return stripeConfigured ? BNPL_COPY.keysOn : BNPL_COPY.comingSoon;
}

export function isBnplStripeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    type?: string;
    code?: string;
    message?: string;
    raw?: { message?: string; param?: string };
  };
  const message = `${record.message ?? ""} ${record.raw?.message ?? ""} ${record.raw?.param ?? ""}`.toLowerCase();
  const param = (record.raw?.param ?? "").toLowerCase();
  return (
    param === "payment_method_types" ||
    param === "automatic_payment_methods" ||
    message.includes("affirm") ||
    message.includes("klarna") ||
    message.includes("afterpay") ||
    message.includes("payment_method_types") ||
    message.includes("automatic_payment_methods")
  );
}
