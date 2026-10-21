/**
 * VIP Coaching rules. No model calls and no Stripe network.
 * Spot counts stay in admin code. Public copy is "Limited spots".
 */

import { COACHING_MONTHLY, PERFORMANCE_ANNUAL, PERFORMANCE_MONTHLY, usd } from "@/lib/pricing";
import { normalizePlanId } from "@/lib/plans";

export const VIP_LABEL = "VIP Coaching";
export const VIP_ACTIVE_CAP = 20;
export const VIP_NEW_PER_WEEK = 3;
export const VIP_CAMP_CAP = 4;
export const VIP_HOLD_MS = 72 * 60 * 60 * 1000;
export const VIP_MONTHLY_CENTS = COACHING_MONTHLY * 100;
export const VIP_INTRO_CENTS = 14900;
export const VIP_PRO_CREDIT_CAP_CENTS = 3000;
export const PRO_MONTHLY_CENTS = Math.round(PERFORMANCE_MONTHLY * 100);
export const PRO_ANNUAL_CENTS = Math.round(PERFORMANCE_ANNUAL * 100);

export const VIP_PUBLIC_SPOTS = "Limited spots";
export const VIP_REPLY_PROMISE =
  "Replies to messages, form checks, and check-ins within 48 hours.";

export const VIP_VALUE_LADDER = [
  "A program Ricky writes",
  "Fight-camp plan",
  "Timestamped form notes",
  "Weekly plan adjustments",
  "Direct messages with Ricky",
  "Monthly assessment",
  "Replies within 48 hours",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
export const VIP_UPSELL_COOLDOWN_MS = 14 * DAY_MS;
export const VIP_UPSELL_SUPPRESS_MS = 60 * DAY_MS;
export const VIP_UPSELL_FRESH_MS = 7 * DAY_MS;
export const VIP_RENEWAL_WINDOW_MS = 3 * DAY_MS;
export const HEAVY_AI_CHAT_MESSAGES = 15;

export const VIP_UPSELL_TRIGGERS = [
  "form_check",
  "fight_date",
  "plateau",
  "streak",
  "trial_day_5",
  "pro_renewal",
  "heavy_ai",
  "sparring_dip",
] as const;

export type VipTrigger = (typeof VIP_UPSELL_TRIGGERS)[number];

export type VipSubRow = {
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

export type VipGrantRow = {
  userId: string;
  createdAt: Date;
  status: string;
};

export type VipIntakeSummary = {
  /** Paying VIP Coaching subscriptions. */
  active: number;
  /** Paying clients plus open checkout grants. This is what the cap uses. */
  reserved: number;
  cap: number;
  newThisWeek: number;
  weeklyCap: number;
  inCamp: number;
  campCap: number;
  openSeats: number;
  paused: boolean;
  reasons: Array<"active" | "weekly" | "camp">;
};

export function liveCoachingSub(row: VipSubRow, now: Date) {
  if (row.status !== "active") return false;
  if (normalizePlanId(row.plan) !== "coaching") return false;
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < now.getTime()) return false;
  return true;
}

export function summarizeVipIntake(input: {
  subscriptions: VipSubRow[];
  grants: VipGrantRow[];
  campUserIds: string[];
  now: Date;
  weekStart: Date;
}): VipIntakeSummary {
  const active = new Set<string>();
  const newcomers = new Set<string>();
  for (const row of input.subscriptions) {
    if (!liveCoachingSub(row, input.now)) continue;
    active.add(row.userId);
    if (row.createdAt.getTime() >= input.weekStart.getTime()) newcomers.add(row.userId);
  }
  for (const grant of input.grants) {
    if (grant.status !== "open") continue;
    if (!active.has(grant.userId)) active.add(grant.userId);
    if (grant.createdAt.getTime() >= input.weekStart.getTime()) newcomers.add(grant.userId);
  }
  const activeIds = new Set(
    input.subscriptions.filter((row) => liveCoachingSub(row, input.now)).map((row) => row.userId),
  );
  const inCamp = new Set(
    input.campUserIds.filter((userId) => activeIds.has(userId)),
  ).size;
  const reasons: VipIntakeSummary["reasons"] = [];
  if (active.size >= VIP_ACTIVE_CAP) reasons.push("active");
  if (newcomers.size >= VIP_NEW_PER_WEEK) reasons.push("weekly");
  if (inCamp >= VIP_CAMP_CAP) reasons.push("camp");
  const byActive = Math.max(0, VIP_ACTIVE_CAP - active.size);
  const byWeek = Math.max(0, VIP_NEW_PER_WEEK - newcomers.size);
  const openSeats = inCamp >= VIP_CAMP_CAP ? 0 : Math.min(byActive, byWeek);
  return {
    active: activeIds.size,
    reserved: active.size,
    cap: VIP_ACTIVE_CAP,
    newThisWeek: newcomers.size,
    weeklyCap: VIP_NEW_PER_WEEK,
    inCamp,
    campCap: VIP_CAMP_CAP,
    openSeats,
    paused: openSeats <= 0,
    reasons,
  };
}

export type VipWaiter = {
  userId: string;
  createdAt: Date;
  holdUntil: Date | null;
};

export function planWaitlistOffers(input: {
  openSeats: number;
  waiters: VipWaiter[];
  now: Date;
  holdMs?: number;
}) {
  const holdMs = input.holdMs ?? VIP_HOLD_MS;
  const holding = input.waiters.filter(
    (row) => row.holdUntil && row.holdUntil.getTime() > input.now.getTime(),
  );
  const slots = Math.max(0, input.openSeats - holding.length);
  if (slots === 0) return [];
  const byAge = (a: VipWaiter, b: VipWaiter) =>
    a.createdAt.getTime() - b.createdAt.getTime() || a.userId.localeCompare(b.userId);
  const neverOffered = input.waiters.filter((row) => !row.holdUntil).sort(byAge);
  const expired = input.waiters
    .filter((row) => row.holdUntil && row.holdUntil.getTime() <= input.now.getTime())
    .sort(byAge);
  const next = [...neverOffered, ...expired];
  return next.slice(0, slots).map((row) => ({
    userId: row.userId,
    holdUntil: new Date(input.now.getTime() + holdMs),
  }));
}

export function holdIsOpen(holdUntil: Date | null | undefined, now: Date) {
  return Boolean(holdUntil && holdUntil.getTime() > now.getTime());
}

export function unusedSubscriptionCents(input: {
  priceCents: number;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}) {
  const total = input.periodEnd.getTime() - input.periodStart.getTime();
  if (!(total > 0)) return 0;
  const remaining = input.periodEnd.getTime() - input.now.getTime();
  if (remaining <= 0) return 0;
  const fraction = Math.min(1, remaining / total);
  return Math.max(0, Math.round(input.priceCents * fraction));
}

export function inferProPeriod(input: {
  periodEnd: Date;
  annual?: boolean;
  priceCents?: number;
}) {
  const annual = Boolean(input.annual);
  const lengthDays = annual ? 365 : 30;
  return {
    periodStart: new Date(input.periodEnd.getTime() - lengthDays * DAY_MS),
    priceCents: input.priceCents ?? (annual ? PRO_ANNUAL_CENTS : PRO_MONTHLY_CENTS),
  };
}

export type VipQuote = {
  firstMonthCents: number;
  recurringCents: number;
  creditCents: number;
  uncappedUnusedCents: number;
  intro: boolean;
};

/** Academy intro and the Pro credit never apply on the same checkout. */
export function quoteVipPrice(input: {
  academyMember: boolean;
  proUnusedCents: number;
}): VipQuote {
  const uncapped = Math.max(0, Math.round(input.proUnusedCents));
  if (input.academyMember) {
    return {
      firstMonthCents: VIP_INTRO_CENTS,
      recurringCents: VIP_MONTHLY_CENTS,
      creditCents: 0,
      uncappedUnusedCents: uncapped,
      intro: true,
    };
  }
  const creditCents = Math.min(VIP_PRO_CREDIT_CAP_CENTS, uncapped);
  return {
    firstMonthCents: VIP_MONTHLY_CENTS - creditCents,
    recurringCents: VIP_MONTHLY_CENTS,
    creditCents,
    uncappedUnusedCents: uncapped,
    intro: false,
  };
}

export function vipPriceCopy(quote: VipQuote) {
  if (quote.intro) {
    return {
      primary: `${usd(quote.firstMonthCents / 100)} first month`,
      detail: `Then ${usd(quote.recurringCents / 100)}/mo for verified academy members.`,
    };
  }
  if (quote.creditCents > 0) {
    return {
      primary: `${usd(quote.recurringCents / 100)}/mo`,
      detail: `One-time credit of ${usd(quote.creditCents / 100)} from unused Pro time, then ${usd(quote.recurringCents / 100)}/mo.`,
    };
  }
  return {
    primary: `${usd(quote.recurringCents / 100)}/mo`,
    detail: "Full price.",
  };
}

export type VipEnv = Record<string, string | undefined>;

export type VipAdjustment = {
  mode: "coupon" | "proration" | "none";
  couponId: string | null;
  prorationCents: number;
};

function envValue(env: VipEnv, name: string) {
  return env[name]?.trim() || "";
}

/**
 * Coupon ids come from the environment. Unset ids are a no-op:
 * checkout still runs at the recurring price and this app does not create a coupon.
 * Proration is only selected when the unused Pro value is already within the $30 cap,
 * so a Stripe proration cannot exceed it.
 */
export function resolveVipAdjustment(quote: VipQuote, env: VipEnv = process.env): VipAdjustment {
  if (quote.intro) {
    const couponId = envValue(env, "STRIPE_COUPON_VIP_ACADEMY_INTRO");
    return couponId
      ? { mode: "coupon", couponId, prorationCents: 0 }
      : { mode: "none", couponId: null, prorationCents: 0 };
  }
  if (quote.creditCents > 0) {
    const exact = envValue(env, `STRIPE_COUPON_VIP_CREDIT_${quote.creditCents}`);
    if (exact) return { mode: "coupon", couponId: exact, prorationCents: 0 };
    if (quote.creditCents === VIP_PRO_CREDIT_CAP_CENTS) {
      const generic = envValue(env, "STRIPE_COUPON_VIP_PRO_CREDIT");
      if (generic) return { mode: "coupon", couponId: generic, prorationCents: 0 };
    }
    const prorationOn = env.STRIPE_VIP_PRORATION === "1" || env.STRIPE_VIP_PRORATION === "true";
    if (
      prorationOn &&
      quote.uncappedUnusedCents === quote.creditCents &&
      quote.creditCents > 0 &&
      quote.creditCents <= VIP_PRO_CREDIT_CAP_CENTS
    ) {
      return { mode: "proration", couponId: null, prorationCents: quote.creditCents };
    }
    return { mode: "none", couponId: null, prorationCents: 0 };
  }
  return { mode: "none", couponId: null, prorationCents: 0 };
}

export type VipCheckoutDraft = {
  priceEnv: "STRIPE_PRICE_COACHING_MONTHLY";
  priceId: string | null;
  adjustment: VipAdjustment;
  metadata: Record<string, string>;
};

export function buildVipCheckoutDraft(input: {
  userId: string;
  quote: VipQuote;
  env?: VipEnv;
}): VipCheckoutDraft {
  const env = input.env ?? process.env;
  const adjustment = resolveVipAdjustment(input.quote, env);
  const priceId = envValue(env, "STRIPE_PRICE_COACHING_MONTHLY") || null;
  return {
    priceEnv: "STRIPE_PRICE_COACHING_MONTHLY",
    priceId,
    adjustment,
    metadata: {
      userId: input.userId,
      plan: "coaching_monthly",
      vipProduct: "coaching",
      vipIntro: input.quote.intro ? "1" : "0",
      vipCreditCents: String(input.quote.creditCents),
      vipAdjustment: adjustment.mode,
      vipProrationCents: String(adjustment.prorationCents),
    },
  };
}

export type VipBillingClient = {
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ url?: string | null }>;
    };
  };
  subscriptions?: {
    update: (id: string, params: Record<string, unknown>) => Promise<unknown>;
  };
};

export function vipCheckoutParams(input: {
  draft: VipCheckoutDraft;
  successUrl: string;
  cancelUrl: string;
}) {
  const params: Record<string, unknown> = {
    mode: "subscription",
    client_reference_id: input.draft.metadata.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.draft.priceId, quantity: 1 }],
    metadata: input.draft.metadata,
    subscription_data: { metadata: input.draft.metadata },
  };
  if (input.draft.adjustment.mode === "coupon" && input.draft.adjustment.couponId) {
    params.discounts = [{ coupon: input.draft.adjustment.couponId }];
  }
  return params;
}

/**
 * Applies a configured coupon or a capped proration. A missing Stripe client,
 * missing price id, or missing subscription item id returns a no-op and does not
 * create a coupon or subscription.
 */
export async function applyVipBilling(input: {
  stripe: VipBillingClient | null;
  draft: VipCheckoutDraft;
  successUrl: string;
  cancelUrl: string;
  existingSubscriptionId?: string;
  existingItemId?: string;
}) {
  if (!input.stripe || !input.draft.priceId) {
    return { noop: true as const, url: null as string | null, prorationApplied: false };
  }
  if (
    input.draft.adjustment.mode === "proration" &&
    input.existingSubscriptionId &&
    input.existingItemId &&
    input.stripe.subscriptions
  ) {
    await input.stripe.subscriptions.update(input.existingSubscriptionId, {
      proration_behavior: "create_prorations",
      items: [{ id: input.existingItemId, price: input.draft.priceId }],
      metadata: input.draft.metadata,
    });
    return { noop: false as const, url: null as string | null, prorationApplied: true };
  }
  const session = await input.stripe.checkout.sessions.create(
    vipCheckoutParams({
      draft: input.draft,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    }),
  );
  return {
    noop: false as const,
    url: session.url ?? null,
    prorationApplied: false,
  };
}

export function parseVipApplication(input: {
  goals: string;
  experience: string;
  fightDate: string;
  noFight: boolean;
  injuries: string;
  availability: string;
}):
  | { ok: true; value: { goals: string; experience: string; fightDate: string; injuries: string; availability: string } }
  | { ok: false; error: string } {
  const goals = input.goals.trim().slice(0, 600);
  const experience = input.experience.trim().slice(0, 400);
  const injuries = input.injuries.trim().slice(0, 400);
  const availability = input.availability.trim().slice(0, 300);
  if (goals.length < 8) return { ok: false, error: "Add a few sentences on your goals." };
  if (experience.length < 4) return { ok: false, error: "Add your experience and level." };
  if (injuries.length < 2) return { ok: false, error: "List injuries, or write none." };
  if (availability.length < 4) return { ok: false, error: "Add the days and times you can train." };
  let fightDate = "";
  if (!input.noFight) {
    const raw = input.fightDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return { ok: false, error: "Enter an upcoming fight date, or mark that you have none." };
    }
    fightDate = raw;
  }
  return { ok: true, value: { goals, experience, fightDate, injuries, availability } };
}

export type LoadSample = { name: string; load: number; at: Date };

/** True when logged loads exist across two 3-week windows and none went up. */
export function loadPlateau(samples: LoadSample[], now: Date) {
  const recentStart = now.getTime() - 21 * DAY_MS;
  const priorStart = now.getTime() - 42 * DAY_MS;
  const byName = new Map<string, { prior: number; recent: number; hasPrior: boolean; hasRecent: boolean }>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.load) || sample.load <= 0) continue;
    const at = sample.at.getTime();
    const row = byName.get(sample.name) ?? { prior: 0, recent: 0, hasPrior: false, hasRecent: false };
    if (at >= recentStart && at <= now.getTime()) {
      row.recent = Math.max(row.recent, sample.load);
      row.hasRecent = true;
    } else if (at >= priorStart && at < recentStart) {
      row.prior = Math.max(row.prior, sample.load);
      row.hasPrior = true;
    }
    byName.set(sample.name, row);
  }
  let comparable = 0;
  let improved = 0;
  for (const row of byName.values()) {
    if (!row.hasPrior || !row.hasRecent) continue;
    comparable += 1;
    if (row.recent > row.prior) improved += 1;
  }
  return comparable > 0 && improved === 0;
}

export function trialDayNumber(startedAt: Date, now: Date) {
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / DAY_MS) + 1;
}

export function proRenewalWindow(periodEnd: Date | null, now: Date) {
  if (!periodEnd) return false;
  const remaining = periodEnd.getTime() - now.getTime();
  return remaining >= 0 && remaining <= VIP_RENEWAL_WINDOW_MS;
}

export function sparringRatingDip(latest: number | null, previous: number | null) {
  if (latest == null || previous == null) return false;
  return latest < previous;
}

export type VipUpsellSignals = {
  isVip: boolean;
  canApply: boolean;
  onWaitlist: boolean;
  formCheckAt: Date | null;
  fightDateSetAt: Date | null;
  plateau: boolean;
  streakDays: number;
  trialDay: number | null;
  trialActive: boolean;
  proRenewal: boolean;
  aiMessages24h: number;
  sparringDip: boolean;
};

export type UpsellEvent = {
  trigger: string;
  action: "shown" | "dismissed";
  at: Date;
};

export function upsellSuppressedUntil(events: UpsellEvent[], now: Date) {
  const ordered = events.slice().sort((a, b) => a.at.getTime() - b.at.getTime());
  let streak = 0;
  let openCard = false;
  let until: Date | null = null;
  for (const event of ordered) {
    if (event.action === "shown") {
      if (openCard) streak = 0;
      openCard = true;
      continue;
    }
    if (!openCard) continue;
    openCard = false;
    streak += 1;
    if (streak >= 3) until = new Date(event.at.getTime() + VIP_UPSELL_SUPPRESS_MS);
  }
  if (!until || until.getTime() <= now.getTime()) return null;
  return until;
}

function shownRecently(events: UpsellEvent[], trigger: string, now: Date) {
  return events.some(
    (event) =>
      event.trigger === trigger &&
      (event.action === "shown" || event.action === "dismissed") &&
      now.getTime() - event.at.getTime() < VIP_UPSELL_COOLDOWN_MS,
  );
}

function triggerMatches(trigger: VipTrigger, signals: VipUpsellSignals, now: Date) {
  const fresh = (at: Date | null) =>
    Boolean(at && now.getTime() - at.getTime() >= 0 && now.getTime() - at.getTime() <= VIP_UPSELL_FRESH_MS);
  switch (trigger) {
    case "form_check":
      return fresh(signals.formCheckAt);
    case "fight_date":
      return fresh(signals.fightDateSetAt);
    case "plateau":
      return signals.plateau;
    case "streak":
      return signals.streakDays >= 14;
    case "trial_day_5":
      return signals.trialActive && signals.trialDay === 5;
    case "pro_renewal":
      return signals.proRenewal;
    case "heavy_ai":
      return signals.aiMessages24h >= HEAVY_AI_CHAT_MESSAGES;
    case "sparring_dip":
      return signals.sparringDip;
    default:
      return false;
  }
}

export type VipUpsellCard = {
  trigger: VipTrigger;
  mode: "apply" | "waitlist" | "waiting";
  title: string;
  body: string;
  cta: string;
};

const UPSELL_COPY: Record<VipTrigger, { title: string; body: string }> = {
  form_check: {
    title: "I got the clip",
    body: "I'll watch it and reply within 48 hours. If you want me writing the program around what I see, that's VIP Coaching.",
  },
  fight_date: {
    title: "Fight date is in",
    body: "I can build the camp with you. VIP Coaching is the fight-camp plan, the weekly changes, and a reply within 48 hours.",
  },
  plateau: {
    title: "Same loads, three weeks",
    body: "That's a plateau. VIP Coaching is me rewriting the week so the loads move again.",
  },
  streak: {
    title: "Fourteen days straight",
    body: "Keep the roll. VIP Coaching is the program I write and the adjustments each week.",
  },
  trial_day_5: {
    title: "Day 5 of 7",
    body: "Two days left on the trial. If you want a program I write, apply for VIP Coaching. I reply within 48 hours.",
  },
  pro_renewal: {
    title: "Pro is up for renewal",
    body: "The app stays on Pro. VIP Coaching puts me on the plan, with direct messages and replies within 48 hours.",
  },
  heavy_ai: {
    title: "You've been in the chat",
    body: "The AI can talk. I coach. VIP Coaching is the direct line, and I reply within 48 hours.",
  },
  sparring_dip: {
    title: "Sparring rating dipped",
    body: "That's a signal. VIP Coaching is where I adjust the week with you and answer within 48 hours.",
  },
};

export function pickVipUpsell(input: {
  signals: VipUpsellSignals;
  events: UpsellEvent[];
  now: Date;
}): VipUpsellCard | null {
  if (input.signals.isVip) return null;
  if (upsellSuppressedUntil(input.events, input.now)) return null;
  for (const trigger of VIP_UPSELL_TRIGGERS) {
    if (!triggerMatches(trigger, input.signals, input.now)) continue;
    if (shownRecently(input.events, trigger, input.now)) continue;
    const copy = UPSELL_COPY[trigger];
    if (input.signals.canApply) {
      return { trigger, mode: "apply", title: copy.title, body: copy.body, cta: "Apply" };
    }
    if (input.signals.onWaitlist) {
      return {
        trigger,
        mode: "waiting",
        title: copy.title,
        body: `${copy.body} You're on the waitlist. If a spot opens, it's held for you for 72 hours.`,
        cta: "On the waitlist",
      };
    }
    return {
      trigger,
      mode: "waitlist",
      title: copy.title,
      body: `${copy.body} Limited spots. Join the waitlist, and if a seat opens it's held for you for 72 hours.`,
      cta: "Join the waitlist",
    };
  }
  return null;
}

export function vipQueueTone(input: {
  pending: number;
  reviewed: number;
  active: number;
  cap: number;
  nearSeats?: number;
}): "attention" | "clear" | "idle" {
  if (input.pending > 0) return "attention";
  const limit = Math.max(0, Math.floor(input.cap));
  const remaining = Math.max(0, limit - Math.max(0, Math.floor(input.active)));
  const near = input.nearSeats ?? 2;
  if (limit > 0 && remaining <= near) return "attention";
  if (input.reviewed > 0 || input.active > 0) return "clear";
  return "idle";
}
