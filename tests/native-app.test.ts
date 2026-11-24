import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  androidAssetLinks,
  appleAppSiteAssociation,
  appPathFromOpenedUrl,
  isNativeApp,
  nativeImpact,
  nativePlatformFromUserAgent,
  nativeVibrate,
  storeAppPurchaseSurface,
  storeBillingBlocksWebCheckout,
} from "@/lib/native-app";
import { proxy } from "@/proxy";

const IOS_APP_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SVGPerformanceApp/1 (ios)";
const ANDROID_APP_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 SVGPerformanceApp/1 (android)";
const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type FakeCall = { plugin: string; method: string; options?: Record<string, unknown> };

function installCapacitor(platform: "ios" | "android") {
  const calls: FakeCall[] = [];
  const cap = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
    isPluginAvailable: (name: string) => name === "Haptics" || name === "App",
    nativePromise: (plugin: string, method: string, options?: Record<string, unknown>) => {
      calls.push({ plugin, method, options });
      return Promise.resolve();
    },
  };
  vi.stubGlobal("window", { Capacitor: cap, setTimeout: (fn: () => void) => fn() });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("store app detection", () => {
  it("reads the platform from the app user agent marker only", () => {
    expect(nativePlatformFromUserAgent(IOS_APP_UA)).toBe("ios");
    expect(nativePlatformFromUserAgent(ANDROID_APP_UA)).toBe("android");
    expect(nativePlatformFromUserAgent(SAFARI_UA)).toBeNull();
    expect(nativePlatformFromUserAgent("")).toBeNull();
    expect(nativePlatformFromUserAgent(null)).toBeNull();
  });

  it("blocks Stripe checkout only inside the store apps", () => {
    expect(storeBillingBlocksWebCheckout("ios")).toBe(true);
    expect(storeBillingBlocksWebCheckout("android")).toBe(true);
    expect(storeBillingBlocksWebCheckout(null)).toBe(false);
  });

  it("offers the native Pro paywall and hides VIP inside the store apps", () => {
    expect(storeAppPurchaseSurface("performance_monthly")).toBe("pro");
    expect(storeAppPurchaseSurface("performance_year")).toBe("pro");
    expect(storeAppPurchaseSurface("coaching_monthly")).toBe("hidden");
    expect(storeAppPurchaseSurface("coaching")).toBe("hidden");
  });

  it("is a no-op on the website", () => {
    expect(isNativeApp()).toBe(false);
    expect(nativeVibrate([200, 100, 200])).toBe(false);
    expect(nativeImpact()).toBe(false);
  });
});

describe("native haptics", () => {
  it("sends timed vibrations on Android", () => {
    const calls = installCapacitor("android");
    expect(nativeVibrate([220, 90, 380])).toBe(true);
    expect(calls).toEqual([
      { plugin: "Haptics", method: "vibrate", options: { duration: 220 } },
      { plugin: "Haptics", method: "vibrate", options: { duration: 380 } },
    ]);
  });

  it("maps pulses to impacts on iPhone", () => {
    const calls = installCapacitor("ios");
    expect(nativeVibrate([80])).toBe(true);
    expect(nativeImpact("LIGHT")).toBe(true);
    expect(calls).toEqual([
      { plugin: "Haptics", method: "impact", options: { style: "MEDIUM" } },
      { plugin: "Haptics", method: "impact", options: { style: "LIGHT" } },
    ]);
  });
});

describe("deep links", () => {
  it("keeps our own https links and drops others", () => {
    expect(appPathFromOpenedUrl("https://svgperformance.app/training?x=1#s")).toBe("/training?x=1#s");
    expect(appPathFromOpenedUrl("https://www.svgperformance.app/home")).toBe("/home");
    expect(appPathFromOpenedUrl("https://evil.example/home")).toBeNull();
    expect(appPathFromOpenedUrl("http://svgperformance.app/home")).toBeNull();
    expect(appPathFromOpenedUrl("not a url")).toBeNull();
  });

  it("serves association files only with valid config", () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull();
    expect(appleAppSiteAssociation("bad")).toBeNull();
    expect(appleAppSiteAssociation("ABCDE12345")?.applinks.details[0].appIDs).toEqual([
      "ABCDE12345.app.svgperformance",
    ]);
    const fp = Array.from({ length: 32 }, () => "AB").join(":");
    expect(androidAssetLinks(undefined)).toBeNull();
    expect(androidAssetLinks("nope")).toBeNull();
    expect(androidAssetLinks(`${fp.toLowerCase()}, junk`)?.[0].target.sha256_cert_fingerprints).toEqual([fp]);
  });
});

describe("proxy store-app billing redirect", () => {
  const req = (path: string, ua: string) =>
    new NextRequest(new URL(path, "https://svgperformance.app"), { headers: { "user-agent": ua } });

  it("sends the store apps from /pricing to /plan", () => {
    const res = proxy(req("/pricing", IOS_APP_UA));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://svgperformance.app/plan");
    expect(proxy(req("/pricing", ANDROID_APP_UA)).headers.get("location")).toBe(
      "https://svgperformance.app/plan",
    );
  });

  it("leaves /pricing alone on the website", () => {
    const res = proxy(req("/pricing", SAFARI_UA));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
