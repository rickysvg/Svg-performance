import { ACADEMY_INCLUDES, COACHING_INCLUDES, MEMBER_PRO_DAYS, PRO_INCLUDES } from "@/lib/pricing";
/** Matches Coach topics: martial art (striking/grappling), conditioning, mental. */
export const COACH_AI_TRAINED_ON =
  "striking, grappling, strength and conditioning, and fight mindset";

export const COACH_AI_BLURB = `SVG Coach is an AI coach trained on ${COACH_AI_TRAINED_ON}.`;

export const COACH_AI_SHORT = "SVG Coach (AI coach)";

export const AI_DISCLAIMER = `${COACH_AI_BLURB} For injuries or pain, talk to a coach or doctor.`;

export const CATALOG_PLAN_IDS = [
  "member_access",
  "academy",
  "performance",
  "coaching",
  "fighter_conditioning",
  "fighter_development",
  "elite",
  "vip",
  "platinum",
] as const;

export type CatalogPlanId = (typeof CATALOG_PLAN_IDS)[number];

export const CREDIT_KINDS = [
  "coaching_call_30",
  "video_review",
  "checkin_30",
  "private_60",
  "strategy_45",
] as const;

export type CreditKind = (typeof CREDIT_KINDS)[number];

export const CREDIT_LABELS: Record<CreditKind, string> = {
  coaching_call_30: "30-min coaching call",
  video_review: "Video review (clip ≤ 5 min)",
  checkin_30: "30-min check-in",
  private_60: "60-min private lesson",
  strategy_45: "45-min mindset or entrepreneur strategy call",
};

export type FeatureId =
  | "training"
  | "progress"
  | "shop"
  | "learn_beginner"
  | "learn_full"
  | "nutrition"
  | "ai"
  | "conditioning"
  | "coaching"
  | "daily_quote"
  | "mobility_pro"
  | "fight_camp"
  | "form_check"
  | "progress_history"
  /** Pro only: coach speech (flagged off), AI feedback, sparring trends, RIR auto-adjust. */
  | "ai_voice"
  | "read_aloud"
  | "ai_feedback"
  | "sparring_trends"
  | "rir_auto";

export type PlanCredits = Partial<Record<CreditKind, number>>;

export type CatalogPlan = {
  id: CatalogPlanId;
  section: "app" | "coaching" | "vip";
  label: string;
  gymPriceLabel: string;
  nonmemberPriceLabel: string;
  summary: string;
  includes: string[];
  rank: number;
  features: FeatureId[];
  credits: PlanCredits;
  cap: number | null;
  responseTime: string | null;
};

export const PLAN_CATALOG: Record<CatalogPlanId, CatalogPlan> = {
  member_access: {
    id: "member_access",
    section: "app",
    label: "Trial ended",
    gymPriceLabel: "Pro required",
    nonmemberPriceLabel: "Pro required",
    summary:
      "Your 7-day Pro trial ended. Subscribe to Pro to keep training in the app. You can still view and export your past data.",
    includes: ["View your past workouts", "Export your data"],
    rank: 0,
    features: ["progress", "shop"],
    credits: {},
    cap: null,
    responseTime: null,
  },
  academy: {
    id: "academy",
    section: "app",
    label: "Academy member",
    gymPriceLabel: "Included in dues",
    nonmemberPriceLabel: "Academy members only",
    summary:
      `Included with SVG Academy dues for verified members. Pro is free for your first ${MEMBER_PRO_DAYS} days, no card, never auto-billed.`,
    includes: [...ACADEMY_INCLUDES],
    rank: 0.5,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "mobility_pro",
      "form_check",
    ],
    credits: {},
    cap: null,
    responseTime: null,
  },
  performance: {
    id: "performance",
    section: "app",
    label: "SVG Pro",
    gymPriceLabel: "$9.99/mo",
    nonmemberPriceLabel: "$9.99/mo",
    summary:
      "$9.99/month or $72.99/year, save 39%, for everyone, academy members included.",
    includes: [...PRO_INCLUDES],
    rank: 1,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
      "ai_voice",
      "read_aloud",
      "ai_feedback",
      "sparring_trends",
      "rir_auto",
    ],
    credits: {},
    cap: null,
    responseTime: null,
  },
  coaching: {
    id: "coaching",
    section: "coaching",
    label: "VIP Coaching",
    gymPriceLabel: "$249/mo",
    nonmemberPriceLabel: "$249/mo",
    summary:
      "A program Ricky writes. Limited spots. Includes Pro. Replies within 48 hours.",
    includes: [...COACHING_INCLUDES],
    rank: 7,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "coaching",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: { checkin_30: 4, video_review: 4 },
    cap: 20,
    responseTime: "Within 48 hours",
  },
  fighter_conditioning: {
    id: "fighter_conditioning",
    section: "app",
    label: "Fighter Conditioning",
    gymPriceLabel: "$49/mo",
    nonmemberPriceLabel: "$59/mo",
    summary: "Performance plus shared combat S&C / mobility programming.",
    includes: [
      "Everything in Performance",
      "Structured S&C / mobility for combat athletes",
      "Fresh blocks and benchmarks (when published)",
      "Equipment alternatives",
      "Shared programming — not 1:1 coaching",
    ],
    rank: 2,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: {},
    cap: null,
    responseTime: null,
  },
  fighter_development: {
    id: "fighter_development",
    section: "coaching",
    label: "Fighter Development",
    gymPriceLabel: "$149/mo",
    nonmemberPriceLabel: "$179/mo",
    summary: "Conditioning plus a monthly human adjustment and reviews.",
    includes: [
      "Everything in Fighter Conditioning",
      "Monthly training adjustment",
      "One 30-min coaching call per billing month",
      "Two video reviews (clips ≤ 5 min) per billing month",
    ],
    rank: 3,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "coaching",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: { coaching_call_30: 1, video_review: 2 },
    cap: null,
    responseTime: null,
  },
  elite: {
    id: "elite",
    section: "coaching",
    label: "Elite Online Coaching",
    gymPriceLabel: "$299/mo",
    nonmemberPriceLabel: "$349/mo",
    summary: "Main premium offer: individualized online coaching. Limited seats.",
    includes: [
      "Fully individualized training",
      "Weekly written progress reviews (fixed monthly quantity, not a 24/7 inbox)",
      "Two 30-min check-ins per billing month",
      "Habit / nutrition accountability",
      "Two short video reviews per billing month",
    ],
    rank: 4,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "coaching",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: { checkin_30: 2, video_review: 2 },
    cap: 6,
    responseTime: "Within 2 business days",
  },
  vip: {
    id: "vip",
    section: "vip",
    label: "SVG VIP",
    gymPriceLabel: "$699",
    nonmemberPriceLabel: "$699",
    summary: "One-time El Paso intensive. Includes 1 month of Fighter Development.",
    includes: [
      "1 month of Fighter Development",
      "In-person El Paso intensive with Ricky",
      "Lessons in El Paso with Ricky, or live online when appropriate",
    ],
    rank: 5,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "coaching",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: { checkin_30: 2, video_review: 2, private_60: 4, strategy_45: 1 },
    cap: 2,
    responseTime: "Within 2 business days",
  },
  platinum: {
    id: "platinum",
    section: "vip",
    label: "Platinum VIP",
    gymPriceLabel: "$1,199",
    nonmemberPriceLabel: "$1,199",
    summary: "One-time El Paso intensive. Includes 1 month of Elite Online.",
    includes: [
      "1 month of Elite Online Coaching",
      "In-person El Paso intensive with Ricky",
      "Priority booking",
      "Platinum intensive eligibility (add-on, quoted separately)",
    ],
    rank: 6,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "conditioning",
      "coaching",
      "daily_quote",
      "mobility_pro",
      "fight_camp",
      "form_check",
      "progress_history",
    ],
    credits: { checkin_30: 2, video_review: 2, private_60: 8, strategy_45: 2 },
    cap: 1,
    responseTime: "Next business day",
  },
};

export const PLAN_CAPS = {
  elite: PLAN_CATALOG.elite.cap ?? 6,
  vip: PLAN_CATALOG.vip.cap ?? 2,
  platinum: PLAN_CATALOG.platinum.cap ?? 1,
  coaching: PLAN_CATALOG.coaching.cap ?? 20,
} as const;

export type CheckoutSkuId =
  | "gym"
  | "standalone"
  | "performance_gym"
  | "performance_non"
  | "performance_annual_gym"
  | "performance_annual_non"
  | "conditioning_gym"
  | "conditioning_non"
  | "conditioning_camp_gym"
  | "conditioning_camp_non"
  | "conditioning_annual_gym"
  | "conditioning_annual_non"
  | "development_gym"
  | "development_non"
  | "development_3mo_gym"
  | "development_3mo_non"
  | "development_6mo_gym"
  | "development_6mo_non"
  | "elite_gym"
  | "elite_non"
  | "elite_3mo_gym"
  | "elite_3mo_non"
  | "elite_6mo_gym"
  | "elite_6mo_non"
  | "vip"
  | "platinum"
  | "performance_monthly"
  | "performance_year"
  | "coaching_monthly";

export type CheckoutSku = {
  id: CheckoutSkuId;
  catalogId: CatalogPlanId;
  audience: "gym" | "nonmember" | "both";
  envPrice: string;
  amountLabel: string;
  amountCents: number;
  requiresGymVerify: boolean;
  checkoutEnabled: boolean;
  checkoutMode: "subscription" | "payment";
};

export const CHECKOUT_SKUS: Record<CheckoutSkuId, CheckoutSku> = {
  gym: {
    id: "gym",
    catalogId: "performance",
    audience: "gym",
    envPrice: "STRIPE_PRICE_GYM",
    amountLabel: "$9.99/mo",
    amountCents: 999,
    requiresGymVerify: true,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  standalone: {
    id: "standalone",
    catalogId: "performance",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_STANDALONE",
    amountLabel: "$9.99/mo",
    amountCents: 999,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  performance_gym: {
    id: "performance_gym",
    catalogId: "performance",
    audience: "gym",
    envPrice: "STRIPE_PRICE_GYM",
    amountLabel: "$9.99/mo",
    amountCents: 999,
    requiresGymVerify: true,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  performance_non: {
    id: "performance_non",
    catalogId: "performance",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_STANDALONE",
    amountLabel: "$9.99/mo",
    amountCents: 999,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  performance_annual_gym: {
    id: "performance_annual_gym",
    catalogId: "performance",
    audience: "gym",
    envPrice: "STRIPE_PRICE_PERFORMANCE_ANNUAL_GYM",
    amountLabel: "$72.99/yr",
    amountCents: 7299,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  performance_annual_non: {
    id: "performance_annual_non",
    catalogId: "performance",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_PERFORMANCE_ANNUAL_NON",
    amountLabel: "$72.99/yr",
    amountCents: 7299,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  conditioning_gym: {
    id: "conditioning_gym",
    catalogId: "fighter_conditioning",
    audience: "gym",
    envPrice: "STRIPE_PRICE_CONDITIONING_GYM",
    amountLabel: "$49/mo",
    amountCents: 4900,
    requiresGymVerify: true,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  conditioning_non: {
    id: "conditioning_non",
    catalogId: "fighter_conditioning",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_CONDITIONING_NON",
    amountLabel: "$59/mo",
    amountCents: 5900,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  conditioning_camp_gym: {
    id: "conditioning_camp_gym",
    catalogId: "fighter_conditioning",
    audience: "gym",
    envPrice: "STRIPE_PRICE_CONDITIONING_CAMP_GYM",
    amountLabel: "$125",
    amountCents: 12500,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  conditioning_camp_non: {
    id: "conditioning_camp_non",
    catalogId: "fighter_conditioning",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_CONDITIONING_CAMP_NON",
    amountLabel: "$149",
    amountCents: 14900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  conditioning_annual_gym: {
    id: "conditioning_annual_gym",
    catalogId: "fighter_conditioning",
    audience: "gym",
    envPrice: "STRIPE_PRICE_CONDITIONING_ANNUAL_GYM",
    amountLabel: "$389",
    amountCents: 38900,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  conditioning_annual_non: {
    id: "conditioning_annual_non",
    catalogId: "fighter_conditioning",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_CONDITIONING_ANNUAL_NON",
    amountLabel: "$469",
    amountCents: 46900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  development_gym: {
    id: "development_gym",
    catalogId: "fighter_development",
    audience: "gym",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_GYM",
    amountLabel: "$149/mo",
    amountCents: 14900,
    requiresGymVerify: true,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  development_non: {
    id: "development_non",
    catalogId: "fighter_development",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_NON",
    amountLabel: "$179/mo",
    amountCents: 17900,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  development_3mo_gym: {
    id: "development_3mo_gym",
    catalogId: "fighter_development",
    audience: "gym",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_3MO_GYM",
    amountLabel: "$399",
    amountCents: 39900,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  development_3mo_non: {
    id: "development_3mo_non",
    catalogId: "fighter_development",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_3MO_NON",
    amountLabel: "$479",
    amountCents: 47900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  development_6mo_gym: {
    id: "development_6mo_gym",
    catalogId: "fighter_development",
    audience: "gym",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_6MO_GYM",
    amountLabel: "$759",
    amountCents: 75900,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  development_6mo_non: {
    id: "development_6mo_non",
    catalogId: "fighter_development",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_6MO_NON",
    amountLabel: "$909",
    amountCents: 90900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  elite_gym: {
    id: "elite_gym",
    catalogId: "elite",
    audience: "gym",
    envPrice: "STRIPE_PRICE_ELITE_GYM",
    amountLabel: "$299/mo",
    amountCents: 29900,
    requiresGymVerify: true,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  elite_non: {
    id: "elite_non",
    catalogId: "elite",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_ELITE_NON",
    amountLabel: "$349/mo",
    amountCents: 34900,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "subscription",
  },
  elite_3mo_gym: {
    id: "elite_3mo_gym",
    catalogId: "elite",
    audience: "gym",
    envPrice: "STRIPE_PRICE_ELITE_3MO_GYM",
    amountLabel: "$799",
    amountCents: 79900,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  elite_3mo_non: {
    id: "elite_3mo_non",
    catalogId: "elite",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_ELITE_3MO_NON",
    amountLabel: "$939",
    amountCents: 93900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  elite_6mo_gym: {
    id: "elite_6mo_gym",
    catalogId: "elite",
    audience: "gym",
    envPrice: "STRIPE_PRICE_ELITE_6MO_GYM",
    amountLabel: "$1,519",
    amountCents: 151900,
    requiresGymVerify: true,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  elite_6mo_non: {
    id: "elite_6mo_non",
    catalogId: "elite",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_ELITE_6MO_NON",
    amountLabel: "$1,779",
    amountCents: 177900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "payment",
  },
  vip: {
    id: "vip",
    catalogId: "vip",
    audience: "both",
    envPrice: "STRIPE_PRICE_VIP",
    amountLabel: "$699",
    amountCents: 69900,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "payment",
  },
  platinum: {
    id: "platinum",
    catalogId: "platinum",
    audience: "both",
    envPrice: "STRIPE_PRICE_PLATINUM",
    amountLabel: "$1,199",
    amountCents: 119900,
    requiresGymVerify: false,
    checkoutEnabled: true,
    checkoutMode: "payment",
  },
  performance_monthly: {
    id: "performance_monthly",
    catalogId: "performance",
    audience: "both",
    envPrice: "STRIPE_PRICE_PERFORMANCE_MONTHLY",
    amountLabel: "$9.99/mo",
    amountCents: 999,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "subscription",
  },
  performance_year: {
    id: "performance_year",
    catalogId: "performance",
    audience: "both",
    envPrice: "STRIPE_PRICE_PERFORMANCE_YEAR",
    amountLabel: "$72.99/yr",
    amountCents: 7299,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "subscription",
  },
  coaching_monthly: {
    id: "coaching_monthly",
    catalogId: "coaching",
    audience: "both",
    envPrice: "STRIPE_PRICE_COACHING_MONTHLY",
    amountLabel: "$249/mo",
    amountCents: 24900,
    requiresGymVerify: false,
    checkoutEnabled: false,
    checkoutMode: "subscription",
  },
};

/** Legacy names used by existing Stripe TEST docs and tests. */
export const PLANS = {
  gym: {
    id: "gym" as const,
    label: "SVG Pro (verified gym)",
    amountLabel: "$9.99/mo",
    envPrice: "STRIPE_PRICE_GYM",
  },
  standalone: {
    id: "standalone" as const,
    label: "SVG Pro",
    amountLabel: "$9.99/mo",
    envPrice: "STRIPE_PRICE_STANDALONE",
  },
};

export function isCatalogPlanId(value: string): value is CatalogPlanId {
  return (CATALOG_PLAN_IDS as readonly string[]).includes(value);
}

export function isCheckoutSkuId(value: string): value is CheckoutSkuId {
  return Object.prototype.hasOwnProperty.call(CHECKOUT_SKUS, value);
}

export function isPlanId(value: string): value is CheckoutSkuId {
  return isCheckoutSkuId(value);
}

export function normalizePlanId(plan: string): CatalogPlanId {
  if (plan === "gym" || plan === "standalone" || plan.startsWith("performance_")) {
    return "performance";
  }
  if (plan.startsWith("conditioning_")) return "fighter_conditioning";
  if (plan.startsWith("development_")) return "fighter_development";
  if (plan.startsWith("elite_")) return "elite";
  if (plan === "coaching" || plan.startsWith("coaching_")) return "coaching";
  if (isCatalogPlanId(plan)) return plan;
  return "member_access";
}

const PRO_FEATURES: readonly FeatureId[] = [
  "ai_voice",
  "read_aloud",
  "ai_feedback",
  "sparring_trends",
  "rir_auto",
  "progress_history",
];

export function planHasFeature(plan: CatalogPlanId, feature: FeatureId) {
  if (PLAN_CATALOG[plan].features.includes(feature)) return true;
  // Every paid plan at Pro or above includes Pro.
  return PRO_FEATURES.includes(feature) && PLAN_CATALOG[plan].rank >= PLAN_CATALOG.performance.rank;
}

/** Pro or above: an active subscription, the 7-day trial, or the member Pro grant. */
export function planIsPro(plan: CatalogPlanId) {
  return PLAN_CATALOG[plan].rank >= PLAN_CATALOG.performance.rank;
}

export function planAtLeast(planId: CatalogPlanId, minimum: CatalogPlanId) {
  return PLAN_CATALOG[planId].rank >= PLAN_CATALOG[minimum].rank;
}

/** Fighter Development+ — coach/Ricky comment slots, journal feedback. */
export function planHasCoachReview(planId: CatalogPlanId) {
  return planAtLeast(planId, "fighter_development");
}

/** Elite+ — weekly review + simple adjustment log. */
export function planHasEliteReview(planId: CatalogPlanId) {
  return planAtLeast(planId, "elite");
}

export function plansInSection(section: CatalogPlan["section"]) {
  return CATALOG_PLAN_IDS.map((id) => PLAN_CATALOG[id]).filter((plan) => plan.section === section);
}

export const BOOKING_KINDS = [
  "mindset",
  "entrepreneur",
  "intensive_elpaso",
  "intensive_travel",
] as const;

export type BookingKind = (typeof BOOKING_KINDS)[number];

export const BOOKING_OFFERS = {
  mindset: {
    id: "mindset" as const,
    label: "Fighter Mindset",
    priceLabel: "$75",
    duration: "30 min",
    summary: "Standalone extra. Not included with the app plans.",
  },
  entrepreneur: {
    id: "entrepreneur" as const,
    label: "Entrepreneur Strategy",
    priceLabel: "$125",
    duration: "45 min",
    summary: "Standalone extra. No promised business results. Training check-ins stay separate.",
  },
  intensive_elpaso: {
    id: "intensive_elpaso" as const,
    label: "Platinum intensive — you travel to El Paso",
    priceLabel: "$1,500 package / $900 add-on after $600 lesson credit",
    duration: "3 days",
    summary:
      "Six 60-min privates, three 30-min daily strategy/reviews, written action plan, one 30-min follow-up. Request only — not a live deposit.",
  },
  intensive_travel: {
    id: "intensive_travel" as const,
    label: "Platinum intensive — Ricky travels",
    priceLabel: "From $4,500 / from $3,900 after $600 credit + travel expenses",
    duration: "3 days",
    summary: "Same package. Travel expenses quoted separately. Request only — not a live deposit.",
  },
};

export function isBookingKind(value: string): value is BookingKind {
  return (BOOKING_KINDS as readonly string[]).includes(value);
}

/** Active monthly / one-time display SKUs — gym/standalone stay webhook aliases. New prepaid SKUs stay inactive. */
export function publicSkusForPlan(catalogId: CatalogPlanId) {
  return (Object.values(CHECKOUT_SKUS) as CheckoutSku[]).filter(
    (row) =>
      row.catalogId === catalogId &&
      row.checkoutEnabled &&
      row.id !== "gym" &&
      row.id !== "standalone",
  );
}

