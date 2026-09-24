import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TILES = ["train.webp", "coach.webp", "learn.webp", "progress.webp"] as const;

describe("Home photo tiles", () => {
  it("ships ~800px WebP academy photos for Train, Coach, Learn, and Progress", () => {
    for (const name of TILES) {
      const file = path.join(process.cwd(), "public/home/tiles", name);
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
      expect(fs.existsSync(path.join(process.cwd(), "public/home/tiles", name.replace(".webp", ".jpg")))).toBe(
        false,
      );
    }
  });

  it("keeps photo tiles on the existing routes and Fuel/Calendar as letter tiles", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/HomeQuickActions.tsx"),
      "utf8",
    );
    expect(source).toContain('from "next/image"');
    expect(source).toContain("<Image");
    expect(source).toContain('sizes="(max-width: 390px) 50vw, (max-width: 640px) 45vw, 320px"');
    expect(source).toContain('href: "/training"');
    expect(source).toContain('href: "/coach"');
    expect(source).toContain('href: "/learn"');
    expect(source).toContain('href: "/progress"');
    expect(source).toContain('href: "/nutrition"');
    expect(source).toContain('href: "/training/calendar"');
    expect(source).toContain("/home/tiles/train.webp");
    expect(source).toContain("/home/tiles/coach.webp");
    expect(source).toContain("/home/tiles/learn.webp");
    expect(source).toContain("/home/tiles/progress.webp");
    expect(source).toContain("Today’s work");
    expect(source).toContain("Ask SVG Coach");
    expect(source).toContain("from-black/85");
    expect(source).toContain("text-white");
    expect(source).not.toMatch(/lime Anton label pills|rounded-full bg-accent.*Train/);
    expect(source).not.toMatch(/#FFC629|#0072CE|chuze/i);
  });
});
