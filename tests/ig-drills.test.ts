import { describe, expect, it } from "vitest";
import { IG_DRILL_DISCLAIMER, IG_DRILLS, igDrillsInGroup } from "@/lib/ig-drills";
import { SPRINT_NO_BIKE } from "@/lib/bike-sessions";
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
      "@neromma",
      "@neromma",
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
      expect(url).toMatch(
        /^https:\/\/www\.instagram\.com\/(?:p|reel|[A-Za-z0-9._]+\/reel)\/[A-Za-z0-9_-]+\/$/,
      );
    }
    const blob = JSON.stringify(IG_DRILLS);
    for (const url of SKIPPED) expect(blob).not.toContain(url);
    expect(blob).not.toMatch(/\bbouts?\b/i);
    expect(blob).not.toMatch(/comment “|comment '|gaethje|bosu|being flexible is important|more running is not/i);
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
    expect(IG_DRILLS.filter((drill) => drill.place === "Kicker’s Hips").map((drill) => drill.id)).toEqual([
      "knee-drop-lunge",
      "shin-box",
    ]);
    expect(SPRINT_NO_BIKE.text).toMatch(/battle ropes/i);
    expect(SPRINT_NO_BIKE.text).toMatch(/curved treadmill/i);
    expect(SPRINT_NO_BIKE.text).toMatch(/4–8 seconds/);
    expect(SPRINT_NO_BIKE.posts.map((post) => post.url)).toEqual([
      "https://www.instagram.com/neromma/reel/DdWZxV5MLsP/",
      "https://www.instagram.com/neromma/reel/DdeXQ-SsFLj/",
    ]);
    expect(JSON.stringify(IG_DRILLS)).not.toContain("DdWZxV5MLsP");
  });
});
