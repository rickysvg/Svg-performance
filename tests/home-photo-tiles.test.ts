import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sparringTileHint } from "@/lib/sparring-tile";

const TILES = [
  "train.webp",
  "mobility.webp",
  "coach.webp",
  "form-check.webp",
  "learn.webp",
  "progress.webp",
  "fuel.webp",
  "calendar.webp",
  "timer.webp",
  "sparring.webp",
] as const;

const APPROVED_HASHES = {
  "fuel.webp": "7b66ecfcfe8af7d3f0940d5734fc02e4d4dc54115473004d21ce795b564e6a77",
  "calendar.webp": "8ef105723a9600d8b898c9cb4554fbbb03baf7fbb3f3e23e78c62c506547d1b5",
} as const;

describe("Home photo tiles", () => {
  it("ships ~800px WebP academy photos for the Home tiles", () => {
    for (const name of TILES) {
      const file = path.join(process.cwd(), "public/tiles", name);
      expect(fs.existsSync(file), file).toBe(true);
      const bytes = fs.readFileSync(file);
      expect(bytes[0]).toBe(0x52);
      expect(bytes[1]).toBe(0x49);
      expect(bytes[2]).toBe(0x46);
      expect(bytes[8]).toBe(0x57);
      expect(bytes[9]).toBe(0x45);
      expect(bytes[10]).toBe(0x42);
      expect(bytes[11]).toBe(0x50);
      expect(bytes.length).toBeGreaterThan(8_000);
      expect(bytes.length).toBeLessThan(250_000);
      expect(fs.existsSync(path.join(process.cwd(), "public/tiles", name.replace(".webp", ".jpg")))).toBe(
        false,
      );
      expect(fs.existsSync(path.join(process.cwd(), "public/home/tiles", name))).toBe(false);
      const expected = APPROVED_HASHES[name as keyof typeof APPROVED_HASHES];
      if (expected) {
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
      }
    }
  });

  it("keeps the Home grid even, with Sparring Log beside Timer", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/HomeQuickActions.tsx"),
      "utf8",
    );
    expect(source).toContain('from "next/image"');
    expect(source).toContain("<Image");
    expect(source).toContain('sizes="(max-width: 390px) 50vw, (max-width: 640px) 45vw, 320px"');
    expect(source).toContain("min-w-0");
    expect(source).toContain("aspect-[4/3]");
    expect(source).not.toContain("min-h-[9.5rem]");
    expect(source).not.toContain("TEXT_ACTIONS");
    expect(source).not.toContain("min-h-[5.5rem]");
    expect(source).not.toContain("label.slice(0, 1)");
    expect(source.indexOf('href: "/training"')).toBeLessThan(source.indexOf('href: "/mobility"'));
    expect(source.indexOf('href: "/mobility"')).toBeLessThan(source.indexOf('href: "/coach"'));
    expect(source.indexOf('href: "/training"')).toBeLessThan(source.indexOf('href: "/coach"'));
    expect(source.indexOf('href: "/coach"')).toBeLessThan(source.indexOf('href: "/form-check"'));
    expect(source.indexOf('href: "/form-check"')).toBeLessThan(source.indexOf('href: "/learn"'));
    expect(source.indexOf('href: "/coach"')).toBeLessThan(source.indexOf('href: "/learn"'));
    expect(source.indexOf('href: "/learn"')).toBeLessThan(source.indexOf('href: "/progress"'));
    expect(source.indexOf('href: "/progress"')).toBeLessThan(source.indexOf('href: "/nutrition"'));
    expect(source.indexOf('href: "/nutrition"')).toBeLessThan(
      source.indexOf('href: "/training/calendar"'),
    );
    expect(source.indexOf('href: "/training/calendar"')).toBeLessThan(source.indexOf('href: "/timer"'));
    expect(source.indexOf('href: "/timer"')).toBeLessThan(source.indexOf("<SparringLogTile"));
    expect(source).toContain("grid-cols-2");
    const tile = fs.readFileSync(path.join(process.cwd(), "src/components/home/SparringLogTile.tsx"), "utf8");
    expect(tile).toContain('href="/sparring"');
    expect(tile).toContain("Sparring Log");
    expect(tile).toContain("/tiles/sparring.webp");
    expect(tile).toContain("aspect-[4/3]");
    expect(tile).toContain("from-black/85 via-black/25");
    expect(tile).toContain("bg-accent");
    expect(tile).toContain("px-3 pb-3 pt-8");
    expect(tile).not.toContain("<svg");
    const home = fs.readFileSync(path.join(process.cwd(), "src/app/(member)/home/page.tsx"), "utf8");
    const train = fs.readFileSync(path.join(process.cwd(), "src/app/(member)/training/page.tsx"), "utf8");
    expect(home).not.toContain("Log sparring");
    expect(train).not.toContain("Log sparring");
    expect(train).toContain('layout="row"');
    expect(source).toContain("/tiles/train.webp");
    expect(source).toContain("/tiles/mobility.webp");
    expect(source).toContain("/tiles/timer.webp");
    expect(source).toContain("/tiles/form-check.webp");
    expect(source).toContain("Send a clip");
    expect(source).toContain("Athlete filming a form check in a dark gym");
    expect(source).toContain("Athlete stretching the hips on a dark gym floor");
    expect(source).toContain("/tiles/coach.webp");
    expect(source).toContain("/tiles/learn.webp");
    expect(source).toContain("/tiles/progress.webp");
    expect(source).toContain("/tiles/fuel.webp");
    expect(source).toContain("/tiles/calendar.webp");
    expect(source).toContain("Today’s work");
    expect(source).toContain("Ask SVG Coach");
    expect(source).toContain("Log food");
    expect(source).toContain("This week");
    expect(source).toContain("Athlete eating a meal-prep container in a dark gym");
    expect(source).toContain("Athlete checking off training days on a whiteboard");
    expect(source).toContain("from-black/85");
    expect(source).toContain("text-white");
    expect(source).toContain("font-display");
    expect(source).not.toMatch(/lime Anton label pills|rounded-full bg-accent.*Train/);
    expect(source).not.toMatch(/#FFC629|#0072CE|chuze/i);
  });

  it("shows the last sparring rating, or invites today's log", () => {
    expect(sparringTileHint(4)).toBe("Last session 4/5");
    expect(sparringTileHint(1)).toBe("Last session 1/5");
    expect(sparringTileHint(null)).toBe("Log today's rounds");
    expect(sparringTileHint(undefined)).toBe("Log today's rounds");
    expect(sparringTileHint(0)).toBe("Log today's rounds");
  });
});
