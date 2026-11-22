"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { appPathFromOpenedUrl, nativePlatform, onNativeEvent } from "@/lib/native-app";

/**
 * Runs only inside the SVG Performance store app. On the website nativePlatform()
 * is null and this renders nothing and does nothing.
 *
 * - Tags <html data-native-app="ios|android"> for app-only styling.
 * - Opens svgperformance.app universal links / App Links at the right page.
 */
export function NativeAppBridge() {
  const router = useRouter();
  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    document.documentElement.dataset.nativeApp = platform;
    const stop = onNativeEvent("App", "appUrlOpen", (data) => {
      const url = (data as { url?: unknown } | null)?.url;
      if (typeof url !== "string") return;
      const path = appPathFromOpenedUrl(url);
      if (!path) return;
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (path !== here) router.push(path);
    });
    return stop;
  }, [router]);
  return null;
}
