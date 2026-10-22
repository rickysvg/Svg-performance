import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { joinWaitlist } from "@/lib/waitlist";
import {
  applyVipBilling,
  buildVipCheckoutDraft,
  HEAVY_AI_CHAT_MESSAGES,
  loadPlateau,
  parseVipApplication,
  pickVipUpsell,
  planWaitlistOffers,
  quoteVipPrice,
  resolveVipAdjustment,
  sparringRatingDip,
  summarizeVipIntake,
  trialDayNumber,
  unusedSubscriptionCents,
  upsellSuppressedUntil,
  VIP_ACTIVE_CAP,
  VIP_CAMP_CAP,
  VIP_HOLD_MS,
  VIP_INTRO_CENTS,
  VIP_MONTHLY_CENTS,
  VIP_NEW_PER_WEEK,
  VIP_PRO_CREDIT_CAP_CENTS,
  VIP_PUBLIC_SPOTS,
  vipQueueTone,
  type UpsellEvent,
  type VipUpsellSignals,
} from "@/lib/vip-coaching";
import { coachingSpotsLine } from "@/lib/pricing";
import { PRICING_LADDER_COLUMNS, PRICING_LADDER_ROWS } from "@/lib/pricing-ladder";
import {
  getVipCheckoutView,
  presentVipUpsell,
  quoteVipForUser,
  reviewVipApplication,
  submitVipApplication,
  syncVipHolds,
} from "@/lib/vip-store";

const DAY = 24 * 60 * 60 * 1000;

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function signals(overrides: Partial<VipUpsellSignals> = {}): VipUpsellSignals {
  return {
    isVip: false,
    canApply: true,
    onWaitlist: false,
    formCheckAt: null,
    fightDateSetAt: null,
    plateau: false,
    streakDays: 0,
    trialDay: null,
    trialActive: false,
    proRenewal: false,
    aiMessages24h: 0,
    sparringDip: false,
    ...overrides,
  };
}

const answers = {
  goals: "I want a fight camp I can actually follow.",
  experience: "Three years, amateur MMA.",
  fightDate: "",
  injuries: "None",
  availability: "Evenings, four days a week.",
};

describe("VIP Coaching rules", () => {
  const now = new Date("2026-10-21T18:00:00.000Z");
  const weekStart = new Date("2026-10-19T06:00:00.000Z");

  beforeEach(async () => {
    await resetDatabase();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_COACHING_MONTHLY;
    delete process.env.STRIPE_COUPON_VIP_ACADEMY_INTRO;
    delete process.env.STRIPE_COUPON_VIP_PRO_CREDIT;
    delete process.env.STRIPE_VIP_PRORATION;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("pauses intake at 20 active, 3 new in a week, or 4 in camp", () => {
    const subs = Array.from({ length: VIP_ACTIVE_CAP }, (_, index) => ({
      userId: `active-${index}`,
      plan: "coaching",
      status: "active",
      currentPeriodEnd: new Date(now.getTime() + DAY),
      createdAt: new Date(weekStart.getTime() - DAY),
    }));
    expect(summarizeVipIntake({ subscriptions: subs, grants: [], campUserIds: [], now, weekStart }).paused).toBe(
      true,
    );
    expect(
      summarizeVipIntake({ subscriptions: subs, grants: [], campUserIds: [], now, weekStart }).reasons,
    ).toContain("active");

    const newcomers = subs.slice(0, VIP_NEW_PER_WEEK).map((row) => ({ ...row, createdAt: now }));
    const weekly = summarizeVipIntake({
      subscriptions: newcomers,
      grants: [],
      campUserIds: [],
      now,
      weekStart,
    });
    expect(weekly.newThisWeek).toBe(VIP_NEW_PER_WEEK);
    expect(weekly.paused).toBe(true);
    expect(weekly.reasons).toContain("weekly");

    const campers = subs.slice(0, VIP_CAMP_CAP);
    const camp = summarizeVipIntake({
      subscriptions: campers.map((row) => ({ ...row, createdAt: new Date(weekStart.getTime() - DAY) })),
      grants: [],
      campUserIds: campers.map((row) => row.userId),
      now,
      weekStart,
    });
    expect(camp.inCamp).toBe(VIP_CAMP_CAP);
    expect(camp.paused).toBe(true);
    expect(camp.openSeats).toBe(0);
  });

  it("keeps an open checkout grant inside the cap and the weekly count", () => {
    const summary = summarizeVipIntake({
      subscriptions: [],
      grants: [
        { userId: "a", createdAt: now, status: "open" },
        { userId: "b", createdAt: now, status: "open" },
        { userId: "c", createdAt: now, status: "open" },
      ],
      campUserIds: [],
      now,
      weekStart,
    });
    expect(summary.active).toBe(0);
    expect(summary.reserved).toBe(3);
    expect(summary.newThisWeek).toBe(3);
    expect(summary.paused).toBe(true);
  });

  it("offers the oldest waiter a 72 hour hold when a seat opens", () => {
    const first = new Date(now.getTime() - 2 * DAY);
    const second = new Date(now.getTime() - DAY);
    const offers = planWaitlistOffers({
      openSeats: 1,
      waiters: [
        { userId: "second", createdAt: second, holdUntil: null },
        { userId: "first", createdAt: first, holdUntil: null },
      ],
      now,
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.userId).toBe("first");
    expect(offers[0]?.holdUntil.getTime() - now.getTime()).toBe(VIP_HOLD_MS);

    const later = new Date(now.getTime() + VIP_HOLD_MS + 1000);
    const next = planWaitlistOffers({
      openSeats: 1,
      waiters: [
        { userId: "first", createdAt: first, holdUntil: offers[0]!.holdUntil },
        { userId: "second", createdAt: second, holdUntil: null },
      ],
      now: later,
    });
    expect(next.map((row) => row.userId)).toEqual(["second"]);
  });

  it("prices academy intro and the Pro credit without stacking them", () => {
    const academy = quoteVipPrice({ academyMember: true, proUnusedCents: 5000 });
    expect(academy.intro).toBe(true);
    expect(academy.firstMonthCents).toBe(VIP_INTRO_CENTS);
    expect(academy.recurringCents).toBe(VIP_MONTHLY_CENTS);
    expect(academy.creditCents).toBe(0);

    const full = quoteVipPrice({ academyMember: false, proUnusedCents: 0 });
    expect(full.firstMonthCents).toBe(VIP_MONTHLY_CENTS);
    expect(full.creditCents).toBe(0);

    const partial = unusedSubscriptionCents({
      priceCents: 999,
      periodStart: new Date(now.getTime() - 30 * DAY),
      periodEnd: new Date(now.getTime() + 15 * DAY),
      now,
    });
    const pro = quoteVipPrice({ academyMember: false, proUnusedCents: partial });
    expect(pro.intro).toBe(false);
    expect(pro.creditCents).toBeGreaterThan(0);
    expect(pro.creditCents).toBeLessThanOrEqual(VIP_PRO_CREDIT_CAP_CENTS);
    expect(pro.firstMonthCents).toBe(VIP_MONTHLY_CENTS - pro.creditCents);

    const capped = quoteVipPrice({ academyMember: false, proUnusedCents: 8000 });
    expect(capped.creditCents).toBe(VIP_PRO_CREDIT_CAP_CENTS);
    expect(capped.uncappedUnusedCents).toBe(8000);
  });

  it("no-ops Stripe discounts when coupon ids are unset and never calls Stripe", async () => {
    const quote = quoteVipPrice({ academyMember: true, proUnusedCents: 999 });
    expect(resolveVipAdjustment(quote, {}).mode).toBe("none");
    const draft = buildVipCheckoutDraft({ userId: "user", quote, env: {} });
    expect(draft.priceId).toBeNull();
    let called = false;
    const result = await applyVipBilling({
      stripe: {
        checkout: {
          sessions: {
            create: async () => {
              called = true;
              return { url: "https://example.test" };
            },
          },
        },
      },
      draft,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
    });
    expect(result.noop).toBe(true);
    expect(called).toBe(false);
  });

  it("attaches a configured coupon and can prorate only inside the $30 cap", async () => {
    const intro = quoteVipPrice({ academyMember: true, proUnusedCents: 0 });
    const introDraft = buildVipCheckoutDraft({
      userId: "member",
      quote: intro,
      env: {
        STRIPE_PRICE_COACHING_MONTHLY: "price_vip",
        STRIPE_COUPON_VIP_ACADEMY_INTRO: "coupon_intro",
      },
    });
    const created: Record<string, unknown>[] = [];
    await applyVipBilling({
      stripe: {
        checkout: {
          sessions: {
            create: async (params) => {
              created.push(params);
              return { url: "https://checkout.test/session" };
            },
          },
        },
      },
      draft: introDraft,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
    });
    expect(created[0]?.["discounts"]).toEqual([{ coupon: "coupon_intro" }]);

    const capped = quoteVipPrice({ academyMember: false, proUnusedCents: 8000 });
    expect(
      resolveVipAdjustment(capped, { STRIPE_VIP_PRORATION: "1" }).mode,
    ).toBe("none");

    const exact = quoteVipPrice({ academyMember: false, proUnusedCents: 500 });
    const proration = resolveVipAdjustment(exact, { STRIPE_VIP_PRORATION: "1" });
    expect(proration.mode).toBe("proration");
    expect(proration.prorationCents).toBe(500);
    let updated = false;
    let checkoutCalled = false;
    const prorated = buildVipCheckoutDraft({
      userId: "pro",
      quote: exact,
      env: { STRIPE_PRICE_COACHING_MONTHLY: "price_vip", STRIPE_VIP_PRORATION: "1" },
    });
    await applyVipBilling({
      stripe: {
        checkout: {
          sessions: {
            create: async () => {
              checkoutCalled = true;
              return { url: null };
            },
          },
        },
        subscriptions: {
          update: async (_id, params) => {
            updated = true;
            expect(params.proration_behavior).toBe("create_prorations");
          },
        },
      },
      draft: prorated,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
      existingSubscriptionId: "sub_123",
      existingItemId: "si_123",
    });
    expect(updated).toBe(true);
    expect(checkoutCalled).toBe(false);
  });

  it("shows each upsell once per 14 days, then suppresses all after 3 dismissals", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    const card = pickVipUpsell({
      signals: signals({ trialActive: true, trialDay: 5, streakDays: 20 }),
      events: [],
      now,
    });
    expect(card?.trigger).toBe("streak");
    expect(card?.mode).toBe("apply");
    expect(card?.body.toLowerCase()).not.toMatch(/24\/7|spots open|\b20\b/);

    const cooled = pickVipUpsell({
      signals: signals({ streakDays: 20, trialActive: true, trialDay: 5 }),
      events: [{ trigger: "streak", action: "shown", at: new Date(now.getTime() - DAY) }],
      now,
    });
    expect(cooled?.trigger).toBe("trial_day_5");

    const events: UpsellEvent[] = [];
    let cursor = now.getTime() - 3 * DAY;
    for (const trigger of ["form_check", "plateau", "streak"] as const) {
      events.push({ trigger, action: "shown", at: new Date(cursor) });
      cursor += 1000;
      events.push({ trigger, action: "dismissed", at: new Date(cursor) });
      cursor += 1000;
    }
    expect(upsellSuppressedUntil(events, now)).not.toBeNull();
    expect(
      pickVipUpsell({
        signals: signals({ trialActive: true, trialDay: 5, aiMessages24h: HEAVY_AI_CHAT_MESSAGES }),
        events,
        now,
      }),
    ).toBeNull();

    const expired = events.map((event) => ({
      ...event,
      at: new Date(event.at.getTime() - 61 * DAY),
    }));
    expect(upsellSuppressedUntil(expired, now)).toBeNull();
  });

  it("hides upsells for VIP clients and offers the waitlist when intake is closed", () => {
    const now = new Date();
    expect(pickVipUpsell({ signals: signals({ isVip: true, streakDays: 20 }), events: [], now })).toBeNull();
    const waiting = pickVipUpsell({
      signals: signals({ canApply: false, onWaitlist: false, streakDays: 14 }),
      events: [],
      now,
    });
    expect(waiting?.mode).toBe("waitlist");
    expect(waiting?.body).toMatch(/Limited spots/);
    expect(waiting?.body).toMatch(/72 hours/);
  });

  it("detects a 3-week load plateau, a sparring dip, and trial day 5", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    expect(
      loadPlateau(
        [
          { name: "squat", load: 200, at: new Date(now.getTime() - 30 * DAY) },
          { name: "squat", load: 200, at: new Date(now.getTime() - 2 * DAY) },
        ],
        now,
      ),
    ).toBe(true);
    expect(
      loadPlateau(
        [
          { name: "squat", load: 185, at: new Date(now.getTime() - 30 * DAY) },
          { name: "squat", load: 205, at: new Date(now.getTime() - 2 * DAY) },
        ],
        now,
      ),
    ).toBe(false);
    expect(sparringRatingDip(2, 4)).toBe(true);
    expect(sparringRatingDip(4, 2)).toBe(false);
    expect(trialDayNumber(new Date(now.getTime() - 4 * DAY), now)).toBe(5);
    expect(vipQueueTone({ pending: 2, reviewed: 0, active: 1, cap: 20 })).toBe("attention");
    expect(vipQueueTone({ pending: 0, reviewed: 3, active: 1, cap: 20 })).toBe("clear");
  });

  it("requires the five application answers", () => {
    const missing = parseVipApplication({
      goals: "short",
      experience: "Three years, amateur.",
      fightDate: "",
      noFight: false,
      injuries: "None",
      availability: "Evenings",
    });
    expect(missing.ok).toBe(false);
    const parsed = parseVipApplication({
      ...answers,
      fightDate: "2026-12-01",
      noFight: false,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.fightDate).toBe("2026-12-01");
  });

  it("compares Academy, Pro, and VIP on a phone ladder without voice", () => {
    expect(PRICING_LADDER_COLUMNS.map((column) => column.label)).toEqual([
      "Academy member",
      "SVG Pro",
      "VIP Coaching",
    ]);
    expect(PRICING_LADDER_COLUMNS[1]?.prices.join(" ")).toMatch(/\$9\.99\/mo/);
    expect(PRICING_LADDER_COLUMNS[1]?.prices.join(" ")).toMatch(/\$72\.99\/yr/);
    expect(PRICING_LADDER_COLUMNS[2]?.prices.join(" ")).toMatch(/\$249\/mo/);
    expect(PRICING_LADDER_COLUMNS[2]?.prices.join(" ")).toMatch(/\$149 first month/);
    expect(PRICING_LADDER_ROWS.map((row) => row.id)).toEqual([
      "workouts",
      "logger",
      "ai_chat",
      "checkins",
      "form_checks",
      "program",
      "camp",
      "weekly",
      "messages",
      "assessment",
      "priority",
    ]);
    const chat = PRICING_LADDER_ROWS.find((row) => row.id === "ai_chat");
    expect(chat?.cells.academy.mark).toBe("no");
    expect(chat?.cells.pro.mark).toBe("yes");
    expect(chat?.cells.pro.adds).toBe(true);
    expect(chat?.cells.vip.mark).toBe("yes");
    expect(chat?.cells.vip.adds).toBeUndefined();
    const formChecks = PRICING_LADDER_ROWS.find((row) => row.id === "form_checks");
    expect(formChecks?.cells.pro.mark).toBe("no");
    expect(formChecks?.cells.pro.note).toBeUndefined();
    expect(formChecks?.cells.vip.note).toBe("Coach review, 48-hour reply");
    expect(formChecks?.cells.vip.adds).toBe(true);
    expect(formChecks?.cells.academy.mark).toBe("no");
    expect(PRICING_LADDER_ROWS.find((row) => row.id === "checkins")?.cells.pro.adds).toBe(true);
    expect(PRICING_LADDER_ROWS.find((row) => row.id === "program")?.cells.vip.adds).toBe(true);
    expect(PRICING_LADDER_ROWS.find((row) => row.id === "messages")?.cells.pro.mark).toBe("no");
    const blob = JSON.stringify({ columns: PRICING_LADDER_COLUMNS, rows: PRICING_LADDER_ROWS });
    expect(blob.toLowerCase()).not.toMatch(/voice|read-aloud|read aloud/);
    const ladder = read("src/components/pricing/PricingLadder.tsx");
    expect(ladder).toContain('data-pricing-ladder="1"');
    expect(ladder).toContain("sticky top-14");
    expect(ladder).toContain("AI coach chat free for your first week");
    expect(ladder).toContain("data-ladder-apply");
    expect(ladder).toContain(': "Apply"');
    expect(ladder).not.toMatch(/overflow-x-auto|min-w-\[/);
    expect(ladder).toContain("#CBF805");
    expect(read("src/components/pricing/PricingCatalog.tsx")).toContain("<PricingLadder");
  });

  it("keeps spot counts off the public pricing copy", () => {
    expect(coachingSpotsLine(4)).toBe(VIP_PUBLIC_SPOTS);
    const files = [
      "src/components/pricing/PricingCatalog.tsx",
      "src/app/pricing/page.tsx",
      "src/app/(member)/vip/apply/page.tsx",
    ];
    for (const file of files) {
      const text = read(file);
      expect(text).not.toMatch(/spots open/i);
      expect(text).not.toMatch(/Limited to 20/);
      expect(text).not.toMatch(/24\/7/);
      expect(text).toMatch(/Limited spots|limited spots/);
      expect(text).toMatch(/48 hours|VIP_REPLY_PROMISE/);
    }
    expect(read("src/components/pricing/PricingCatalog.tsx")).toContain("data-vip-card");
    expect(read("src/components/pricing/PricingCatalog.tsx")).toContain("data-vip-apply");
    expect(read("src/components/pricing/PricingCatalog.tsx")).toMatch(/\n\s+Apply\n/);
    expect(read("src/lib/pricing.ts")).toContain("A program Ricky writes");
    expect(read("src/lib/pricing.ts")).toContain("Direct messages with Ricky");
    expect(read("src/lib/pricing.ts")).toContain("Monthly assessment");
    expect(read("src/proxy.ts")).toContain('"/vip"');
    expect(read("src/lib/locked-paths.ts")).toContain('"/vip"');
    expect(read("src/app/(member)/admin/page.tsx")).toContain('label="VIP Coaching"');
    expect(read("src/app/(member)/admin/vip/page.tsx")).toContain("data-vip-queue");
    expect(read("src/components/vip/VipReviewButtons.tsx")).toContain("Approve");
    expect(read("src/components/vip/VipReviewButtons.tsx")).toContain("Decline");
    expect(read("prisma/hosted-additive.sql")).toContain("VIP Coaching");
    expect(read("prisma/hosted-additive.sql")).toContain("VipApplication");
    expect(read("README.md")).toContain("STRIPE_COUPON_VIP_ACADEMY_INTRO");
    expect(read(".env.example")).toContain("STRIPE_COUPON_VIP_PRO_CREDIT");
  });

  it("locks checkout until Ricky approves, then snapshots intro without a Pro credit", async () => {
    const member = await makeUser("vip-member@example.com");
    await prisma.profile.update({
      where: { userId: member.id },
      data: { gymMembershipVerified: true },
    });
    await prisma.subscription.create({
      data: {
        userId: member.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 15 * DAY),
      },
    });
    expect(await getVipCheckoutView(member.id)).toBeNull();
    const application = await submitVipApplication(member.id, answers);
    expect(await getVipCheckoutView(member.id)).toBeNull();
    const admin = await makeUser("vip-admin@example.com", false, "admin");
    await reviewVipApplication({
      applicationId: application.id,
      reviewerId: admin.id,
      decision: "approved",
    });
    const view = await getVipCheckoutView(member.id);
    expect(view?.quote.intro).toBe(true);
    expect(view?.quote.creditCents).toBe(0);
    expect(view?.quote.firstMonthCents).toBe(VIP_INTRO_CENTS);
    const quote = await quoteVipForUser(member.id);
    expect(quote.creditCents).toBe(0);
  });

  it("gives a non-member Pro subscriber a capped credit and refuses a fourth new client this week", async () => {
    const athlete = await makeUser("vip-pro@example.com");
    await prisma.subscription.create({
      data: {
        userId: athlete.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 10 * DAY),
      },
    });
    const quote = await quoteVipForUser(athlete.id);
    expect(quote.intro).toBe(false);
    expect(quote.creditCents).toBeGreaterThan(0);
    expect(quote.creditCents).toBeLessThanOrEqual(VIP_PRO_CREDIT_CAP_CENTS);

    const admin = await makeUser("vip-cap-admin@example.com", false, "admin");
    const overflow = await submitVipApplication(athlete.id, answers);
    for (let index = 0; index < VIP_NEW_PER_WEEK; index += 1) {
      const user = await makeUser(`vip-new-${index}@example.com`);
      const application = await submitVipApplication(user.id, answers);
      await reviewVipApplication({
        applicationId: application.id,
        reviewerId: admin.id,
        decision: "approved",
      });
    }
    await expect(
      reviewVipApplication({
        applicationId: overflow.id,
        reviewerId: admin.id,
        decision: "approved",
      }),
    ).rejects.toMatchObject({ code: "VIP" });
    expect(await getVipCheckoutView(athlete.id)).toBeNull();
  });

  it("holds the next waitlist spot for 72 hours and shows one upsell card", async () => {
    const admin = await makeUser("vip-hold-admin@example.com", false, "admin");
    for (let index = 0; index < VIP_NEW_PER_WEEK; index += 1) {
      const user = await makeUser(`vip-seat-${index}@example.com`);
      const application = await submitVipApplication(user.id, answers);
      await reviewVipApplication({
        applicationId: application.id,
        reviewerId: admin.id,
        decision: "approved",
      });
    }
    const older = await makeUser("vip-older@example.com");
    const newer = await makeUser("vip-newer@example.com");
    await joinWaitlist(older.id, "coaching");
    await joinWaitlist(newer.id, "coaching");
    await prisma.planWaitlist.update({
      where: { userId_plan: { userId: older.id, plan: "coaching" } },
      data: { createdAt: new Date(Date.now() - DAY) },
    });
    const offers = await syncVipHolds(new Date());
    expect(offers.map((row) => row.userId)).toEqual([]);

    const spare = await prisma.vipCheckoutGrant.findFirst();
    if (!spare) throw new Error("expected a reserved checkout");
    await prisma.vipCheckoutGrant.delete({ where: { id: spare.id } });
    const opened = await syncVipHolds(new Date());
    expect(opened.map((row) => row.userId)).toEqual([older.id]);
    const held = await prisma.planWaitlist.findUnique({
      where: { userId_plan: { userId: older.id, plan: "coaching" } },
    });
    expect(held?.holdUntil).toBeTruthy();
    const again = await syncVipHolds(new Date());
    expect(again.find((row) => row.userId === newer.id)).toBeUndefined();

    const trialUser = await makeUser("vip-trial@example.com");
    const start = new Date(Date.now() - 4 * DAY);
    await prisma.profile.update({
      where: { userId: trialUser.id },
      data: {
        trialStartedAt: start,
        trialEndsAt: new Date(start.getTime() + 7 * DAY),
        gymMembershipVerified: false,
      },
    });
    const card = await presentVipUpsell(trialUser.id, new Date());
    expect(card?.trigger).toBe("trial_day_5");
    expect(await presentVipUpsell(trialUser.id, new Date())).toBeNull();
  });
});
