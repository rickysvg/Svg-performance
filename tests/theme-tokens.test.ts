import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ACCENT } from "@/lib/constants";

describe("Chuze-inspired white shell tokens", () => {
  it("uses neon lime #CBF805 as the highlighter fill", () => {
    expect(BRAND_ACCENT.toUpperCase()).toBe("#CBF805");
  });

  it("defaults the app to a white background and black ink", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/--background:\s*#ffffff/i);
    expect(css).toMatch(/--foreground:\s*#0a0a0a/i);
    expect(css).toMatch(/--accent:\s*#cbf805/i);
    expect(css).not.toMatch(/--background:\s*#05070a/);
  });
});
