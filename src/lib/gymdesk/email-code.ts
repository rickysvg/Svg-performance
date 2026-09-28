import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { EMAIL_CODE_TTL_MS } from "@/lib/gymdesk/config";
import { hashCode } from "@/lib/gymdesk/crypto";
import { assertGymdeskRateLimit } from "@/lib/gymdesk/rate-limit";
import { matchUserToGymdesk } from "@/lib/gymdesk/match";

export function emailCodeHtml(code: string) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <p style="margin:0 0 16px;font-weight:700;font-size:28px;letter-spacing:0.04em;text-transform:uppercase;">Your SVG code</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Use this 6-digit code to confirm you own this email. It expires in 15 minutes.</p>
    <p style="margin:0;font-size:32px;letter-spacing:0.24em;font-weight:700;">${code}</p>
  </div>
</body>
</html>`;
}

/**
 * Send a 6-digit ownership code through the same SMTP_* / sendMail path as
 * password-reset. No extra mail env vars.
 */
export async function sendEmailVerificationCode(input: {
  userId: string;
  email: string;
  ip?: string;
}) {
  if (!isSmtpConfigured()) {
    throw new AppError("MAIL", "Email sending is not configured right now.");
  }
  await assertGymdeskRateLimit({
    scope: "email-code",
    value: input.email.toLowerCase(),
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Wait a few minutes before requesting another code.",
  });
  if (input.ip) {
    await assertGymdeskRateLimit({
      scope: "email-code-ip",
      value: input.ip,
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: "Wait a few minutes before requesting another code.",
    });
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  await prisma.emailVerificationCode.create({
    data: {
      userId: input.userId,
      codeHash: hashCode(code),
      expiresAt,
    },
  });
  const mailed = await sendMail({
    to: input.email,
    subject: "Your SVG Performance email code",
    text: `Your confirmation code is ${code}. It expires in 15 minutes.`,
    html: emailCodeHtml(code),
  });
  if (!mailed.sent) {
    throw new AppError("MAIL", "Could not send the code. Try again later.");
  }
  return { sent: true as const, expiresAt };
}

export async function confirmEmailVerificationCode(input: {
  userId: string;
  code: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    throw new AppError("CODE", "Enter the 6-digit code.");
  }
  const row = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: input.userId,
      codeHash: hashCode(code),
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    throw new AppError("CODE", "That code is invalid or expired.");
  }
  await prisma.emailVerificationCode.update({
    where: { id: row.id },
    data: { usedAt: now },
  });
  await prisma.profile.update({
    where: { userId: input.userId },
    data: { emailVerifiedAt: now },
  });
  return matchUserToGymdesk(input.userId, now);
}
