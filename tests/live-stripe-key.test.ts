import { afterEach, describe, expect, it } from "vitest";
import { getStripe } from "@/lib/stripe";

describe("live Stripe keys", () => {
  const env = process.env.VERCEL_ENV;
  const key = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = env;
    if (key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = key;
  });

  it("refuses live keys in dev and preview", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    delete process.env.VERCEL_ENV;
    expect(() => getStripe()).toThrow(/not allowed outside production/);
    process.env.VERCEL_ENV = "preview";
    expect(() => getStripe()).toThrow(/not allowed outside production/);
    process.env.VERCEL_ENV = "development";
    process.env.STRIPE_SECRET_KEY = "rk_live_example";
    expect(() => getStripe()).toThrow(/not allowed outside production/);
  });

  it("allows live keys only when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    expect(getStripe()).toBeTruthy();
    process.env.STRIPE_SECRET_KEY = "rk_live_example";
    expect(getStripe()).toBeTruthy();
  });

  it("still accepts test keys outside production", () => {
    delete process.env.VERCEL_ENV;
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    expect(getStripe()).toBeTruthy();
    delete process.env.STRIPE_SECRET_KEY;
    expect(getStripe()).toBeNull();
  });
});
