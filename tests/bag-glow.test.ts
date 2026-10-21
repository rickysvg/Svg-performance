import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { armSpan, focusGlows, glowCaption } from "@/lib/bag-glow";
import { BAG_WORKOUTS } from "@/lib/bagwork";

function glows(slug: string) {
  const workout = BAG_WORKOUTS.find((row) => row.slug === slug);
  if (!workout) throw new Error(slug);
  return focusGlows(slug, workout.regions, workout.side);
}

function ids(slug: string) {
  return glows(slug).map((spot) => spot.id);
}

describe("bag round glows", () => {
  it("backlights both full arms for hooks", () => {
    const hooks = glows("all-hooks");
    expect(hooks.map((spot) => spot.id)).toEqual([
      "rear-arm",
      "lead-arm",
      "rear-oblique",
      "lead-oblique",
      "rear-hip",
      "lead-hip",
    ]);
    for (const id of ["rear-arm", "lead-arm"]) {
      const arm = hooks.find((spot) => spot.id === id);
      if (!arm) throw new Error(id);
      const span = armSpan(arm);
      expect(span.points).toBeGreaterThanOrEqual(5);
      expect(span.top).toBeLessThan(320);
      expect(span.bottom).toBeGreaterThan(640);
      expect(arm.width).toBeGreaterThanOrEqual(80);
    }
    expect(glowCaption(hooks)).toBe("Arms, Obliques, Hips");
  });

  it("backlights the lead arm for the jab round", () => {
    expect(ids("all-straight-punches")).toEqual(["lead-arm"]);
    expect(glowCaption(glows("all-straight-punches"))).toBe("Lead shoulder and arm");
    expect(ids("touch-and-rip")).toEqual(["lead-arm"]);
    const arm = glows("all-straight-punches")[0];
    if (!arm) throw new Error("lead arm");
    expect(armSpan(arm).bottom).toBeGreaterThan(640);
  });

  it("backlights the core and lats for body work", () => {
    expect(ids("all-body-shots")).toEqual(["core", "rear-lat", "lead-lat"]);
    expect(ids("all-body-shots")).not.toContain("lead-arm");
  });

  it("lights hips and quads for level changes, and hips and shins for kicks", () => {
    expect(ids("level-change")).toEqual(["rear-hip", "lead-hip", "rear-quad", "lead-quad"]);
    expect(ids("all-low-kicks")).toEqual(["rear-hip", "lead-hip", "rear-shin", "lead-shin"]);
  });

  it("keeps a one-side round on that side of the figure", () => {
    const right = ids("right-side-only");
    expect(right).toContain("rear-arm");
    expect(right).not.toContain("lead-arm");
    expect(right).toContain("core");
  });

  it("paints the halo behind the cutout", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/bagwork/BagBodyMap.tsx"), "utf8");
    expect(source.indexOf('data-glow-layer="behind"')).toBeLessThan(source.indexOf("<img"));
    expect(source).toContain('stroke="#CBF805"');
    expect(source).not.toContain("mixBlendMode");
  });
});
