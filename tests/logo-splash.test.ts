import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPLASH_STILL_SRC,
  SPLASH_STORAGE_KEY,
  SPLASH_VIDEO_MS,
  SPLASH_VIDEO_SRC,
  canDismissSplash,
  prepareSplashVideo,
  shouldSkipSplash,
  splashTimings,
  startSplashPlayback,
} from "@/lib/splash";

const root = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fileSize(rel: string) {
  return fs.statSync(path.join(root, rel)).size;
}

describe("official circular badge", () => {
  it("points Logo at the official badge, not the old mountain-only mark", () => {
    const logo = read("src/components/Logo.tsx");
    expect(logo).toMatch(/LOGO_BADGE_SRC = "\/svg-performance-badge\.webp"/);
    expect(logo).toMatch(/LOGO_MARK_SRC = "\/svg-performance-badge-mark\.png"/);
    expect(logo).not.toMatch(/svg-performance-mark\.png/);
    expect(logo).not.toMatch(/svg-performance-lockup\.png/);
    expect(logo).not.toMatch(/logo-mark\.svg/);
  });

  it("commits optimized badge files and a derived favicon", () => {
    expect(fileSize("public/svg-performance-badge.webp")).toBeGreaterThan(40_000);
    expect(fileSize("public/svg-performance-badge.webp")).toBeLessThan(400_000);
    expect(fileSize("public/svg-performance-badge-mark.png")).toBeGreaterThan(20_000);
    expect(fileSize("src/app/icon.png")).toBeGreaterThan(8_000);
  });

  it("uses the badge on the landing hero and the mark in account chrome", () => {
    expect(read("src/app/page.tsx")).toMatch(/variant="badge"/);
    expect(read("src/components/AppHeader.tsx")).toMatch(/variant="mark"/);
    expect(read("src/components/AppHeader.tsx")).not.toMatch(/bg-black/);
  });
});

describe("app-open splash video", () => {
  it("skips only after the session flag is set", () => {
    expect(SPLASH_STORAGE_KEY).toBe("svg_splash_seen");
    expect(shouldSkipSplash(null)).toBe(false);
    expect(shouldSkipSplash("0")).toBe(false);
    expect(shouldSkipSplash("1")).toBe(true);
  });

  it("uses the trimmed ring-close clip, not the full 10s source", () => {
    expect(SPLASH_VIDEO_SRC).toBe("/svg-performance-splash.mp4");
    expect(SPLASH_STILL_SRC).toBe("/svg-performance-splash-still.webp");
    expect(SPLASH_VIDEO_MS).toBeGreaterThanOrEqual(7_500);
    expect(SPLASH_VIDEO_MS).toBeLessThan(9_000);
    expect(fileSize("public/svg-performance-splash.mp4")).toBeGreaterThan(200_000);
    expect(fileSize("public/svg-performance-splash.mp4")).toBeLessThan(2_500_000);
    expect(fileSize("public/svg-performance-splash-still.webp")).toBeGreaterThan(8_000);
  });

  it("holds for the trimmed clip, and shortens for reduced motion", () => {
    const full = splashTimings(false);
    const reduced = splashTimings(true);
    expect(full.holdMs).toBe(SPLASH_VIDEO_MS);
    expect(full.holdMs).toBeLessThan(9_000);
    expect(reduced.holdMs + reduced.exitMs).toBeLessThan(800);
  });

  it("waits for the clip to finish unless reduced motion", () => {
    expect(
      canDismissSplash({ videoFinished: false, appReady: true, reducedMotion: false }),
    ).toBe(false);
    expect(
      canDismissSplash({ videoFinished: true, appReady: true, reducedMotion: false }),
    ).toBe(true);
    expect(
      canDismissSplash({ videoFinished: false, appReady: true, reducedMotion: true }),
    ).toBe(true);
  });

  it("starts muted so autoplay is allowed, and retries after the file is ready", async () => {
    const attrs = new Map<string, string>();
    const video = {
      muted: false,
      defaultMuted: false,
      playsInline: false,
      readyState: 1,
      playCount: 0,
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      addEventListener() {},
      removeEventListener() {},
      async play() {
        this.playCount += 1;
        if (!this.muted) throw new Error("unmuted blocked");
      },
    };
    prepareSplashVideo(video);
    expect(video.muted).toBe(true);
    expect(attrs.get("muted")).toBe("");
    expect(attrs.get("playsinline")).toBe("");

    video.readyState = 4;
    await expect(startSplashPlayback(video)).resolves.toBe("playing");
    expect(video.muted).toBe(true);
    expect(video.playCount).toBe(1);
  });

  it("retries play after loadeddata when the first call is early", async () => {
    const listeners = new Map<string, () => void>();
    let attempts = 0;
    const video = {
      muted: true,
      defaultMuted: true,
      playsInline: true,
      readyState: 1,
      setAttribute() {},
      addEventListener(type: string, fn: () => void) {
        listeners.set(type, fn);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
      async play() {
        attempts += 1;
        if (attempts === 1) throw new Error("not ready");
      },
    };
    const pending = startSplashPlayback(video);
    queueMicrotask(() => {
      video.readyState = 4;
      listeners.get("loadeddata")?.();
    });
    await expect(pending).resolves.toBe("playing");
    expect(attempts).toBe(2);
  });

  it("mounts a muted autoplay video with a seamless black field", () => {
    const splash = read("src/components/AppSplash.tsx");
    expect(splash).toMatch(/<video/);
    expect(splash).toMatch(/startSplashPlayback/);
    expect(splash).toMatch(/\bmuted\b/);
    expect(splash).toMatch(/autoPlay/);
    expect(splash).not.toMatch(/poster=/);
    expect(splash).not.toMatch(/playSplashWithSound/);
    expect(splash).not.toMatch(/Tap for sound/);
    expect(read("src/app/layout.tsx")).toMatch(/AppSplash/);
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.app-splash-video/);
    expect(css).toMatch(/background:\s*#000/);
    expect(css).toMatch(/scale\(1\.08\)/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/--background:\s*#ffffff/);
    expect(css).toMatch(/--accent:\s*#cbf805/);
  });
});
