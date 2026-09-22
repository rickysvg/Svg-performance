import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { canUseFeature, getEffectivePlanId } from "@/lib/entitlements";
import { canUseMemberTools } from "@/lib/access";
import { assignPlanForPilot, applyStripeEvent, assertCanCheckoutPlan } from "@/lib/billing";
import { creditsForCurrentPlan, markCreditUsed } from "@/lib/credits";
import { isPlanAtCap, joinWaitlist } from "@/lib/waitlist";
import { createBookingRequestForUser } from "@/lib/bookings";
import { AI_DISCLAIMER, PLAN_CAPS, PLAN_CATALOG } from "@/lib/plans";

function turnStripeOn() {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
  process.env.STRIPE_PRICE_GYM = "price_gym";
  process.env.STRIPE_PRICE_ELITE_NON = "price_elite_non";
}

function turnStripeOff() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_STANDALONE;
  delete process.env.STRIPE_PRICE_GYM;
  delete process.env.STRIPE_PRICE_ELITE_NON;
}

describe("M5 entitlements, caps, and booking credits", () => {
  beforeEach(async () => {
    await resetDatabase();
    turnStripeOff();
  });

  afterAll(async () => {
    turnStripeOff();
    await prisma.$disconnect();
  });

  it("keeps tools open when Stripe TEST keys are missing", async () => {
    const user = await makeUser("preview@example.com");
    expect(await getEffectivePlanId(user.id)).toBe("platinum");
    expect(await canUseFeature(user.id, "nutrition")).toBe(true);
    expect(await canUseFeature(user.id, "ai")).toBe(true);
    expect((await canUseMemberTools(user.id)).reason).toBe("preview");
  });

  it("treats Member Access as beginner Learn only when Stripe is on", async () => {
    turnStripeOn();
    const user = await makeUser("access@example.com");
    expect(await getEffectivePlanId(user.id)).toBe("member_access");
    expect(await canUseFeature(user.id, "learn_beginner")).toBe(true);
    expect(await canUseFeature(user.id, "learn_full")).toBe(false);
    expect(await canUseFeature(user.id, "nutrition")).toBe(false);
    expect(await canUseFeature(user.id, "ai")).toBe(false);
    expect(await canUseFeature(user.id, "training")).toBe(true);
    expect((await canUseMemberTools(user.id)).allowed).toBe(false);
  });

  it("unlocks Performance features without coaching credits", async () => {
    turnStripeOn();
    const admin = await makeUser("admin-perf@example.com", false, "admin");
    const user = await makeUser("perf@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: user.id,
      plan: "performance",
    });
    expect(await getEffectivePlanId(user.id)).toBe("performance");
    expect(await canUseFeature(user.id, "nutrition")).toBe(true);
    expect(await canUseFeature(user.id, "learn_full")).toBe(true);
    expect(await canUseFeature(user.id, "ai")).toBe(true);
    expect(await canUseFeature(user.id, "coaching")).toBe(false);
    const credits = await creditsForCurrentPlan(user.id);
    expect(credits.credits).toHaveLength(0);
  });

  it("allots Elite credits and stores catalog plan from a standalone webhook", async () => {
    turnStripeOn();
    const admin = await makeUser("admin-elite@example.com", false, "admin");
    const user = await makeUser("elite@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: user.id,
      plan: "elite",
    });
    expect(await getEffectivePlanId(user.id)).toBe("elite");
    const credits = await creditsForCurrentPlan(user.id);
    const byKind = Object.fromEntries(credits.credits.map((row) => [row.kind, row.remaining]));
    expect(byKind.checkin_30).toBe(2);
    expect(byKind.video_review).toBe(2);

    const standalone = await makeUser("hook@example.com");
    await applyStripeEvent({
      id: "evt_m5_standalone",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: standalone.id, plan: "standalone" },
          subscription: "sub_m5",
        },
      },
    });
    const row = await prisma.subscription.findFirst({ where: { userId: standalone.id } });
    expect(row?.plan).toBe("performance");
    expect(await getEffectivePlanId(standalone.id)).toBe("performance");
  });

  it("enforces Elite cap and waitlist", async () => {
    turnStripeOn();
    const admin = await makeUser("admin-cap@example.com", false, "admin");
    for (let i = 0; i < PLAN_CAPS.elite; i += 1) {
      const member = await makeUser(`elite${i}@example.com`);
      await assignPlanForPilot({
        adminUserId: admin.id,
        targetUserId: member.id,
        plan: "elite",
      });
    }
    expect(await isPlanAtCap("elite")).toBe(true);
    const waiter = await makeUser("wait@example.com");
    process.env.STRIPE_PRICE_ELITE_NON = "price_elite_non";
    await expect(assertCanCheckoutPlan(waiter.id, "elite_non")).rejects.toMatchObject({
      code: "WAITLIST",
    });
    const entry = await joinWaitlist(waiter.id, "elite");
    expect(entry.status).toBe("waiting");
    expect(entry.plan).toBe("elite");
  });

  it("requires admin gym verify for gym-member prices", async () => {
    turnStripeOn();
    const member = await makeUser("gym-price@example.com", true);
    await expect(assertCanCheckoutPlan(member.id, "performance_gym")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(assertCanCheckoutPlan(member.id, "conditioning_gym")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("flags VIP strategy bookings as included credit and blocks intensives off Platinum", async () => {
    turnStripeOn();
    const admin = await makeUser("admin-book@example.com", false, "admin");
    const vip = await makeUser("vip@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: vip.id,
      plan: "vip",
    });
    const booked = await createBookingRequestForUser(vip.id, {
      kind: "mindset",
      preferredTimes: "Thursday after 5pm El Paso",
      note: "Mindset extra",
    });
    expect(booked.usesIncludedCredit).toBe(true);

    const perf = await makeUser("no-int@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: perf.id,
      plan: "performance",
    });
    await expect(
      createBookingRequestForUser(perf.id, {
        kind: "intensive_elpaso",
        preferredTimes: "Next month",
        note: "",
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      markCreditUsed({
        actorUserId: vip.id,
        actorRole: "member",
        targetUserId: vip.id,
        kind: "strategy_45",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await markCreditUsed({
      actorUserId: admin.id,
      actorRole: "admin",
      targetUserId: vip.id,
      kind: "strategy_45",
    });
    const after = await creditsForCurrentPlan(vip.id);
    expect(after.credits.find((row) => row.kind === "strategy_45")?.remaining).toBe(0);
  });

  it("keeps the Coach Savage ≠ Ricky disclaimer", () => {
    expect(AI_DISCLAIMER).toMatch(/not Ricky/i);
    expect(PLAN_CATALOG.vip.includes.join(" ")).toMatch(/billing month/i);
  });
});
