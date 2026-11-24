"use client";

import { nativeInvoke, nativePlatform, nativePushReady, type NativePlatform } from "@/lib/native-app";

const TOKEN_KEY = "svg_native_push_token";

export function nativePushRegisterAllowed(platform: NativePlatform | null = nativePlatform()) {
  if (process.env.NEXT_PUBLIC_NATIVE_PUSH_ENABLED !== "1" || !platform) return false;
  if (platform === "ios") return process.env.NEXT_PUBLIC_NATIVE_PUSH_IOS !== "0";
  if (process.env.NEXT_PUBLIC_NATIVE_PUSH_ANDROID === "1") return true;
  return nativePushReady();
}

export function rememberNativePushToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

export function rememberedNativePushToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function registerStoredNativeToken(input: {
  platform: NativePlatform;
  token: string;
}) {
  rememberNativePushToken(input.token);
  const response = await fetch("/api/push/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: input.platform,
      token: input.token,
      appVersion: "1.0",
      environment: "production",
    }),
  });
  return response.ok;
}

export async function deleteRememberedNativeToken() {
  const token = rememberedNativePushToken();
  if (!token) return;
  rememberNativePushToken("");
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  await fetch("/api/push/native", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
}

type PermissionStatus = { receive?: string };

/** Asks only after a tap. Never call this on launch. */
export async function enableNativeReminders() {
  const platform = nativePlatform();
  if (!nativePushRegisterAllowed(platform)) {
    return { ok: false, message: "Phone reminders aren't set up on this build yet." };
  }
  const current = await nativeInvoke<PermissionStatus>("PushNotifications", "checkPermissions");
  let receive = current?.receive ?? "prompt";
  if (receive !== "granted") {
    const next = await nativeInvoke<PermissionStatus>("PushNotifications", "requestPermissions");
    receive = next?.receive ?? "denied";
  }
  if (receive !== "granted") {
    return { ok: false, message: "Notifications stay off until you allow them in system settings." };
  }
  const registered = await nativeInvoke("PushNotifications", "register");
  if (registered === null && current === null) {
    return { ok: false, message: "This build can't register for notifications yet." };
  }
  return { ok: true, message: "Reminders are on for this phone." };
}
