import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgotPasswordAction } from "@/app/actions/auth";
import {
  authenticate,
  hashResetToken,
  hashToken,
  newRawToken,
  requestPasswordReset,
  resetPasswordWithToken,
  sweepLegacyPasswordResetTokens,
} from "@/lib/auth";
import { AppError, AuthError } from "@/lib/errors";
import { setMailSenderForTests } from "@/lib/mail";
import { getHeartDeviceStatus } from "@/lib/heart";
import {
  PASSWORD_RESET_GENERATION,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  PASSWORD_RESET_RATE_MESSAGE,
} from "@/lib/password-reset-policy";
import { assertPasswordResetRateLimit } from "@/lib/password-reset-rate";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";

const envSnapshot = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_HOST: process.env.SMTP_HOST,
  APP_URL: process.env.APP_URL,
};

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

async function withEnv(
  values: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("password reset", () => {
  beforeEach(async () => {
    await resetDatabase();
    setMailSenderForTests(null);
    (process.env as Record<string, string | undefined>).NODE_ENV = envSnapshot.NODE_ENV;
    if (envSnapshot.SMTP_HOST === undefined) {
      delete process.env.SMTP_HOST;
    } else {
      process.env.SMTP_HOST = envSnapshot.SMTP_HOST;
    }
    process.env.APP_URL = envSnapshot.APP_URL ?? "http://localhost:3000";
  });

  afterEach(() => {
    setMailSenderForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("still lets local development open a one-time link", async () => {
    await makeUser("reset@example.com");
    const requested = await requestPasswordReset("reset@example.com");
    expect(requested.resetUrl).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);
    const token = new URL(requested.resetUrl as string).searchParams.get("token");
    expect(token).toBeTruthy();
    await resetPasswordWithToken(token as string, "newpass123");
    await expect(authenticate("reset@example.com", "password12")).rejects.toBeInstanceOf(
      AuthError,
    );
    await expect(authenticate("reset@example.com", "newpass123")).resolves.toMatchObject({
      email: "reset@example.com",
    });
  });

  it("gives every production email the same response and no link when mail is off", async () => {
    await makeUser("known@example.com");
    await withEnv({ NODE_ENV: "production", SMTP_HOST: undefined, APP_URL: "https://svg-performance.vercel.app" }, async () => {
      const known = await forgotPasswordAction({}, form("known@example.com"));
      const unknown = await forgotPasswordAction({}, form("nobody@example.com"));
      expect(known).toEqual(unknown);
      expect(known).toEqual({ success: PASSWORD_RESET_NEUTRAL_MESSAGE });
      expect(JSON.stringify(known)).not.toMatch(/token|reset-password/i);
      expect(await prisma.passwordResetToken.count()).toBe(0);
    });
  });

  it("emails the link in production and never returns it to the client", async () => {
    await makeUser("mail@example.com");
    const sent: string[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input.text);
      return { sent: true, reason: "sent" };
    });
    await withEnv(
      {
        NODE_ENV: "production",
        SMTP_HOST: "smtp.example.com",
        APP_URL: "https://svg-performance.vercel.app",
      },
      async () => {
        const known = await forgotPasswordAction({}, form("mail@example.com"));
        const unknown = await forgotPasswordAction({}, form("missing@example.com"));
        expect(known).toEqual({ success: PASSWORD_RESET_NEUTRAL_MESSAGE });
        expect(unknown).toEqual(known);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toContain("https://svg-performance.vercel.app/reset-password?token=");
        expect(JSON.stringify(known)).not.toContain(sent[0]);
        const token = new URL(sent[0].match(/https:\/\/\S+/)?.[0] ?? "").searchParams.get("token");
        expect(token).toBeTruthy();
        await resetPasswordWithToken(token as string, "newpass123");
        await expect(authenticate("mail@example.com", "newpass123")).resolves.toMatchObject({
          email: "mail@example.com",
        });
      },
    );
  });

  it("does not keep a token when the email fails to send", async () => {
    await makeUser("fail@example.com");
    setMailSenderForTests(async () => ({ sent: false, reason: "send_failed" }));
    await withEnv(
      {
        NODE_ENV: "production",
        SMTP_HOST: "smtp.example.com",
        APP_URL: "https://svg-performance.vercel.app",
      },
      async () => {
        const result = await forgotPasswordAction({}, form("fail@example.com"));
        expect(result).toEqual({ success: PASSWORD_RESET_NEUTRAL_MESSAGE });
        expect(await prisma.passwordResetToken.count()).toBe(0);
      },
    );
  });

  it("does not email a localhost link from production", async () => {
    await makeUser("local@example.com");
    const sent: string[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input.text);
      return { sent: true, reason: "sent" };
    });
    await withEnv(
      {
        NODE_ENV: "production",
        SMTP_HOST: "smtp.example.com",
        APP_URL: "http://localhost:3000",
      },
      async () => {
        const result = await requestPasswordReset("local@example.com");
        expect(result).toEqual({ resetUrl: null, emailed: false });
        expect(sent).toHaveLength(0);
        expect(await prisma.passwordResetToken.count()).toBe(0);
      },
    );
  });

  it("rate-limits known and unknown emails with the same error", async () => {
    await makeUser("limited@example.com");
    await withEnv({ NODE_ENV: "production", SMTP_HOST: undefined }, async () => {
      for (let i = 0; i < 5; i += 1) {
        await requestPasswordReset("limited@example.com");
      }
      await expect(requestPasswordReset("limited@example.com")).rejects.toMatchObject({
        message: PASSWORD_RESET_RATE_MESSAGE,
      });
      for (let i = 0; i < 5; i += 1) {
        await requestPasswordReset("unknown-limited@example.com");
      }
      await expect(requestPasswordReset("unknown-limited@example.com")).rejects.toMatchObject({
        message: PASSWORD_RESET_RATE_MESSAGE,
      });
    });
    await expect(assertPasswordResetRateLimit("ip", "203.0.113.8")).resolves.toBeUndefined();
  });

  it("rate-limits an address after repeated attempts", async () => {
    for (let i = 0; i < 20; i += 1) {
      await assertPasswordResetRateLimit("ip", "198.51.100.20");
    }
    await expect(assertPasswordResetRateLimit("ip", "198.51.100.20")).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("rejects and deletes reset tokens created before the fix", async () => {
    const user = await makeUser("legacy@example.com");
    const raw = newRawToken();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(raw),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        generation: 1,
      },
    });
    const removed = await sweepLegacyPasswordResetTokens(true);
    expect(removed).toBe(1);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
    await expect(resetPasswordWithToken(raw, "newpass123")).rejects.toBeInstanceOf(AuthError);
    await expect(authenticate("legacy@example.com", "password12")).resolves.toMatchObject({
      email: "legacy@example.com",
    });
  });

  it("rejects a pre-fix hash even if the row was marked current", async () => {
    const user = await makeUser("oldhash@example.com");
    const raw = newRawToken();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(raw),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        generation: PASSWORD_RESET_GENERATION,
      },
    });
    await expect(resetPasswordWithToken(raw, "newpass123")).rejects.toBeInstanceOf(AuthError);
    expect(hashResetToken(raw)).not.toBe(hashToken(raw));
  });

  it("does not render a reset link on the production forgot-password page", () => {
    const root = process.cwd();
    const formSource = fs.readFileSync(
      path.join(root, "src/components/auth/ForgotPasswordForm.tsx"),
      "utf8",
    );
    const pageSource = fs.readFileSync(path.join(root, "src/app/forgot-password/page.tsx"), "utf8");
    const actionSource = fs.readFileSync(path.join(root, "src/app/actions/auth.ts"), "utf8");
    expect(formSource).not.toContain("PREVIEW ONLY");
    expect(formSource).toContain('process.env.NODE_ENV !== "production"');
    expect(formSource).toContain("Open reset link");
    expect(formSource).not.toContain(">{state.resetUrl}<");
    expect(pageSource).toContain("PASSWORD_RESET_NEUTRAL_MESSAGE");
    expect(pageSource).not.toContain("token=");
    expect(pageSource).not.toContain("PREVIEW");
    expect(actionSource).toContain('process.env.NODE_ENV !== "production" && result.resetUrl');
  });

  it("does not return wearable access tokens or password hashes to the client", async () => {
    const user = await makeUser("secrets@example.com");
    const status = await getHeartDeviceStatus(user.id);
    expect(status).not.toHaveProperty("accessToken");
    expect(status).not.toHaveProperty("refreshToken");
    expect(JSON.stringify(status)).not.toMatch(/sk_live|sk_test|AUTH_SECRET|passwordHash/);
  });
});
