import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { assertCanCheckoutPlan } from "@/lib/billing";
import { CHECKOUT_SKUS, PLAN_CATALOG, publicSkusForPlan } from "@/lib/plans";
import { SKU_AMOUNT_CENTS } from "@/lib/bnpl";
import {
  COACHING_CAP,
  COACHING_MONTHLY,
  FOUNDING_ANNUAL,
  FOUNDING_CAP,
  PERFORMANCE_ANNUAL,
  PERFORMANCE_MONTHLY,
  coachingSpotsLine,
  foundingPriceLine,
  isFoundingDealOpen,
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
    expect(PERFORMANCE_MONTHLY).toBe(9.99);
    expect(PERFORMANCE_ANNUAL).toBe(72.99);
    expect(FOUNDING_ANNUAL).toBe(59);
    expect(FOUNDING_CAP).toBe(100);
    expect(COACHING_MONTHLY).toBe(249);
    expect(COACHING_CAP).toBe(20);
    expect(usd(9.99)).toBe("$9.99");
    expect(usd(72.99)).toBe("$72.99");
    expect(performancePriceLine()).toBe("$9.99/mo or $72.99/yr, save 39%");
    expect(performanceAnnualLine()).toBe("or $72.99/yr, save 39%");
    expect(foundingPriceLine(100)).toContain("$59/year");
    expect(foundingPriceLine(100)).toContain("first 100 members");
    expect(foundingPriceLine(100)).toContain("100 founding spots left");
    expect(foundingPriceLine(0)).toContain("Sold out");
    expect(isFoundingDealOpen(0)).toBe(true);
    expect(isFoundingDealOpen(100)).toBe(false);
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
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/Includes Pro/);
  });

  it("keeps new checkout SKUs inactive and does not pair member and nonmember prices on the page", () => {
    expect(CHECKOUT_SKUS.performance_monthly.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.performance_monthly.amountCents).toBe(999);
    expect(CHECKOUT_SKUS.performance_year.amountCents).toBe(7299);
    expect(CHECKOUT_SKUS.performance_founding.amountCents).toBe(5900);
    expect(CHECKOUT_SKUS.coaching_monthly.amountCents).toBe(24900);
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
      expect(text).not.toMatch(/14-day/);
      expect(text.toLowerCase()).not.toMatch(/proposal/);
      expect(text.toLowerCase()).not.toMatch(/additional to gym dues/);
      expect(text).not.toMatch(/Fighter Development/);
      expect(text).not.toMatch(/Elite Online/);
      expect(text).not.toMatch(/Platinum VIP/);
      expect(text.toLowerCase()).not.toMatch(/\bbout\b/);
    }
    const catalog = read("src/components/pricing/PricingCatalog.tsx");
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
