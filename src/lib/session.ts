import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/constants";
import { getUserBySessionToken, type PublicUser } from "@/lib/auth";
import { AuthError } from "@/lib/errors";
import { getOnboardingStatus, memberEntryPath } from "@/lib/onboarding";

export async function readSessionToken() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  return getUserBySessionToken(await readSessionToken());
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    return null;
  }
  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password")) {
    return null;
  }
  return path;
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    let next = "";
    try {
      const path = safeNextPath((await headers()).get("x-svg-path"));
      if (path) next = `?next=${encodeURIComponent(path)}`;
    } catch {
      next = "";
    }
    redirect(`/login${next}`);
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
