import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SUPPORT_EMAIL, supportEmail } from "@/lib/support";
import { passwordResetHtml } from "@/lib/mail";
import { PASSWORD_RESET_NEUTRAL_MESSAGE } from "@/lib/password-reset-policy";

const HYPHENATED_SUPPORT = ["support@svg", "performance.app"].join("-");
const OLD_ACADEMY_SUPPORT = ["manager@svgmma", "academy.com"].join("");

describe("support email", () => {
  const previous = process.env.SUPPORT_EMAIL;

  afterEach(() => {
    if (previous === undefined) delete process.env.SUPPORT_EMAIL;
    else process.env.SUPPORT_EMAIL = previous;
  });

  it("resolves to support@svgperformance.app when unset", () => {
    delete process.env.SUPPORT_EMAIL;
    expect(SUPPORT_EMAIL).toBe("support@svgperformance.app");
    expect(supportEmail()).toBe(SUPPORT_EMAIL);
    expect(PASSWORD_RESET_NEUTRAL_MESSAGE).toContain(SUPPORT_EMAIL);
    expect(passwordResetHtml("https://svgperformance.app/reset-password?token=abc")).toContain(
      `mailto:${SUPPORT_EMAIL}`,
    );
  });

  it("ignores retired support inboxes", () => {
    for (const retired of [HYPHENATED_SUPPORT, OLD_ACADEMY_SUPPORT]) {
      process.env.SUPPORT_EMAIL = retired;
      expect(supportEmail()).toBe(SUPPORT_EMAIL);
    }
  });

  it("keeps a different configured inbox", () => {
    process.env.SUPPORT_EMAIL = " Help@Example.com ";
    expect(supportEmail()).toBe("help@example.com");
  });

  it("does not publish a retired support address", () => {
    const root = process.cwd();
    const files = [
      "src/lib/support.ts",
      "src/lib/mail.ts",
      "src/lib/auth.ts",
      "src/lib/password-reset-policy.ts",
      "src/app/terms/page.tsx",
      "src/app/privacy/page.tsx",
      "src/app/pricing/page.tsx",
      "src/app/(member)/plan/page.tsx",
      "src/app/billing/cancel/page.tsx",
      "src/app/billing/success/page.tsx",
      "src/components/PaywallNotice.tsx",
      "src/components/upgrade/TrialEndedPaywall.tsx",
      "src/components/billing/BillingProblemBanner.tsx",
      "src/components/profile/YourDataSection.tsx",
      ".env.example",
      ".env.production.example",
      "README.md",
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source, file).not.toContain(HYPHENATED_SUPPORT);
      expect(source, file).not.toContain(OLD_ACADEMY_SUPPORT);
    }
  });
});
