import { describe, expect, it } from "vitest";
import { focusGlows, glowCaption } from "@/lib/bag-glow";
import { BAG_WORKOUTS } from "@/lib/bagwork";

function ids(slug: string) {
  const workout = BAG_WORKOUTS.find((row) => row.slug === slug);
  if (!workout) throw new Error(slug);
  return focusGlows(slug, workout.regions, workout.side).map((spot) => spot.id);
}

describe("bag round glows", () => {
  it("lights elbows, shoulders, obliques, and hips for hooks", () => {
    const hooks = ids("all-hooks");
    expect(hooks).toEqual([
      "rear-elbow",
      "lead-elbow",
      "rear-shoulder",
      "lead-shoulder",
      "rear-oblique",
      "lead-oblique",
      "rear-hip",
      "lead-hip",
    ]);
    expect(glowCaption(focusGlows("all-hooks", [], "both"))).toBe("Elbows, Shoulders, Obliques, Hips");
  });

  it("lights the lead shoulder and arm for the jab round", () => {
    expect(ids("all-straight-punches")).toEqual(["lead-shoulder", "lead-arm", "lead-elbow"]);
    expect(glowCaption(focusGlows("all-straight-punches", [], "both"))).toBe("Lead shoulder, Lead arm");
    expect(ids("touch-and-rip")).toEqual(["lead-shoulder", "lead-arm", "lead-elbow"]);
  });

  it("lights the core and lats for body work", () => {
    expect(ids("all-body-shots")).toEqual(["core", "rear-lat", "lead-lat"]);
  });

  it("lights hips and quads for level changes, and hips and shins for kicks", () => {
    expect(ids("level-change")).toEqual(["rear-hip", "lead-hip", "rear-quad", "lead-quad"]);
    expect(ids("all-low-kicks")).toEqual(["rear-hip", "lead-hip", "rear-shin", "lead-shin"]);
  });

  it("keeps a one-side round on that side of the figure", () => {
    const right = ids("right-side-only");
    expect(right).toContain("rear-shoulder");
    expect(right).not.toContain("lead-shoulder");
    expect(right).toContain("core");
  });
});
