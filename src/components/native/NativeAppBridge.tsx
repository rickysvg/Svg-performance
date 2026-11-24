"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appPathFromOpenedUrl, nativePlatform, onNativeEvent } from "@/lib/native-app";
import { configurePurchases, logOutPurchases } from "@/lib/native-purchases";
import {
  deleteRememberedNativeToken,
  nativePushRegisterAllowed,
  registerStoredNativeToken,
} from "@/lib/native-push-client";

/**
 * Runs only inside the SVG Performance store app. On the website nativePlatform()
 * is null and this renders nothing and does nothing.
 *
 * - Tags <html data-native-app="ios|android"> for app-only styling.
 * - Opens svgperformance.app universal links / App Links at the right page.
 * - Configures RevenueCat once a session exists, and logs the store user out when the session ends.
 * - Saves a push token after the member turns reminders on. It does not ask on launch.
 */
export function NativeAppBridge() {
  const router = useRouter();
  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    document.documentElement.dataset.nativeApp = platform;
    let userId: string | null = null;
    let cancelled = false;

    const stopUrl = onNativeEvent("App", "appUrlOpen", (data) => {
      const url = (data as { url?: unknown } | null)?.url;
      if (typeof url !== "string") return;
      const path = appPathFromOpenedUrl(url);
      if (!path) return;
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (path !== here) router.push(path);
    });

    const stopRegistration = onNativeEvent("PushNotifications", "registration", (data) => {
      const token = (data as { value?: unknown } | null)?.value;
      if (typeof token !== "string" || !token || !nativePushRegisterAllowed(platform)) return;
      void registerStoredNativeToken({ platform, token });
    });
    const stopRegistrationError = onNativeEvent("PushNotifications", "registrationError", () => {
      console.warn("[push] registration failed");
    });
    const stopAction = onNativeEvent("PushNotifications", "pushNotificationActionPerformed", (data) => {
      const url = (data as { notification?: { data?: { url?: unknown } } } | null)?.notification?.data?.url;
      if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return;
      router.push(url);
    });

    async function syncSession() {
      try {
        const response = await fetch("/api/me");
        if (!response.ok) return;
        const body = (await response.json()) as { id?: unknown };
        const nextId = typeof body.id === "string" && body.id ? body.id : null;
        if (cancelled) return;
        if (nextId && nextId !== userId) {
          userId = nextId;
          await configurePurchases(nextId).catch(() => undefined);
        } else if (!nextId && userId) {
          userId = null;
          await deleteRememberedNativeToken();
          await logOutPurchases();
        }
      } catch {
        /* the website has no native session to configure */
      }
    }

    void syncSession();
    const poll = window.setInterval(() => void syncSession(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      stopUrl();
      stopRegistration();
      stopRegistrationError();
      stopAction();
    };
  }, [router]);
  return null;
}
