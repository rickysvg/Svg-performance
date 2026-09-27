"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  authenticate,
  changePassword,
  createSessionRecord,
  destroySession,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth";
import { publicErrorMessage } from "@/lib/errors";
import { assertPasswordResetRateLimit } from "@/lib/password-reset-rate";
import {
  clearSessionCookie,
  postAuthPath,
  readSessionToken,
  requireUserOrThrow,
  setSessionCookie,
} from "@/lib/session";

export type ActionState = { error?: string; success?: string; resetUrl?: string };

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let nextPath = "/onboarding";
  try {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (password !== confirm) {
      return { error: "Passwords do not match." };
    }
    const user = await registerAccount({
      email: String(formData.get("email") ?? ""),
      password,
      displayName: String(formData.get("displayName") ?? ""),
      isAdultConfirmed: formData.get("isAdultConfirmed") === "on",
      claimsGymMembership: formData.get("claimsGymMembership") === "on",
    });
    const session = await createSessionRecord(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    nextPath = await postAuthPath(user.id);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(nextPath);
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let nextPath = "/home";
  try {
    const user = await authenticate(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
    const session = await createSessionRecord(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    nextPath = await postAuthPath(user.id);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(nextPath);
}

export async function logoutAction() {
  await destroySession(await readSessionToken());
  await clearSessionCookie();
  redirect("/");
}

async function resetClientAddress(): Promise<string> {
  try {
    const incoming = await headers();
    const forwarded = incoming.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
    return incoming.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertPasswordResetRateLimit("ip", await resetClientAddress());
    const result = await requestPasswordReset(String(formData.get("email") ?? ""));
    // The link is returned only from local development. Production builds
    // never include it, and this branch is dead when NODE_ENV is production.
    if (process.env.NODE_ENV !== "production" && result.resetUrl) {
      return {
        success:
          "Development only: email is not configured, so this one-time link is shown here. It is never shown in production.",
        resetUrl: result.resetUrl,
      };
    }
    return { success: PASSWORD_RESET_NEUTRAL_MESSAGE };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (password !== confirm) {
      return { error: "Passwords do not match." };
    }
    await resetPasswordWithToken(String(formData.get("token") ?? ""), password);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/login?reset=1");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUserOrThrow();
    const next = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");
    if (next !== confirm) {
      return { error: "New passwords do not match." };
    }
    await changePassword(
      user.id,
      String(formData.get("currentPassword") ?? ""),
      next,
    );
    await clearSessionCookie();
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/login?changed=1");
}
