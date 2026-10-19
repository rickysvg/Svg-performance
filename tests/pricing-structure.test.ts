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

  it("shows Free, SVG Performance, and 1-on-1 coaching with one price each", () => {
    expect(PERFORMANCE_MONTHLY).toBe(9.99);
    expect(PERFORMANCE_ANNUAL).toBe(79);
    expect(FOUNDING_ANNUAL).toBe(59);
    expect(FOUNDING_CAP).toBe(250);
    expect(COACHING_MONTHLY).toBe(249);
    expect(COACHING_CAP).toBe(20);
    expect(usd(9.99)).toBe("$9.99");
    expect(usd(79)).toBe("$79");
    expect(performancePriceLine()).toBe("$9.99/mo or $79/yr, save 34%");
    expect(performanceAnnualLine()).toBe("or $79/yr, save 34%");
    expect(foundingPriceLine(250)).toContain("$59/year");
    expect(foundingPriceLine(250)).toContain("first 250 members");
    expect(foundingPriceLine(250)).toContain("250 of 250 spots left");
    expect(isFoundingDealOpen(0)).toBe(true);
    expect(isFoundingDealOpen(250)).toBe(false);
    expect(coachingSpotsLine(12)).toBe("12 of 20 spots left");
    expect(coachingSpotsLine(null)).toBe("Limited to 20 athletes");
    expect(PLAN_CATALOG.member_access.label).toBe("Free");
    expect(PLAN_CATALOG.member_access.includes).toEqual(["Workout log", "Timers", "1 sample plan"]);
    expect(PLAN_CATALOG.performance.gymPriceLabel).toBe("$9.99/mo");
    expect(PLAN_CATALOG.performance.nonmemberPriceLabel).toBe("$9.99/mo");
    expect(PLAN_CATALOG.performance.includes).toEqual(
      expect.arrayContaining([
        "Full training plans",
        "Fight camp",
        "SVG Coach (AI coach)",
        "Mobility",
        "Fuel",
        "Form check",
        "Sparring log",
      ]),
    );
    expect(PLAN_CATALOG.coaching.label).toBe("1-on-1 Coaching with Ricky");
    expect(PLAN_CATALOG.coaching.gymPriceLabel).toBe("$249/mo");
    expect(PLAN_CATALOG.coaching.cap).toBe(20);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/Custom programming/);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/check-ins reviewed by Ricky/);
    expect(PLAN_CATALOG.coaching.includes.join(" ")).toMatch(/Video form reviews/);
  });

  it("keeps new checkout SKUs inactive and does not pair member and nonmember prices on the page", () => {
    expect(CHECKOUT_SKUS.performance_monthly.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.performance_monthly.amountCents).toBe(999);
    expect(CHECKOUT_SKUS.performance_year.amountCents).toBe(7900);
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
      expect(text).not.toMatch(/Fighter Development/);
      expect(text).not.toMatch(/Elite Online/);
      expect(text).not.toMatch(/Platinum VIP/);
      expect(text.toLowerCase()).not.toMatch(/\bbout\b/);
    }
    const catalog = read("src/components/pricing/PricingCatalog.tsx");
    expect(catalog).toContain("Coming soon");
    expect(catalog).toContain("performanceAnnualLine()");
    expect(performanceAnnualLine()).toBe("or $79/yr, save 34%");
    expect(catalog).toContain("In-person intensives and VIP");
    expect(catalog).toContain("Book with Ricky");
    expect(catalog).not.toContain("data-pricing-toggle");
    expect(read("src/app/pricing/page.tsx")).toContain("Paid plans coming soon");
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
