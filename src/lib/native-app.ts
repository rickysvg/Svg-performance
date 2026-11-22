/**
 * The SVG Performance store apps (Capacitor shell in /mobile) load this site in a
 * native web view. This module detects that shell and calls its native plugins.
 *
 * On the plain website every helper here is a no-op: no Capacitor global exists,
 * and the user agent has no SVGPerformanceApp marker.
 */

export type NativePlatform = "ios" | "android";

/** mobile/capacitor.config.json appends this to the web view user agent. */
export const NATIVE_APP_UA_MARKER = "SVGPerformanceApp/";

const UA_PATTERN = /SVGPerformanceApp\/[^\s]+ \((ios|android)\)/;

export function nativePlatformFromUserAgent(userAgent: string | null | undefined): NativePlatform | null {
  if (!userAgent) return null;
  const match = UA_PATTERN.exec(userAgent);
  return match ? (match[1] as NativePlatform) : null;
}

/**
 * Store rules: digital subscriptions sold inside the iOS app must use Apple
 * In-App Purchase, and Google Play requires Play Billing unless the developer
 * enrolls in its external-offers program. Until store billing ships, the store
 * apps never open Stripe Checkout or the Stripe billing portal.
 */
export function storeBillingBlocksWebCheckout(platform: NativePlatform | null): boolean {
  return platform !== null;
}

export const STORE_APP_BILLING_NOTE = "Subscriptions aren't available in the app yet. Your current plan works here as usual.";

/** Paths that only exist to sell a subscription. The store apps redirect these. */
export const STORE_APP_BILLING_REDIRECTS: Record<string, string> = {
  "/pricing": "/plan",
  "/vip/checkout": "/vip",
};

type NativeCall = (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>;

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: NativeCall;
  Plugins?: Record<string, { addListener?: (event: string, cb: (data: unknown) => void) => unknown } | undefined>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return cap?.isNativePlatform?.() ? cap : null;
  } catch {
    return null;
  }
}

export function nativePlatform(): NativePlatform | null {
  const cap = capacitor();
  const fromCap = cap?.getPlatform?.();
  if (fromCap === "ios" || fromCap === "android") return fromCap;
  if (typeof navigator === "undefined") return null;
  return nativePlatformFromUserAgent(navigator.userAgent);
}

export function isNativeApp(): boolean {
  return nativePlatform() !== null;
}

function nativeCall(plugin: string, method: string, options?: Record<string, unknown>): boolean {
  const cap = capacitor();
  if (!cap?.nativePromise) return false;
  if (cap.isPluginAvailable && !cap.isPluginAvailable(plugin)) return false;
  try {
    void cap.nativePromise(plugin, method, options).catch(() => {
      /* a missing native plugin must never break the page */
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Plays a navigator.vibrate-style pattern ([on, off, on, ...] in ms) through the
 * native Haptics plugin. Returns false on the website so callers fall back.
 * iPhone has no timed vibration, so each pulse is an impact sized by length.
 */
export function nativeVibrate(pattern: number | readonly number[]): boolean {
  const cap = capacitor();
  if (!cap) return false;
  const platform = nativePlatform();
  const steps = typeof pattern === "number" ? [pattern] : [...pattern];
  let at = 0;
  let sent = false;
  steps.forEach((ms, index) => {
    const duration = Math.max(0, Math.round(ms));
    if (index % 2 === 0 && duration > 0) {
      const fire = () =>
        platform === "ios"
          ? nativeCall("Haptics", "impact", { style: duration >= 200 ? "HEAVY" : duration >= 60 ? "MEDIUM" : "LIGHT" })
          : nativeCall("Haptics", "vibrate", { duration });
      if (at === 0) sent = fire() || sent;
      else {
        window.setTimeout(fire, at);
        sent = true;
      }
    }
    at += duration;
  });
  return sent;
}

/** A single tap of feedback, e.g. when a set is checked off. No-op on the web. */
export function nativeImpact(style: "LIGHT" | "MEDIUM" | "HEAVY" = "MEDIUM"): boolean {
  if (!capacitor()) return false;
  return nativeCall("Haptics", "impact", { style });
}

/** The app's own https links (universal links / App Links) arrive here. */
export function appPathFromOpenedUrl(url: string, host = "svgperformance.app"): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== host && parsed.hostname !== `www.${host}`) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return null;
  }
}

/** Subscribe to a native plugin event. Returns an unsubscribe function. */
export function onNativeEvent(plugin: string, event: string, callback: (data: unknown) => void): () => void {
  const target = capacitor()?.Plugins?.[plugin];
  if (!target?.addListener) return () => {};
  let handle: unknown;
  try {
    handle = target.addListener(event, callback);
  } catch {
    return () => {};
  }
  return () => {
    void Promise.resolve(handle)
      .then((h) => (h as { remove?: () => unknown } | undefined)?.remove?.())
      .catch(() => {});
  };
}

/** Apple Team ID + bundle ID for universal links, from env. Null until set. */
export function appleAppSiteAssociation(teamId: string | undefined, bundleId = "app.svgperformance") {
  const team = teamId?.trim();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${bundleId}`],
          components: [{ "/": "/*", comment: "Every svgperformance.app page opens in the app." }],
        },
      ],
    },
    webcredentials: { apps: [`${team}.${bundleId}`] },
  };
}

/** Android App Links statement, from comma-separated SHA-256 cert fingerprints. */
export function androidAssetLinks(fingerprints: string | undefined, packageName = "app.svgperformance") {
  const list = (fingerprints ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  if (!list.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: list },
    },
  ];
}
