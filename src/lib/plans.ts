export const AI_DISCLAIMER =
  "SVG Coach is an AI assistant. It is not Ricky and is not a message to Ricky. It does not book you, coach you live, or replace a human call.";

export const CATALOG_PLAN_IDS = [
  "member_access",
  "performance",
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
  | "daily_quote";

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
    label: "SVG Member Access",
    gymPriceLabel: "Included",
    nonmemberPriceLabel: "Free preview",
    summary:
      "Basic logging and selected beginner notes. Gym members get this with membership. Others get a free preview only.",
    includes: [
      "Basic workout + progress logging",
      "Selected beginner tutorials",
      "One starter DEMO program",
      "Gym announcements (when posted)",
      "Shop links to svgandco.com",
      "One free daily-quote teaser (full quotes on Performance+)",
    ],
    rank: 0,
    features: ["training", "progress", "shop", "learn_beginner"],
    credits: {},
    cap: null,
    responseTime: null,
  },
  performance: {
    id: "performance",
    section: "app",
    label: "SVG Performance",
    gymPriceLabel: "$19/mo",
    nonmemberPriceLabel: "$29/mo",
    summary: "Self-guided app: full library, fuel logging, and SVG Coach.",
    includes: [
      "Everything in Member Access",
      "Full general tutorial library",
      "Calorie / macro tracking (manual estimates)",
      "Meal ideas and progress charts",
      "SVG Coach (AI assistant, not Ricky)",
      "Daily motivational quote",
    ],
    rank: 1,
    features: [
      "training",
      "progress",
      "shop",
      "learn_beginner",
      "learn_full",
      "nutrition",
      "ai",
      "daily_quote",
    ],
    credits: {},
    cap: null,
    responseTime: null,
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
    ],
    credits: { checkin_30: 2, video_review: 2 },
    cap: 6,
    responseTime: "Within 2 business days",
  },
  vip: {
    id: "vip",
    section: "vip",
    label: "SVG VIP",
    gymPriceLabel: "$699/mo",
    nonmemberPriceLabel: "$699/mo",
    summary: "Elite Online plus in-person/online privates and one strategy call.",
    includes: [
      "Everything in Elite Online Coaching",
      "Four 60-min private lessons per billing month (not “weekly”)",
      "One 45-min mindset or entrepreneur strategy call per billing month",
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
    ],
    credits: { checkin_30: 2, video_review: 2, private_60: 4, strategy_45: 1 },
    cap: 2,
    responseTime: "Within 2 business days",
  },
  platinum: {
    id: "platinum",
    section: "vip",
    label: "Platinum VIP",
    gymPriceLabel: "$1,199/mo",
    nonmemberPriceLabel: "$1,199/mo",
    summary: "Highest monthly seat. Includes intensive eligibility.",
    includes: [
      "Everything in Elite Online Coaching",
      "Eight 60-min privates per billing month (not “weekly”)",
      "Two 45-min strategy calls per billing month (either topic)",
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
} as const;

export type CheckoutSkuId =
  | "gym"
  | "standalone"
  | "performance_gym"
  | "performance_non"
  | "conditioning_gym"
  | "conditioning_non"
  | "development_gym"
  | "development_non"
  | "elite_gym"
  | "elite_non"
  | "vip"
  | "platinum";

export type CheckoutSku = {
  id: CheckoutSkuId;
  catalogId: CatalogPlanId;
  audience: "gym" | "nonmember" | "both";
  envPrice: string;
  amountLabel: string;
  requiresGymVerify: boolean;
};

export const CHECKOUT_SKUS: Record<CheckoutSkuId, CheckoutSku> = {
  gym: {
    id: "gym",
    catalogId: "performance",
    audience: "gym",
    envPrice: "STRIPE_PRICE_GYM",
    amountLabel: "$19/mo",
    requiresGymVerify: true,
  },
  standalone: {
    id: "standalone",
    catalogId: "performance",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_STANDALONE",
    amountLabel: "$29/mo",
    requiresGymVerify: false,
  },
  performance_gym: {
    id: "performance_gym",
    catalogId: "performance",
    audience: "gym",
    envPrice: "STRIPE_PRICE_GYM",
    amountLabel: "$19/mo",
    requiresGymVerify: true,
  },
  performance_non: {
    id: "performance_non",
    catalogId: "performance",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_STANDALONE",
    amountLabel: "$29/mo",
    requiresGymVerify: false,
  },
  conditioning_gym: {
    id: "conditioning_gym",
    catalogId: "fighter_conditioning",
    audience: "gym",
    envPrice: "STRIPE_PRICE_CONDITIONING_GYM",
    amountLabel: "$49/mo",
    requiresGymVerify: true,
  },
  conditioning_non: {
    id: "conditioning_non",
    catalogId: "fighter_conditioning",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_CONDITIONING_NON",
    amountLabel: "$59/mo",
    requiresGymVerify: false,
  },
  development_gym: {
    id: "development_gym",
    catalogId: "fighter_development",
    audience: "gym",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_GYM",
    amountLabel: "$149/mo",
    requiresGymVerify: true,
  },
  development_non: {
    id: "development_non",
    catalogId: "fighter_development",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_DEVELOPMENT_NON",
    amountLabel: "$179/mo",
    requiresGymVerify: false,
  },
  elite_gym: {
    id: "elite_gym",
    catalogId: "elite",
    audience: "gym",
    envPrice: "STRIPE_PRICE_ELITE_GYM",
    amountLabel: "$299/mo",
    requiresGymVerify: true,
  },
  elite_non: {
    id: "elite_non",
    catalogId: "elite",
    audience: "nonmember",
    envPrice: "STRIPE_PRICE_ELITE_NON",
    amountLabel: "$349/mo",
    requiresGymVerify: false,
  },
  vip: {
    id: "vip",
    catalogId: "vip",
    audience: "both",
    envPrice: "STRIPE_PRICE_VIP",
    amountLabel: "$699/mo",
    requiresGymVerify: false,
  },
  platinum: {
    id: "platinum",
    catalogId: "platinum",
    audience: "both",
    envPrice: "STRIPE_PRICE_PLATINUM",
    amountLabel: "$1,199/mo",
    requiresGymVerify: false,
  },
};

/** Legacy names used by existing Stripe TEST docs and tests. */
export const PLANS = {
  gym: {
    id: "gym" as const,
    label: "SVG Performance (verified gym)",
    amountLabel: "$19/mo",
    envPrice: "STRIPE_PRICE_GYM",
  },
  standalone: {
    id: "standalone" as const,
    label: "SVG Performance (nonmember)",
    amountLabel: "$29/mo",
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
  if (plan === "gym" || plan === "standalone" || plan === "performance_gym" || plan === "performance_non") {
    return "performance";
  }
  if (plan === "conditioning_gym" || plan === "conditioning_non") return "fighter_conditioning";
  if (plan === "development_gym" || plan === "development_non") return "fighter_development";
  if (plan === "elite_gym" || plan === "elite_non") return "elite";
  if (isCatalogPlanId(plan)) return plan;
  return "member_access";
}

export function planHasFeature(plan: CatalogPlanId, feature: FeatureId) {
  return PLAN_CATALOG[plan].features.includes(feature);
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
    summary: "Standalone extra. VIP includes 1×45 strategy/month; Platinum includes 2×45 (either topic).",
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

/** Display SKUs only — gym/standalone stay as webhook aliases for $19 / $29. */
export function publicSkusForPlan(catalogId: CatalogPlanId) {
  return (Object.values(CHECKOUT_SKUS) as CheckoutSku[]).filter(
    (sku) => sku.catalogId === catalogId && sku.id !== "gym" && sku.id !== "standalone",
  );
}
