import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPLASH_STILL_SRC,
  SPLASH_STORAGE_KEY,
  SPLASH_VIDEO_MS,
  SPLASH_VIDEO_SRC,
  canDismissSplash,
  isAutoplayBlocked,
  playSplashWithSound,
  shouldSkipSplash,
  splashTimings,
  waitForSplashCanPlay,
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

  it("tries sound first and falls back to muted autoplay without waiting for a tap", async () => {
    expect(isAutoplayBlocked({ name: "NotAllowedError" })).toBe(true);
    expect(isAutoplayBlocked({ name: "NotFoundError" })).toBe(false);

    const blocked = {
      muted: false,
      defaultMuted: false,
      volume: 0.2,
      async play() {
        if (!this.muted) {
          const error = new Error("blocked");
          error.name = "NotAllowedError";
          throw error;
        }
      },
    };
    await expect(playSplashWithSound(blocked)).resolves.toBe("muted");
    expect(blocked.muted).toBe(true);
    expect(blocked.volume).toBe(1);

    const allowed = {
      muted: true,
      defaultMuted: true,
      volume: 0.2,
      play: async () => undefined,
    };
    await expect(playSplashWithSound(allowed)).resolves.toBe("sound");
    expect(allowed.muted).toBe(false);
    expect(allowed.volume).toBe(1);
  });

  it("waits until the clip can play before starting", async () => {
    const listeners = new Map<string, () => void>();
    const video = {
      readyState: 1,
      addEventListener(type: string, fn: () => void) {
        listeners.set(type, fn);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
    };
    const pending = waitForSplashCanPlay(video);
    listeners.get("canplay")?.();
    await expect(pending).resolves.toBeUndefined();
  });

  it("mounts a video splash from the root layout, not the old CSS ring", () => {
    const splash = read("src/components/AppSplash.tsx");
    expect(splash).toMatch(/<video/);
    expect(splash).toMatch(/playSplashWithSound/);
    expect(splash).toMatch(/waitForSplashCanPlay/);
    expect(splash).not.toMatch(/Tap for sound/);
    expect(splash).not.toMatch(/app-splash-glow/);
    expect(read("src/app/layout.tsx")).toMatch(/AppSplash/);
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.app-splash-video/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/svg-splash-glow/);
    expect(css).toMatch(/--background:\s*#ffffff/);
    expect(css).toMatch(/--accent:\s*#cbf805/);
  });
});
