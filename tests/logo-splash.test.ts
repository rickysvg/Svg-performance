import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPLASH_STORAGE_KEY,
  shouldSkipSplash,
  splashTimings,
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

describe("app-open splash", () => {
  it("skips only after the session flag is set", () => {
    expect(SPLASH_STORAGE_KEY).toBe("svg_splash_seen");
    expect(shouldSkipSplash(null)).toBe(false);
    expect(shouldSkipSplash("0")).toBe(false);
    expect(shouldSkipSplash("1")).toBe(true);
  });

  it("holds long enough for the animation, and shortens for reduced motion", () => {
    const full = splashTimings(false);
    const reduced = splashTimings(true);
    expect(full.holdMs).toBeGreaterThanOrEqual(1200);
    expect(full.exitMs).toBeGreaterThan(200);
    expect(reduced.holdMs + reduced.exitMs).toBeLessThan(800);
  });

  it("mounts from the root layout and respects reduced motion in CSS", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/AppSplash/);
    expect(layout).toMatch(/svg_splash_seen/);
    const css = read("src/app/globals.css");
    expect(css).toMatch(/\.app-splash/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/svg-splash-fade-out/);
    expect(css).toMatch(/--background:\s*#ffffff/);
    expect(css).toMatch(/--accent:\s*#cbf805/);
  });
});
