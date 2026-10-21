import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { assertCanCheckoutPlan } from "@/lib/billing";
import { CHECKOUT_SKUS, PLAN_CATALOG, publicSkusForPlan } from "@/lib/plans";
import { SKU_AMOUNT_CENTS } from "@/lib/bnpl";
import {
  ACADEMY_EXPECT,
  COACHING_CAP,
  COACHING_EXPECT,
  COACHING_MONTHLY,
  MEMBER_PRO_DAYS,
  NONMEMBER_TRIAL_DAYS,
  PERFORMANCE_ANNUAL,
  PERFORMANCE_MONTHLY,
  PRO_EXPECT,
  coachingSpotsLine,
  performanceAnnualLine,
  performancePriceLine,
  usd,
} from "@/lib/pricing";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("owner-approved three-plan pricing", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_STANDALONE;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("shows SVG Pro, the academy tier, and 1-on-1 coaching with the approved prices", () => {
    expect(MEMBER_PRO_DAYS).toBe(14);
    expect(NONMEMBER_TRIAL_DAYS).toBe(7);
    expect(PERFORMANCE_MONTHLY).toBe(9.99);
    expect(PERFORMANCE_ANNUAL).toBe(72.99);
    expect(COACHING_MONTHLY).toBe(249);
    expect(COACHING_CAP).toBe(20);
    expect(usd(9.99)).toBe("$9.99");
    expect(usd(72.99)).toBe("$72.99");
    expect(performancePriceLine()).toBe("$9.99/mo or $72.99/yr, save 39%");
    expect(performanceAnnualLine()).toBe("or $72.99/yr, save 39%");
    expect(ACADEMY_EXPECT).toMatch(/SVG Academy dues/);
    expect(PRO_EXPECT).toBe("Everything in the academy tier, plus…");
    expect(COACHING_EXPECT).toBe("Everything in Pro, plus…");
    expect(coachingSpotsLine(12)).toBe("12 coaching spots open");
    expect(coachingSpotsLine(0)).toBe("Sold out");
    expect(coachingSpotsLine(null)).toBe("Limited to 20 athletes");
    expect(PLAN_CATALOG.member_access.label).toBe("Trial ended");
    expect(PLAN_CATALOG.academy.gymPriceLabel).toBe("Included in dues");
    expect(PLAN_CATALOG.academy.includes).toEqual(
      expect.arrayContaining(["Sparring log", "Weekly check-in form", "Fuel logging", "30 days of history"]),
    );
    expect(PLAN_CATALOG.performance.label).toBe("SVG Pro");
    expect(PLAN_CATALOG.performance.gymPriceLabel).toBe("$9.99/mo");
    expect(PLAN_CATALOG.performance.nonmemberPriceLabel).toBe("$9.99/mo");
    expect(PLAN_CATALOG.performance.includes).toEqual(
      expect.arrayContaining([
        "AI coach chat with voices",
        "Today's Summary read-aloud",
        "RIR auto-adjust after sparring or low readiness",
        "AI feedback on check-ins and meals",
        "Sparring trends",
        "Full history",
      ]),
    );
    expect(PLAN_CATALOG.coaching.label).toBe("1-on-1 Coaching with Ricky");
    expect(PLAN_CATALOG.coaching.gymPriceLabel).toBe("$249/mo");
    expect(PLAN_CATALOG.coaching.cap).toBe(20);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/Custom programming/);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/check-ins reviewed by Ricky/);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/Video form reviews/);
    expect(PLAN_CATALOG.performance.summary).not.toMatch(/59/);
    expect(PLAN_CATALOG.performance.summary).toMatch(/save 39%/);
  });

  it("keeps new checkout SKUs inactive and does not pair member and nonmember prices on the page", () => {
    expect(CHECKOUT_SKUS.performance_monthly.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.performance_monthly.amountCents).toBe(999);
    expect(CHECKOUT_SKUS.performance_year.amountCents).toBe(7299);
    expect(CHECKOUT_SKUS.coaching_monthly.amountCents).toBe(24900);
    expect(Object.keys(CHECKOUT_SKUS).some((id) => id.includes("founding"))).toBe(false);
    expect(CHECKOUT_SKUS.coaching_monthly.catalogId).toBe("coaching");
    expect(SKU_AMOUNT_CENTS.performance_monthly).toBe(999);
    expect(publicSkusForPlan("coaching")).toEqual([]);
    const files = [
      "src/lib/pricing.ts",
      "src/components/pricing/PricingCatalog.tsx",
      "src/app/pricing/page.tsx",
    ];
    for (const file of files) {
      const text = read(file);
      expect(text).not.toMatch(/\$19\/mo/);
      expect(text).not.toMatch(/\$29\/mo/);
      expect(text).not.toMatch(/\$119\b/);
      expect(text).not.toMatch(/\$79\/yr/);
      expect(text).not.toMatch(/14-day trial/i);
      expect(text).not.toMatch(/Pro free for 30 days/);
      expect(text.toLowerCase()).not.toMatch(/proposal/);
      expect(text.toLowerCase()).not.toMatch(/additional to gym dues/);
      expect(text).not.toMatch(/Fighter Development/);
      expect(text).not.toMatch(/Elite Online/);
      expect(text).not.toMatch(/Platinum VIP/);
      expect(text.toLowerCase()).not.toMatch(/\bbout\b/);
      expect(text).not.toMatch(/first 100/);
      expect(text).not.toMatch(/\$59\/mo/);
      expect(text).not.toMatch(/\$59\/yr/);
      expect(text).not.toMatch(/founding/i);
    }
    const desk = read("src/app/(member)/admin/page.tsx");
    expect(desk).not.toMatch(/founding/i);
    expect(desk).toContain("deskTone");
    const publicSurfaces = [
      "src/components/pricing/PricingCatalog.tsx",
      "src/app/pricing/page.tsx",
      "src/components/PaywallNotice.tsx",
      "src/components/upgrade/TrialEndedPaywall.tsx",
      "src/components/upgrade/UpgradePreview.tsx",
      "src/components/upgrade/MemberProReminderBanner.tsx",
      "src/components/onboarding/PlanChoiceForm.tsx",
      "src/app/page.tsx",
      "src/app/(member)/plan/page.tsx",
      "src/lib/member-pro-reminders.ts",
    ];
    for (const file of publicSurfaces) {
      const surface = read(file);
      expect(surface).not.toMatch(/of 40 left/);
      expect(surface).not.toMatch(/\$59\/yr/);
      expect(surface).not.toMatch(/founding/i);
    }
    expect(read(".env.example")).not.toMatch(/FOUNDING/);
    expect(read(".env.production.example")).not.toMatch(/FOUNDING/);
    expect(read("src/lib/plans.ts")).not.toMatch(/founding/i);
    expect(read("src/lib/billing.ts")).not.toMatch(/founding/i);
    const catalog = read("src/components/pricing/PricingCatalog.tsx");
    const academyAt = catalog.indexOf('data-plan-card="academy"');
    const proAt = catalog.indexOf('data-plan-card="performance"');
    const coachingAt = catalog.indexOf('data-plan-card="coaching"');
    expect(academyAt).toBeGreaterThan(-1);
    expect(academyAt).toBeLessThan(proAt);
    expect(proAt).toBeLessThan(coachingAt);
    expect(catalog).toContain("SVG Academy gym member");
    expect(catalog).toContain("Free version included with gym membership at our academy");
    expect(catalog).not.toContain("Included in dues");
    expect(catalog).toContain('tone="add"');
    expect(catalog).toContain("text-accent");
    expect(catalog).toContain("Start 7-day free trial");
    expect(catalog).toContain("Subscribe — opening Nov 16");
    expect(catalog).toContain("performanceAnnualLine()");
    expect(performanceAnnualLine()).toBe("or $72.99/yr, save 39%");
    expect(catalog).toContain("In-person intensives and VIP");
    expect(catalog).toContain("Book with Ricky");
    expect(catalog).not.toContain("data-pricing-toggle");
    expect(read("src/app/pricing/page.tsx")).toContain("Paid checkout opens Nov 16");
    expect(read("src/app/pricing/page.tsx")).toContain("academy members and Pro subscribers");
    expect(read("src/app/pricing/page.tsx")).toContain("Gymdesk dues");
    expect(read("src/lib/billing.ts")).toContain("Paid plans coming soon.");
  });

  it("refuses checkout on the new SKUs even when Stripe TEST keys exist", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
    process.env.STRIPE_PRICE_PERFORMANCE_YEAR = "price_year";
    const user = await makeUser("inactive-sku@example.com");
    await expect(assertCanCheckoutPlan(user.id, "performance_year")).rejects.toMatchObject({
      code: "BILLING",
      message: "Paid plans coming soon.",
    });
    await expect(assertCanCheckoutPlan(user.id, "coaching_monthly")).rejects.toMatchObject({
      code: "BILLING",
      message: "Paid plans coming soon.",
    });
  });
});
