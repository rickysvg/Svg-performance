import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { assertCanCheckoutPlan } from "@/lib/billing";
import { CHECKOUT_SKUS, PLAN_CATALOG, publicSkusForPlan } from "@/lib/plans";
import { SKU_AMOUNT_CENTS } from "@/lib/bnpl";
import {
  academyPerkLine,
  appOffersForView,
  coachingOffersForView,
  COACHING_MONEY_BACK,
  COACHING_TERMS,
  CONDITIONING_PRICES,
  DEVELOPMENT_PRICES,
  ELITE_PRICES,
  FOUNDING_DEAL,
  FOUNDING_DEAL_LINE,
  foundingDealLine,
  isFoundingDealOpen,
  PERFORMANCE_PRICES,
  VIP_PRICES,
} from "@/lib/pricing";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Ricky-approved pricing structure", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_STANDALONE;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps approved USD member / regular pairs", () => {
    expect(PERFORMANCE_PRICES.monthly).toEqual({ member: 19, regular: 29 });
    expect(PERFORMANCE_PRICES.annual).toMatchObject({ member: 149, regular: 229, offLabel: "about 35% off" });
    expect(PERFORMANCE_PRICES.foundingAnnual).toMatchObject({ member: 119, regular: 179, offLabel: "about 20% off" });
    expect(CONDITIONING_PRICES.monthly).toEqual({ member: 49, regular: 59 });
    expect(CONDITIONING_PRICES.fightCamp).toMatchObject({ member: 125, regular: 149, brand: "12-Week Fight Camp" });
    expect(CONDITIONING_PRICES.annual).toEqual({ member: 389, regular: 469 });
    expect(CONDITIONING_PRICES.foundingAnnual).toMatchObject({ member: 309, regular: 369 });
    expect(DEVELOPMENT_PRICES.monthly).toEqual({ member: 149, regular: 179 });
    expect(DEVELOPMENT_PRICES.prepaid3).toMatchObject({ member: 399, regular: 479, recommended: true });
    expect(DEVELOPMENT_PRICES.prepaid6).toEqual({ member: 759, regular: 909 });
    expect(ELITE_PRICES.monthly).toEqual({ member: 299, regular: 349 });
    expect(ELITE_PRICES.prepaid3).toMatchObject({ member: 799, regular: 939, recommended: true });
    expect(ELITE_PRICES.prepaid6).toEqual({ member: 1519, regular: 1779 });
    expect(VIP_PRICES.vip).toEqual({ member: 699, regular: 699 });
    expect(VIP_PRICES.platinum).toEqual({ member: 1199, regular: 1199 });
    expect(PLAN_CATALOG.performance.gymPriceLabel).toBe("$19/mo");
    expect(PLAN_CATALOG.vip.gymPriceLabel).toBe("$699");
    expect(PLAN_CATALOG.platinum.gymPriceLabel).toBe("$1,199");
    expect(SKU_AMOUNT_CENTS.gym).toBe(1900);
    expect(SKU_AMOUNT_CENTS.performance_founding_gym).toBe(11900);
    expect(SKU_AMOUNT_CENTS.conditioning_camp_non).toBe(14900);
    expect(SKU_AMOUNT_CENTS.elite_6mo_non).toBe(177900);
    expect(SKU_AMOUNT_CENTS.vip).toBe(69900);
  });

  it("shows founding annual app offers only while the one config is open", () => {
    expect(FOUNDING_DEAL.enabled).toBe(true);
    expect(FOUNDING_DEAL.windowDays).toBe(90);
    expect(FOUNDING_DEAL.memberCap).toBe(250);
    expect(FOUNDING_DEAL_LINE).toBe("Founding member price, first 90 days or first 250 members");
    expect(foundingDealLine({ ...FOUNDING_DEAL, windowDays: 30, memberCap: 10 })).toContain("first 30 days");
    const start = new Date(FOUNDING_DEAL.startsAtIso);
    expect(isFoundingDealOpen(start, 0)).toBe(true);
    expect(isFoundingDealOpen(start, 250)).toBe(false);
    expect(isFoundingDealOpen(start, 0, { ...FOUNDING_DEAL, enabled: false })).toBe(false);
    const monthly = appOffersForView("monthly", true);
    expect(monthly.performance.map((row) => row.id)).toEqual(["performance-monthly"]);
    const prepay = appOffersForView("prepay", true);
    expect(prepay.performance.some((row) => row.id === "performance-founding")).toBe(true);
    expect(prepay.fighter_conditioning.some((row) => row.title === "12-Week Fight Camp")).toBe(true);
    expect(appOffersForView("prepay", false).performance.some((row) => row.id === "performance-founding")).toBe(
      false,
    );
    const coaching = coachingOffersForView("prepay");
    expect(coaching.fighter_development[0]?.badge).toMatch(/Recommended program length/i);
    expect(coaching.elite.some((row) => row.id.includes("founding"))).toBe(false);
  });

  it("keeps new prepaid and founding SKUs inactive", () => {
    const inactive = Object.values(CHECKOUT_SKUS).filter((sku) => !sku.checkoutEnabled);
    expect(inactive.length).toBeGreaterThanOrEqual(16);
    expect(CHECKOUT_SKUS.performance_annual_gym.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.performance_founding_non.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.conditioning_camp_gym.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.development_3mo_gym.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.elite_6mo_non.checkoutEnabled).toBe(false);
    expect(CHECKOUT_SKUS.gym.checkoutEnabled).toBe(true);
    expect(CHECKOUT_SKUS.vip.checkoutMode).toBe("payment");
    expect(CHECKOUT_SKUS.platinum.checkoutMode).toBe("payment");
    expect(publicSkusForPlan("performance").map((row) => row.id)).toEqual([
      "performance_gym",
      "performance_non",
    ]);
  });

  it("refuses checkout on inactive SKUs even when Stripe TEST keys exist", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
    process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
    process.env.STRIPE_PRICE_PERFORMANCE_ANNUAL_NON = "price_annual";
    const user = await makeUser("inactive-sku@example.com");
    await expect(assertCanCheckoutPlan(user.id, "performance_annual_non")).rejects.toMatchObject({
      code: "BILLING",
      message: "Paid plans coming soon.",
    });
  });

  it("uses academy perk copy and coaching terms without banned wording", () => {
    expect(academyPerkLine({ member: 19, regular: 29 }, "/mo")).toBe(
      "Academy member price $19/mo (normally $29)",
    );
    expect(COACHING_TERMS).toBe(
      "No contracts. Prepay for a program and save. Cancel anytime: we charge months used at the monthly rate and refund the rest.",
    );
    expect(COACHING_MONEY_BACK).toBe("First-month money-back guarantee");
    const files = [
      "src/lib/pricing.ts",
      "src/lib/plans.ts",
      "src/components/pricing/PricingCatalog.tsx",
      "src/app/pricing/page.tsx",
    ];
    for (const file of files) {
      const text = read(file);
      expect(text.toLowerCase()).not.toMatch(/\bbout\b/);
    }
    const catalog = read("src/components/pricing/PricingCatalog.tsx");
    expect(catalog).toContain("Monthly");
    expect(catalog).toContain("Prepay");
    expect(catalog).toContain("Coming soon");
    expect(catalog).toContain("El Paso");
    expect(read("src/app/pricing/page.tsx")).toContain("Paid plans coming soon");
    expect(read("src/lib/billing.ts")).toContain("Paid plans coming soon.");
  });
});
