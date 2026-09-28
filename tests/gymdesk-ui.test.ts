import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gymdeskPublicOrigin } from "@/lib/gymdesk/config";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("gymdesk UI copy", () => {
  it("uses the academy grace banner, email-code screen, and webhook URLs", () => {
    expect(read("src/components/gymdesk/GraceBanner.tsx")).toContain(
      "Your academy membership shows as inactive. Member pricing ends on",
    );
    expect(read("src/app/verify-email/page.tsx")).toContain("Confirm your email");
    expect(read("src/app/verify-email/page.tsx")).toContain("font-display");
    expect(read("src/app/verify-email/page.tsx")).toContain(
      "Member pricing uses academy records. We email a 6-digit code so you prove you own",
    );
    expect(read("src/app/verify-email/page.tsx")).not.toContain("SVG Coach is an AI coach");
    expect(read("src/app/(member)/profile/page.tsx")).toContain(
      "Verified via SVG MMA Academy records on",
    );
    expect(read("src/app/actions/gymdesk.ts")).toContain("The CSV file was discarded");
    expect(read("src/lib/gymdesk/config.ts")).toContain("/api/gymdesk/webhook/");
    expect(read("src/lib/gymdesk/csv.ts")).toContain("Date of birth");
    expect(read("src/lib/gymdesk/csv.ts")).toContain("Notes");
  });

  it("sends email codes through the same SMTP_* mail helper as password reset", () => {
    const emailCode = read("src/lib/gymdesk/email-code.ts");
    const auth = read("src/lib/auth.ts");
    expect(emailCode).toContain('from "@/lib/mail"');
    expect(emailCode).toContain("isSmtpConfigured");
    expect(emailCode).toContain("sendMail");
    expect(emailCode).not.toContain("RESEND_");
    expect(auth).toContain('from "@/lib/mail"');
    expect(auth).toContain("sendMail");
    const mail = read("src/lib/mail.ts");
    expect(mail).toContain("SMTP_HOST");
    expect(mail).toContain("SMTP_PORT");
    expect(mail).toContain("SMTP_USER");
    expect(mail).toContain("SMTP_PASS");
    expect(mail).toContain("SMTP_FROM");
  });

  it("never says bout and stays worldwide", () => {
    const files = [
      "src/app/(member)/admin/gymdesk/page.tsx",
      "src/app/verify-email/page.tsx",
      "src/components/gymdesk/GraceBanner.tsx",
      "src/lib/gymdesk/email-code.ts",
    ];
    for (const file of files) {
      const text = read(file).toLowerCase();
      expect(text).not.toContain("bout");
      expect(text).not.toContain("el paso");
    }
  });
});

describe("gymdesk webhook origin", () => {
  const env = process.env as Record<string, string | undefined>;
  const snapshot = {
    NODE_ENV: env.NODE_ENV,
    APP_URL: env.APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
  };

  afterEach(() => {
    env.NODE_ENV = snapshot.NODE_ENV;
    env.APP_URL = snapshot.APP_URL;
    if (snapshot.VERCEL_PROJECT_PRODUCTION_URL === undefined) {
      delete env.VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      env.VERCEL_PROJECT_PRODUCTION_URL = snapshot.VERCEL_PROJECT_PRODUCTION_URL;
    }
  });

  it("uses APP_URL when it is a public https origin", () => {
    env.NODE_ENV = "production";
    env.APP_URL = "https://custom.svg-performance.app";
    delete env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(gymdeskPublicOrigin()).toBe("https://custom.svg-performance.app");
  });

  it("falls back to VERCEL_PROJECT_PRODUCTION_URL when APP_URL is unset", () => {
    env.NODE_ENV = "production";
    delete env.APP_URL;
    env.VERCEL_PROJECT_PRODUCTION_URL = "svg-from-vercel.vercel.app";
    expect(gymdeskPublicOrigin()).toBe("https://svg-from-vercel.vercel.app");
  });

  it("falls back to svg-performance.vercel.app and never uses localhost in production", () => {
    env.NODE_ENV = "production";
    env.APP_URL = "http://localhost:3000";
    delete env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(gymdeskPublicOrigin()).toBe("https://svg-performance.vercel.app");
    expect(gymdeskPublicOrigin()).not.toContain("localhost");
  });

  it("allows localhost APP_URL outside production", () => {
    env.NODE_ENV = "test";
    env.APP_URL = "http://localhost:3000";
    expect(gymdeskPublicOrigin()).toBe("http://localhost:3000");
  });
});
