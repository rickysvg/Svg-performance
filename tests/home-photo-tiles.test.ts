import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TILES = ["train.jpg", "coach.jpg", "learn.jpg", "progress.jpg"] as const;

describe("Home photo tiles", () => {
  it("ships JPEG academy photos for Train, Coach, Learn, and Progress", () => {
    for (const name of TILES) {
      const file = path.join(process.cwd(), "public/home/tiles", name);
      expect(fs.existsSync(file), file).toBe(true);
      const bytes = fs.readFileSync(file);
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.length).toBeGreaterThan(40_000);
      expect(bytes.length).toBeLessThan(900_000);
    }
  });

  it("keeps photo tiles on the existing routes and Fuel/Calendar as letter tiles", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/HomeQuickActions.tsx"),
      "utf8",
    );
    expect(source).toContain('href: "/training"');
    expect(source).toContain('href: "/coach"');
    expect(source).toContain('href: "/learn"');
    expect(source).toContain('href: "/progress"');
    expect(source).toContain('href: "/nutrition"');
    expect(source).toContain('href: "/training/calendar"');
    expect(source).toContain("/home/tiles/train.jpg");
    expect(source).toContain("/home/tiles/coach.jpg");
    expect(source).toContain("/home/tiles/learn.jpg");
    expect(source).toContain("/home/tiles/progress.jpg");
    expect(source).toContain("Today’s work");
    expect(source).toContain("Ask SVG Coach");
    expect(source).not.toMatch(/#FFC629|#0072CE|chuze/i);
  });
});
