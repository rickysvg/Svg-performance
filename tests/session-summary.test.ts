import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { tagsForExercise } from "@/lib/exercise-tags";
import { buildSessionSummary } from "@/lib/session-summary";

describe("session summary", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("names lift targets from the plan and the block", () => {
    const summary = buildSessionSummary({
      title: "Day 1 — Lower body strength",
      programDayTitle: "Day 1 — Lower body strength",
      programDayFocus: "Squat, hinge, and anti-rotation · Block A · Jab IQ and range",
      exercises: [
        { name: "Squat jump or box step-up" },
        { name: "Cable or band woodchop" },
        { name: "Goblet squat" },
        { name: "Cable or band Pallof press" },
      ],
    });
    expect(summary.kind).toBe("lift");
    expect(summary.targets).toContain("explosive hips");
    expect(summary.targets).toContain("rotational power");
    expect(summary.goal).toMatch(/Block A/i);
    expect(summary.goal.toLowerCase()).toContain("jab iq and range");
    expect(summary.payoff.toLowerCase()).toMatch(/explosive hips|rotational power/);
    expect(summary.payoff).toMatch(/fighter/i);
    expect(summary.payoff).not.toMatch(/great job|nice work|awesome/i);
    expect(summary.targets.length).toBeLessThanOrEqual(4);
  });

  it("uses jab and hook tags for bag work", () => {
    const summary = buildSessionSummary({
      title: "Bag — hooks and pivot",
      programDayTitle: "Bag — hooks and pivot",
      programDayFocus: "Hooks with a pivot · Block A · Jab IQ and range",
      exercises: [
        { name: "Shadowbox round 1 — empty hands" },
        { name: "Lead hook" },
        { name: "Bag rounds — hooks and pivot" },
      ],
    });
    expect(summary.kind).toBe("bag");
    expect(summary.targets).toContain("hook bag rounds");
    expect(summary.targets).toContain("rotational power");
    expect(summary.goal).toMatch(/Hooks with a pivot/);
    expect(summary.payoff.toLowerCase()).toContain("hook");
    expect(summary.goal).toContain("Jab IQ and range");
  });

  it("keeps the bag rounds ahead of the shadow warm-up", () => {
    const summary = buildSessionSummary({
      title: "Bag — intelligent jab",
      programDayTitle: "Bag — intelligent jab",
      programDayFocus: "Intelligent jab · Block A · Jab IQ and range",
      exercises: [
        { name: "Shadowbox round 1 — empty hands" },
        { name: "Shadowbox round 2 — hand weights" },
        { name: "Jab — step and snap" },
        { name: "Bag rounds — intelligent jab" },
        { name: "Easy shadow cool-down" },
      ],
    });
    expect(summary.targets).toContain("jab bag rounds");
    expect(summary.targets).toContain("range control");
    expect(summary.targets[0]).not.toBe("footwork");
    expect(summary.payoff.toLowerCase()).toMatch(/jab/);
  });

  it("calls aerobic bike work what it is", () => {
    const summary = buildSessionSummary({
      title: "Day 8 — Jamieson Cardiac Output",
      programDayTitle: "Day 8 — Jamieson Cardiac Output",
      programDayFocus: "Cardiac output — 20–40 min steady at HR 130–150",
      exercises: [{ name: "Jamieson cardiac output bike" }],
    });
    expect(summary.kind).toBe("bike");
    expect(summary.targets).toContain("aerobic conditioning");
    expect(summary.payoff.toLowerCase()).toContain("aerobic conditioning");
  });

  it("keeps GPP specific to the exercises and the block", () => {
    const summary = buildSessionSummary({
      title: "Day 10 — Friday GPP",
      programDayTitle: "Day 10 — Friday GPP",
      programDayFocus: "GPP, repeat efforts, and a trunk finisher · Block B · Level changes and entries",
      exercises: [{ name: "Sled push" }, { name: "Banded kettlebell swing" }],
    });
    expect(summary.kind).toBe("gpp");
    expect(summary.targets).toEqual(
      expect.arrayContaining(["leg drive", "explosive hips"]),
    );
    expect(summary.goal).toMatch(/Block B/i);
    expect(summary.goal.toLowerCase()).toContain("level changes and entries");
    expect(summary.payoff.toLowerCase()).toMatch(/leg drive|explosive hips/);
  });

  it("prefers tags stored on the plan row", () => {
    const summary = buildSessionSummary({
      title: "Mobility",
      programDayTitle: "Mobility",
      programDayFocus: "Hips and shoulders",
      exercises: [{ name: "Cable or band woodchop", tags: "mobility, hip flow" }],
    });
    expect(summary.targets).toEqual(["mobility", "hip flow"]);
    expect(summary.payoff.toLowerCase()).toContain("mobility");
  });

  it("tags the woodchop and the jab bag in the plan catalog", () => {
    expect(tagsForExercise("Cable or band woodchop")).toContain("rotational power");
    expect(tagsForExercise("Bag rounds — intelligent jab")).toContain("jab bag rounds");
    expect(tagsForExercise("Bag rounds — hooks and pivot")).toContain("hook bag rounds");
  });

  it("writes those tags onto seeded plan rows", async () => {
    const woodchop = await prisma.programExercise.findFirst({
      where: { name: "Cable woodchop" },
    });
    const jab = await prisma.programExercise.findFirst({
      where: { name: "Bag rounds — intelligent jab" },
    });
    const bike = await prisma.programExercise.findFirst({
      where: { name: "Jamieson cardiac output bike" },
    });
    expect(woodchop?.tags.toLowerCase()).toContain("rotational power");
    expect(jab?.tags.toLowerCase()).toContain("jab bag rounds");
    expect(bike?.tags.toLowerCase()).toContain("aerobic conditioning");
  });
});
