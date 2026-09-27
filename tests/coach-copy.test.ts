import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_DISCLAIMER, COACH_AI_BLURB, COACH_AI_SHORT } from "@/lib/plans";
import { safetyPreamble } from "@/lib/coach/safety";
import { COACH_TOPICS } from "@/lib/coach/topics";

const ROOTS = ["src", "tests", "content", "README.md", "EVALS.md", "DECISIONS.md"];

function walk(rel: string): string[] {
  const abs = path.join(process.cwd(), rel);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  return fs.readdirSync(abs).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    return walk(path.join(rel, name));
  });
}

describe("SVG Coach copy", () => {
  it("labels Coach as an AI coach trained on the real topic lanes", () => {
    expect(COACH_TOPICS).toEqual(["martial_art", "conditioning", "mental"]);
    expect(COACH_AI_BLURB).toBe(
      "SVG Coach is an AI coach trained on striking, grappling, strength and conditioning, and fight mindset.",
    );
    expect(COACH_AI_SHORT).toBe("SVG Coach (AI coach)");
    expect(AI_DISCLAIMER).toContain(COACH_AI_BLURB);
    expect(AI_DISCLAIMER).toMatch(/medical|doctor/i);
  });

  it("softens the system prompt without denying or claiming to be Ricky", () => {
    const preamble = safetyPreamble();
    expect(preamble).toMatch(/You are the SVG AI coach/);
    expect(preamble).not.toMatch(/not Ricky/i);
    expect(preamble).not.toMatch(/I am Ricky|I'm Ricky|I am Ricky Maynez/i);
    expect(preamble).toMatch(/Do not claim a human wrote this reply/);
    expect(preamble).toMatch(/not medical advice/);
  });

  it("has no leftover not-Ricky phrasing in app copy", () => {
    const files = ROOTS.flatMap(walk).filter((file) =>
      /\.(ts|tsx|md|js|mjs)$/.test(file),
    );
    const hits: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const rel = path.relative(process.cwd(), file);
      for (const [index, line] of text.split("\n").entries()) {
        if (rel.endsWith("tests/coach-copy.test.ts")) continue;
        if (/\.not\.toMatch\(\/not Ricky/i.test(line)) continue;
        if (/not Ricky|isn['’]t Ricky/i.test(line)) {
          hits.push(`${rel}:${index + 1}:${line.trim()}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
