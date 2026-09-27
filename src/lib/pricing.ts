/** Ricky-approved USD prices. Member / regular. Payments are not live. */

export type PricePair = {
  member: number;
  regular: number;
};

export type AppTermId = "monthly" | "annual" | "fight_camp";
export type CoachingTermId = "monthly" | "prepaid_3mo" | "prepaid_6mo";
export type PricingView = "monthly" | "prepay";

export const COACHING_TERMS =
  "No contracts. Prepay for a program and save. Cancel anytime: we charge months used at the monthly rate and refund the rest.";

export const COACHING_MONEY_BACK = "First-month money-back guarantee";

export type FoundingDealConfig = {
  enabled: boolean;
  windowDays: number;
  memberCap: number;
  startsAtIso: string;
};

/**
 * One switch for the founding annual-app deal.
 * Set `enabled` to false to turn it off. Window and cap stay here.
 */
export const FOUNDING_DEAL: FoundingDealConfig = {
  enabled: true,
  windowDays: 90,
  memberCap: 250,
  startsAtIso: "2026-09-27T00:00:00.000Z",
};

export function foundingDealLine(config = FOUNDING_DEAL) {
  return `Founding member price, first ${config.windowDays} days or first ${config.memberCap} members`;
}

export const FOUNDING_DEAL_LINE = foundingDealLine();

export function foundingDealEndsAt(config = FOUNDING_DEAL) {
  const start = new Date(config.startsAtIso);
  return new Date(start.getTime() + config.windowDays * 24 * 60 * 60 * 1000);
}

export function isFoundingDealOpen(now = new Date(), enrolledCount = 0, config = FOUNDING_DEAL) {
  if (!config.enabled) return false;
  if (enrolledCount >= config.memberCap) return false;
  const start = new Date(config.startsAtIso);
  if (now < start || now > foundingDealEndsAt(config)) return false;
  return true;
}

export const PERFORMANCE_PRICES = {
  monthly: { member: 19, regular: 29 },
  annual: { member: 149, regular: 229, offLabel: "about 35% off" },
  foundingAnnual: { member: 119, regular: 179, offLabel: "about 20% off" },
} as const;

export const CONDITIONING_PRICES = {
  monthly: { member: 49, regular: 59 },
  fightCamp: { member: 125, regular: 149, brand: "12-Week Fight Camp" },
  annual: { member: 389, regular: 469 },
  foundingAnnual: { member: 309, regular: 369, offLabel: "about 20% off" },
} as const;

export const DEVELOPMENT_PRICES = {
  monthly: { member: 149, regular: 179 },
  prepaid3: { member: 399, regular: 479, recommended: true },
  prepaid6: { member: 759, regular: 909 },
} as const;

export const ELITE_PRICES = {
  monthly: { member: 299, regular: 349 },
  prepaid3: { member: 799, regular: 939, recommended: true },
  prepaid6: { member: 1519, regular: 1779 },
} as const;

export const VIP_PRICES = {
  vip: { member: 699, regular: 699 },
  platinum: { member: 1199, regular: 1199 },
} as const;

export function usd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function academyPerkLine(pair: PricePair, suffix: string) {
  return `Academy member price ${usd(pair.member)}${suffix} (normally ${usd(pair.regular)})`;
}

export function priceHeadline(pair: PricePair, verified: boolean, suffix: string) {
  const amount = verified ? pair.member : pair.regular;
  return `${usd(amount)}${suffix}`;
}

export type OfferCard = {
  id: string;
  title: string;
  pair: PricePair;
  suffix: string;
  badge?: string;
  note?: string;
};

export function appOffersForView(view: PricingView, foundingOpen: boolean): Record<
  "performance" | "fighter_conditioning",
  OfferCard[]
> {
  if (view === "monthly") {
    return {
      performance: [
        {
          id: "performance-monthly",
          title: "Monthly",
          pair: PERFORMANCE_PRICES.monthly,
          suffix: "/mo",
        },
      ],
      fighter_conditioning: [
        {
          id: "conditioning-monthly",
          title: "Monthly",
          pair: CONDITIONING_PRICES.monthly,
          suffix: "/mo",
        },
      ],
    };
  }
  const performance: OfferCard[] = [
    {
      id: "performance-annual",
      title: "Annual prepaid",
      pair: PERFORMANCE_PRICES.annual,
      suffix: "",
      badge: PERFORMANCE_PRICES.annual.offLabel,
    },
  ];
  if (foundingOpen) {
    performance.push({
      id: "performance-founding",
      title: "Founding annual",
      pair: PERFORMANCE_PRICES.foundingAnnual,
      suffix: "",
      badge: "Founding",
      note: `${FOUNDING_DEAL_LINE}. ${PERFORMANCE_PRICES.foundingAnnual.offLabel}. Locked while you stay subscribed.`,
    });
  }
  const conditioning: OfferCard[] = [
    {
      id: "conditioning-camp",
      title: CONDITIONING_PRICES.fightCamp.brand,
      pair: CONDITIONING_PRICES.fightCamp,
      suffix: "",
      badge: "3-month prepaid",
    },
    {
      id: "conditioning-annual",
      title: "Annual prepaid",
      pair: CONDITIONING_PRICES.annual,
      suffix: "",
    },
  ];
  if (foundingOpen) {
    conditioning.push({
      id: "conditioning-founding",
      title: "Founding annual",
      pair: CONDITIONING_PRICES.foundingAnnual,
      suffix: "",
      badge: "Founding",
      note: `${FOUNDING_DEAL_LINE}. ${CONDITIONING_PRICES.foundingAnnual.offLabel}. Locked while you stay subscribed.`,
    });
  }
  return { performance, fighter_conditioning: conditioning };
}

export function coachingOffersForView(view: PricingView): Record<
  "fighter_development" | "elite",
  OfferCard[]
> {
  if (view === "monthly") {
    return {
      fighter_development: [
        {
          id: "development-monthly",
          title: "Monthly",
          pair: DEVELOPMENT_PRICES.monthly,
          suffix: "/mo",
        },
      ],
      elite: [
        {
          id: "elite-monthly",
          title: "Monthly",
          pair: ELITE_PRICES.monthly,
          suffix: "/mo",
        },
      ],
    };
  }
  return {
    fighter_development: [
      {
        id: "development-3mo",
        title: "3-month prepaid",
        pair: DEVELOPMENT_PRICES.prepaid3,
        suffix: "",
        badge: "Recommended program length",
      },
      {
        id: "development-6mo",
        title: "6-month prepaid",
        pair: DEVELOPMENT_PRICES.prepaid6,
        suffix: "",
      },
    ],
    elite: [
      {
        id: "elite-3mo",
        title: "3-month prepaid",
        pair: ELITE_PRICES.prepaid3,
        suffix: "",
        badge: "Recommended",
      },
      {
        id: "elite-6mo",
        title: "6-month prepaid",
        pair: ELITE_PRICES.prepaid6,
        suffix: "",
      },
    ],
  };
}
