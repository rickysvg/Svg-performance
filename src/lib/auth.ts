import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthError, AppError } from "@/lib/errors";
import { SESSION_DAYS } from "@/lib/constants";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import {
  PASSWORD_RESET_GENERATION,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
} from "@/lib/password-reset-policy";
import { assertPasswordResetRateLimit } from "@/lib/password-reset-rate";

export { PASSWORD_RESET_GENERATION, PASSWORD_RESET_NEUTRAL_MESSAGE };

const BCRYPT_ROUNDS = 12;
const RESET_HOURS = 1;

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new AppError(
      "CONFIG",
      "AUTH_SECRET is missing or too short. Set it in your .env file.",
      500,
    );
  }
  return secret;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function hashToken(rawToken: string): string {
  const secret = requireAuthSecret();
  return createHash("sha256").update(`${secret}:${rawToken}`).digest("hex");
}

/** Separate from session hashes so links issued before the fix cannot be replayed. */
export function hashResetToken(rawToken: string): string {
  const secret = requireAuthSecret();
  return createHash("sha256")
    .update(`${secret}:password-reset:gen${PASSWORD_RESET_GENERATION}:${rawToken}`)
    .digest("hex");
}

let legacyResetSweep: Promise<number> | null = null;

/** Delete reset links stored before the generation-2 fix. Safe to run on every deploy. */
export function sweepLegacyPasswordResetTokens(force = false): Promise<number> {
  if (force) {
    legacyResetSweep = null;
  }
  if (!legacyResetSweep) {
    legacyResetSweep = prisma.passwordResetToken
      .deleteMany({ where: { generation: { lt: PASSWORD_RESET_GENERATION } } })
      .then((result) => result.count)
      .catch((error: unknown) => {
        legacyResetSweep = null;
        throw error;
      });
  }
  return legacyResetSweep;
}

function publicAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim() ?? "";
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === "production") {
      if (url.protocol !== "https:") {
        return null;
      }
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return null;
      }
    }
    return raw.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function canEmailPasswordReset(): boolean {
  return isSmtpConfigured() && publicAppUrl() !== null && Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}

function devResetPreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !isSmtpConfigured() &&
    publicAppUrl() !== null &&
    Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16)
  );
}

export function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export type UserRole = "member" | "coach" | "admin";

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
};

export function toPublicUser(user: {
  id: string;
  email: string;
  role: string;
}): PublicUser {
  const role: UserRole =
    user.role === "admin" || user.role === "coach" ? user.role : "member";
  return { id: user.id, email: user.email, role };
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  isAdultConfirmed: boolean;
  claimsGymMembership: boolean;
}): Promise<PublicUser> {
  if (!input.isAdultConfirmed) {
    throw new AppError(
      "ADULT",
      "This preview is for adults. Confirm you are 18 or older to create an account.",
    );
  }

  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@") || email.length > 200) {
    throw new AppError("EMAIL", "Enter a valid email address.");
  }
  if (input.password.length < 8) {
    throw new AppError("PASSWORD", "Password must be at least 8 characters.");
  }
  if (input.password.length > 200) {
    throw new AppError("PASSWORD", "Password is too long.");
  }

  const displayName = input.displayName.trim().slice(0, 80);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("EMAIL", "An account with that email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          displayName,
          isAdultConfirmed: true,
          claimsGymMembership: Boolean(input.claimsGymMembership),
          gymMembershipVerified: false,
        },
      },
    },
  });

  await prisma.pilotInvite
    .updateMany({
      where: { email, status: "invited" },
      data: { status: "joined", joinedAt: new Date() },
    })
    .catch(() => undefined);

  return toPublicUser(user);
}

export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) {
    throw new AuthError("Email or password is incorrect.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new AuthError("Email or password is incorrect.");
  }
  return toPublicUser(user);
}

export async function createSessionRecord(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = newRawToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function getUserBySessionToken(
  rawToken: string | undefined | null,
): Promise<PublicUser | null> {
  if (!rawToken) {
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { token: hashToken(rawToken) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  return toPublicUser(session.user);
}

export async function destroySession(rawToken: string | undefined | null) {
  if (!rawToken) {
    return;
  }
  await prisma.session
    .deleteMany({ where: { token: hashToken(rawToken) } })
    .catch(() => {});
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AuthError("Not signed in.");
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AuthError("Current password is incorrect.");
  }
  if (nextPassword.length < 8) {
    throw new AppError("PASSWORD", "New password must be at least 8 characters.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(nextPassword) },
  });
  await prisma.session.deleteMany({ where: { userId } });
}

export async function requestPasswordReset(email: string): Promise<{
  resetUrl: string | null;
  emailed: boolean;
}> {
  const normalized = normalizeEmail(email);
  await assertPasswordResetRateLimit("email", normalized || "blank");
  await sweepLegacyPasswordResetTokens().catch(() => 0);

  const neutral = { resetUrl: null, emailed: false };
  const user = normalized
    ? await prisma.user.findUnique({ where: { email: normalized } })
    : null;
  const devPreview = devResetPreviewEnabled();
  const canEmail = canEmailPasswordReset();
  if (!user || (!canEmail && !devPreview)) {
    return neutral;
  }

  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000);
  const tokenHash = hashResetToken(rawToken);
  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
      generation: PASSWORD_RESET_GENERATION,
    },
  });

  const appUrl = publicAppUrl();
  const resetUrl = appUrl ? `${appUrl}/reset-password?token=${rawToken}` : null;
  if (!resetUrl) {
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    return neutral;
  }

  if (canEmail) {
    const mailed = await sendMail({
      to: user.email,
      subject: "Reset your SVG Performance password",
      text: [
        "We received a request to reset your SVG Performance password.",
        "",
        `Reset link (expires in 1 hour): ${resetUrl}`,
        "",
        "If you didn't ask for this, you can ignore this email.",
      ].join("\n"),
    });
    if (!mailed.sent) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    }
    // Never return the link once email is the delivery path.
    return { resetUrl: null, emailed: mailed.sent };
  }

  if (devPreview) {
    return { resetUrl, emailed: false };
  }

  await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
  return neutral;
}

export async function resetPasswordWithToken(
  rawToken: string,
  nextPassword: string,
) {
  if (nextPassword.length < 8) {
    throw new AppError("PASSWORD", "Password must be at least 8 characters.");
  }
  await sweepLegacyPasswordResetTokens().catch(() => 0);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
  });
  if (
    !record ||
    record.generation !== PASSWORD_RESET_GENERATION ||
    record.usedAt ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new AuthError("This reset link is invalid or has expired.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(nextPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
