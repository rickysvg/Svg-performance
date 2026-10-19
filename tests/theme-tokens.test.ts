import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ACCENT } from "@/lib/constants";

describe("Hypercar carbon shell tokens", () => {
  it("uses neon lime #CBF805 as the highlighter fill", () => {
    expect(BRAND_ACCENT.toUpperCase()).toBe("#CBF805");
  });

  it("defaults the app to carbon black with lime instrument light", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/--background:\s*#07080a/i);
    expect(css).toMatch(/--foreground:\s*#f3f4ef/i);
    expect(css).toMatch(/--accent:\s*#cbf805/i);
    expect(css).toMatch(/--data:\s*#5ee0ff/i);
    expect(css).toMatch(/--carbon-weave:/);
    expect(css).not.toMatch(/--background:\s*#ffffff/i);
    expect(css).not.toMatch(/--background:\s*#05070a/);
  });
});
