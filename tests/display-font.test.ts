import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Anton display font", () => {
  it("loads Anton from next/font/google as a CSS variable", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain("Anton");
    expect(layout).toContain('"--font-anton"');
    expect(layout).toContain("anton.variable");
    expect(layout).not.toContain("Geist_Mono");
    expect(layout).not.toContain("geistMono");
  });

  it("exposes font-display and keeps body on Geist", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/--font-display:\s*var\(--font-anton\)/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-geist-sans\)/);
    expect(css).toMatch(/h1,\s*\n\s*h2,\s*\n\s*h3/);
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(".font-display");
    expect(css).toContain(".stat-display");
    expect(css).toContain(".rounded-full.bg-accent:not(.border)");
    expect(css).toMatch(/body\s*\{\s*font-family:\s*var\(--font-geist-sans\)/);
  });
});
