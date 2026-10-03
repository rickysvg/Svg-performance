import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";
import { getUserBySessionToken, hashToken, type PublicUser } from "@/lib/auth";
import { AuthError } from "@/lib/errors";
import { getOnboardingStatus, memberEntryPath } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export async function readSessionToken() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  return getUserBySessionToken(await readSessionToken());
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireUserOrThrow(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Sign in to continue.");
  }
  return user;
}

export async function requireOnboardedUser(): Promise<PublicUser> {
  const user = await requireUser();
  const status = await getOnboardingStatus(user.id);
  if (!status.completed) {
    redirect("/onboarding");
  }
  if (!status.planChoiceAt) {
    redirect("/onboarding/plan");
  }
  return user;
}

export async function postAuthPath(userId: string) {
  const status = await getOnboardingStatus(userId);
  return memberEntryPath(status.completedAt, status.planChoiceAt);
}

/**
 * Slide a still-valid login forward. An expired row is left alone so a dead
 * session is not revived without a password. Called while a workout is open
 * so the member is not sent to login between sets.
 */
export async function extendSessionExpiry(rawToken: string | null | undefined): Promise<Date | null> {
  if (!rawToken) return null;
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const updated = await prisma.session.updateMany({
    where: { token: hashToken(rawToken), expiresAt: { gt: new Date() } },
    data: { expiresAt },
  });
  if (updated.count === 0) return null;
  return expiresAt;
}

export async function extendActiveSession() {
  const token = await readSessionToken();
  const expiresAt = await extendSessionExpiry(token);
  if (token && expiresAt) {
    await setSessionCookie(token, expiresAt);
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
