"use server";

import { redirect } from "next/navigation";
import {
  authenticate,
  changePassword,
  createSessionRecord,
  destroySession,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth";
import { publicErrorMessage } from "@/lib/errors";
import {
  clearSessionCookie,
  readSessionToken,
  requireUserOrThrow,
  setSessionCookie,
} from "@/lib/session";

export type ActionState = { error?: string; success?: string; resetUrl?: string };

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
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
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/home");
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await authenticate(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
    const session = await createSessionRecord(user.id);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/home");
}

export async function logoutAction() {
  await destroySession(await readSessionToken());
  await clearSessionCookie();
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const result = await requestPasswordReset(String(formData.get("email") ?? ""));
    if (result.resetUrl) {
      return {
        success:
          "Preview mode: email sending is not wired. Use this one-time reset link.",
        resetUrl: result.resetUrl,
      };
    }
    return {
      success:
        "If that email is on file, a reset link was created. Check email if SMTP is configured.",
    };
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
