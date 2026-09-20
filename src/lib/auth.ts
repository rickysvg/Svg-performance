import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthError, AppError } from "@/lib/errors";
import { SESSION_DAYS } from "@/lib/constants";

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

export type PublicUser = {
  id: string;
  email: string;
};

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

  return { id: user.id, email: user.email };
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
  return { id: user.id, email: user.email };
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
  return { id: session.user.id, email: session.user.email };
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
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) {
    return { resetUrl: null, emailed: false };
  }

  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId: user.id,
      expiresAt,
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  if (process.env.SMTP_HOST) {
    // SMTP is a later wiring step. Preview shows the link instead.
    return { resetUrl: null, emailed: true };
  }

  return { resetUrl, emailed: false };
}

export async function resetPasswordWithToken(
  rawToken: string,
  nextPassword: string,
) {
  if (nextPassword.length < 8) {
    throw new AppError("PASSWORD", "Password must be at least 8 characters.");
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (
    !record ||
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
