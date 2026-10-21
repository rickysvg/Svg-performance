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
    expect(hooks.map((spot) => spot.id)).toEqual(["rear-arm", "lead-arm"]);
    for (const id of ["rear-arm", "lead-arm"]) {
      const arm = hooks.find((spot) => spot.id === id);
      if (!arm) throw new Error(id);
      const span = armSpan(arm);
      expect(span.points).toBeGreaterThanOrEqual(5);
      expect(span.top).toBeLessThan(320);
      expect(span.bottom).toBeGreaterThan(640);
      expect(span.bottom - span.top).toBeGreaterThan(400);
      expect(arm.right - arm.left).toBeGreaterThan(40);
      expect(arm.right - arm.left).toBeLessThan(400);
    }
    expect(glowCaption(hooks)).toBe("Arms");
  });

  it("backlights the lead arm for the jab round", () => {
    expect(ids("all-straight-punches")).toEqual(["lead-arm"]);
    expect(glowCaption(glows("all-straight-punches"))).toBe("Lead arm");
    const arm = glows("all-straight-punches")[0];
    if (!arm) throw new Error("lead arm");
    expect(armSpan(arm).bottom).toBeGreaterThan(640);
  });

  it("backlights the arms throwing body shots, not the core", () => {
    expect(ids("all-body-shots")).toEqual(["rear-arm", "lead-arm"]);
    expect(ids("all-body-shots")).not.toContain("core");
    expect(ids("all-body-shots")).not.toContain("lead-lat");
  });

  it("lights the striking limb for level changes, kicks, knees, and elbows", () => {
    expect(ids("level-change")).toEqual(["lead-arm", "rear-arm"]);
    expect(ids("all-low-kicks")).toEqual(["lead-shin", "rear-shin"]);
    expect(ids("clinch-to-knee")).toEqual(["lead-knee", "rear-knee"]);
    expect(ids("clinch-to-elbow-band")).toEqual(["lead-elbow", "rear-elbow"]);
    expect(ids("all-teeps")).toEqual(["lead-foot", "rear-foot"]);
  });

  it("keeps a one-side round on that side of the figure", () => {
    const right = ids("right-side-only");
    expect(right).toEqual(["rear-arm"]);
    expect(glowCaption(glows("right-side-only"))).toBe("Rear arm");
    expect(ids("left-side-only")).toEqual(["lead-arm"]);
  });

  it("never lights a muscle group on a catalog round", () => {
    const muscle = ["core", "oblique", "lat", "hip", "glute", "flexor", "trap", "quad", "chest", "neck"];
    for (const workout of BAG_WORKOUTS) {
      for (const id of ids(workout.slug)) {
        expect(muscle.some((part) => id.includes(part)), `${workout.slug} ${id}`).toBe(false);
      }
    }
  });

  it("paints a soft limb halo behind the cutout", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/bagwork/BagBodyMap.tsx"), "utf8");
    expect(source.indexOf('data-glow-layer="behind"')).toBeLessThan(source.indexOf("data-athlete"));
    expect(source).toContain("data-glow-color={GLOW_COLOR}");
    const glow = fs.readFileSync(path.join(process.cwd(), "src/lib/bag-glow.ts"), "utf8");
    expect(glow).toContain('"#CBF805"');
    expect(source).toContain('loading="eager"');
    expect(source).toContain("glowSrc(id)");
    expect(glow).toContain("/bagwork/glow/");
    expect(source).not.toContain("<polyline");
    expect(source).not.toContain("strokeWidth");
    expect(source).not.toContain("mixBlendMode");

    const sharp = (await import("sharp")).default;
    const file = path.join(process.cwd(), "public/bagwork/glow/rear-arm.webp");
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(720);
    expect(info.height).toBe(1280);
    let partial = 0;
    let hard = 0;
    let lime = 0;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] ?? 0;
      if (alpha > 12 && alpha < 250) partial += 1;
      if (alpha >= 250) hard += 1;
      if (alpha > 80) {
        colored += 1;
        const red = data[i] ?? 0;
        const green = data[i + 1] ?? 0;
        const blue = data[i + 2] ?? 0;
        if (green > red && green > blue && red > 150 && blue < 40) lime += 1;
      }
    }
    expect(partial).toBeGreaterThan(20000);
    expect(partial / (partial + hard)).toBeGreaterThan(0.35);
    expect(lime / colored).toBeGreaterThan(0.9);
    const torso = (520 * info.width + 360) * 4;
    expect(data[torso + 3]).toBeLessThan(8);

    const athlete = path.join(process.cwd(), "public/bagwork/athlete-front.webp");
    const cut = await sharp(athlete).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cutAlpha = cut.data;
    const width = cut.info.width;
    let steps = 0;
    let prev = -1;
    for (let y = 430; y < 620; y += 1) {
      let edge = -1;
      for (let x = 0; x < width; x += 1) {
        if ((cutAlpha[(y * width + x) * 4 + 3] ?? 0) > 128) {
          edge = x;
          break;
        }
      }
      if (prev >= 0 && edge >= 0 && Math.abs(edge - prev) >= 3) steps += 1;
      if (edge >= 0) prev = edge;
    }
    expect(steps).toBe(0);
  });
});
