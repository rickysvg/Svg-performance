import { afterEach, describe, expect, it } from "vitest";
import { billingReturnOrigin, isAllowedAppHost } from "@/lib/stripe";
import { sessionCookieOptions } from "@/lib/session";

describe("billing return origin", () => {
  const env = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    APP_URL: process.env.APP_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("keeps production on APP_URL and never uses VERCEL_URL", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://svg-performance.vercel.app";
    process.env.VERCEL_URL = "svg-performance-5f6mmv5e0-rickysvg.vercel.app";
    expect(
      billingReturnOrigin({
        host: "svg-performance-5f6mmv5e0-rickysvg.vercel.app",
      }),
    ).toBe("https://svg-performance.vercel.app");
  });

  it("uses the preview request host, then the branch URL, not the deployment URL", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.APP_URL = "https://svg-performance.vercel.app";
    process.env.VERCEL_URL = "svg-performance-5f6mmv5e0-rickysvg.vercel.app";
    process.env.VERCEL_BRANCH_URL = "svg-performance-git-cursor-launch-billing-df1a-rickysvg.vercel.app";
    expect(
      billingReturnOrigin({
        forwardedHost: "svg-performance-git-cursor-launch-billing-df1a-rickysvg.vercel.app",
        proto: "https",
      }),
    ).toBe("https://svg-performance-git-cursor-launch-billing-df1a-rickysvg.vercel.app");
    expect(billingReturnOrigin({ host: "evil.example" })).toBe(
      "https://svg-performance-git-cursor-launch-billing-df1a-rickysvg.vercel.app",
    );
    expect(billingReturnOrigin({})).not.toContain("5f6mmv5e0");
  });

  it("allowlists this app's hosts only", () => {
    expect(isAllowedAppHost("localhost:3000")).toBe(true);
    expect(isAllowedAppHost("svg-performance.vercel.app")).toBe(true);
    expect(isAllowedAppHost("svg-performance-git-cursor-launch-billing-df1a-rickysvg.vercel.app")).toBe(
      true,
    );
    expect(isAllowedAppHost("example.vercel.app")).toBe(false);
    expect(isAllowedAppHost("svg-performance.vercel.app.evil.com")).toBe(false);
  });

  it("does not set a cookie domain", () => {
    const options = sessionCookieOptions(new Date("2026-12-01T00:00:00.000Z"));
    expect(options).not.toHaveProperty("domain");
    expect(JSON.stringify(options)).not.toMatch(/vercel\.app/);
  });
});
