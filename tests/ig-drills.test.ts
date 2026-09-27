import { describe, expect, it } from "vitest";
import { IG_DRILL_DISCLAIMER, IG_DRILLS, igDrillsInGroup } from "@/lib/ig-drills";
import { plyoBlockFor } from "@/lib/training-emphasis";
import { TRAVEL_CIRCUIT, TRAVEL_KB } from "@/lib/travel-day";

const SKIPPED = [
  "https://www.instagram.com/p/DdH_lkAj0n2/",
  "https://www.instagram.com/p/DYCQn7huK5_/",
  "https://www.instagram.com/p/DYgC2ITOfeO/",
  "https://www.instagram.com/reel/DIv4n7xTm-h/",
  "https://www.instagram.com/p/DHjT7S8zmtK/",
];

describe("instagram drill ideas", () => {
  it("credits each drill to that creator’s own post and skips footage we will not use", () => {
    expect(igDrillsInGroup("hips").map((drill) => drill.credit.handle)).toEqual([
      "@lukamoves_",
      "@lukamoves_",
      "@coachgreen.pt",
    ]);
    expect(igDrillsInGroup("kicks").map((drill) => drill.credit.handle)).toEqual([
      "@x_tarasov",
      "@x_tarasov",
    ]);
    const urls = IG_DRILLS.map((drill) => drill.credit.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/$/);
    }
    const blob = JSON.stringify(IG_DRILLS);
    for (const url of SKIPPED) expect(blob).not.toContain(url);
    expect(blob).not.toMatch(/\bbouts?\b/i);
    expect(blob).not.toMatch(/no shortcuts|slavic get-up|comment “|gaethje|bosu/i);
    expect(IG_DRILL_DISCLAIMER).toMatch(/no endorsement is implied/i);
    expect(IG_DRILL_DISCLAIMER).not.toMatch(/not their program/i);
    for (const drill of IG_DRILLS) {
      expect(drill.cues.length).toBeGreaterThan(40);
      expect(drill.credit.handle.startsWith("@")).toBe(true);
      expect(drill.prescription).not.toMatch(/\bbouts?\b/i);
    }
  });

  it("puts pogo hops after landings and the lunge-to-knee on the striker block", () => {
    for (const mode of ["balanced", "striker", "grappler"] as const) {
      const names = plyoBlockFor(mode).map((row) => row.name);
      expect(names[0]).toMatch(/land/i);
      expect(names[1]).toBe("Quiet pogo hops");
    }
    expect(plyoBlockFor("striker").some((row) => row.name === "Lunge to a high knee")).toBe(true);
    expect(plyoBlockFor("grappler").some((row) => row.name === "Lunge to a high knee")).toBe(false);
    expect(TRAVEL_KB.some((row) => row.name === "Half-kneeling turn")).toBe(true);
    expect(TRAVEL_CIRCUIT.some((row) => row.name === "Bear-hug carry")).toBe(true);
  });
});
