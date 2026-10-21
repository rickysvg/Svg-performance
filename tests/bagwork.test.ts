import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { figureParts, mirrorPath } from "@/lib/bag-body";
import {
  BAG_WORKOUTS,
  bagworkHistoryLine,
  bagworkTimerConfig,
  bagworkTrainingLoad,
  litParts,
  parseBagRegions,
} from "@/lib/bagwork";
import {
  cleanBagWorkoutInput,
  logBagworkSessionForUser,
  resolveBagworkLaunch,
  saveCustomBagWorkoutForUser,
} from "@/lib/bagwork-store";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { prisma } from "@/lib/prisma";
import { buildProgressSummary } from "@/lib/progress";
import { mobilityBookendsForSession } from "@/lib/mobility-train";
import { coreSkeletonSessions } from "@/lib/week-plan";
import { makeUser, resetDatabase } from "./helpers";

const NAMES = [
  "Boxing combos",
  "Touch and rip drill",
  "All power punches",
  "Punch to knee combos",
  "Punch to elbow combos",
  "Punch to low kick combos",
  "Punch to body kick combos",
  "All low kicks",
  "All teeps",
  "All body kicks",
  "All hooks",
  "All uppercuts",
  "All body shots",
  "All head kicks",
  "All Japanese teeps",
  "All straight punches",
  "Straight 1-2s and teeps",
  "Clinch to knee",
  "Clinch to knee (resistance band)",
  "Clinch to elbow (resistance band)",
  "All overhands",
  "Level change combos",
  "Strike to bodylock",
  "Full Muay Thai",
  "Full MMA",
  "Right side only",
  "Left side only",
] as const;

function litRegions(slug: string, view: "front" | "back" = "front") {
  const workout = BAG_WORKOUTS.find((row) => row.slug === slug);
  if (!workout) throw new Error(slug);
  return new Set(
    litParts(figureParts(view), workout.regions, workout.side).map((part) => `${part.region}:${part.side}`),
  );
}

describe("bagwork catalog", () => {
  it("lists the bag workouts in order, as ranges with coaching cues", () => {
    expect(BAG_WORKOUTS.map((workout) => workout.name)).toEqual([...NAMES]);
    expect(new Set(BAG_WORKOUTS.map((workout) => workout.slug)).size).toBe(NAMES.length);
    for (const workout of BAG_WORKOUTS) {
      expect(workout.recommendation.startsWith("Recommended:")).toBe(true);
      expect(workout.recommendation).toMatch(/\d+\s*-\s*\d+/);
      expect(workout.cues.length).toBeGreaterThanOrEqual(2);
      expect(workout.cues.length).toBeLessThanOrEqual(4);
      expect(workout).not.toHaveProperty("requiredRounds");
    }
  });

  it("lights the body regions each workout emphasizes", () => {
    const hooks = litRegions("all-hooks");
    expect(hooks.has("shoulders:right")).toBe(true);
    expect(hooks.has("shoulders:left")).toBe(true);
    expect(hooks.has("obliques:right")).toBe(true);
    expect(hooks.has("core:mid")).toBe(true);
    expect(hooks.has("hips:right")).toBe(true);
    expect(hooks.has("feet:right")).toBe(true);

    const lowKicks = litRegions("all-low-kicks");
    expect(lowKicks.has("hips:left")).toBe(true);
    expect(lowKicks.has("core:mid")).toBe(true);
    expect(lowKicks.has("shins:right")).toBe(true);
    expect(lowKicks.has("legs:left")).toBe(true);
    expect(lowKicks.has("feet:right")).toBe(true);

    const teeps = litRegions("all-teeps");
    expect(teeps.has("hip-flexors:right")).toBe(true);
    expect(teeps.has("core:mid")).toBe(true);
    expect(teeps.has("legs:left")).toBe(true);
    expect(teeps.has("shoulders:right")).toBe(false);

    const clinch = litRegions("clinch-to-knee");
    expect(clinch.has("neck:mid")).toBe(true);
    expect(clinch.has("traps:mid")).toBe(true);
    expect(clinch.has("arms:right")).toBe(true);
    expect(clinch.has("hips:left")).toBe(true);
    expect(clinch.has("knees:right")).toBe(true);
    const clinchBack = litRegions("clinch-to-knee", "back");
    expect(clinchBack.has("lats:right")).toBe(true);
    expect(clinchBack.has("lats:left")).toBe(true);

    const level = litRegions("level-change");
    expect(level.has("legs:right")).toBe(true);
    expect(level.has("core:mid")).toBe(true);
    const levelBack = litRegions("level-change", "back");
    expect(levelBack.has("glutes:right")).toBe(true);
    expect(levelBack.has("glutes:left")).toBe(true);

    const right = litRegions("right-side-only");
    expect(right.has("shoulders:right")).toBe(true);
    expect(right.has("shoulders:left")).toBe(false);
    expect(right.has("core:mid")).toBe(true);
    expect(right.has("feet:right")).toBe(true);
    expect(right.has("feet:left")).toBe(false);
  });

  it("mirrors a limb and keeps a custom region list", () => {
    expect(mirrorPath("M40 10 L60 20 Z")).toBe("M160 10 L140 20 Z");
    expect(parseBagRegions("shoulders, core, nope, shoulders")).toEqual(["shoulders", "core"]);
    expect(cleanBagWorkoutInput({ name: "  Southpaw  bag  ", description: "Long jab.\nTeep.", regions: "arms hips" })).toEqual({
      name: "Southpaw bag",
      description: "Long jab.\nTeep.",
      regions: "arms,hips",
    });
  });

  it("scores bagwork load from rounds, minutes, and RPE", () => {
    expect(bagworkTrainingLoad(4, 180, 7)).toBe(84);
    expect(bagworkTrainingLoad(4, 180, null)).toBe(60);
    expect(bagworkTrainingLoad(0, 180, 7)).toBe(0);
    expect(bagworkTimerConfig({ rounds: "5", workMin: "3", restMin: "1" }, { rounds: 4, workSeconds: 120, restSeconds: 30 })).toEqual({
      rounds: 5,
      workSeconds: 180,
      restSeconds: 60,
    });
  });

  it("leaves the strength week with no bag sessions", () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
    for (const day of days) {
      const sessions = coreSkeletonSessions(day, "mma");
      expect(sessions.some((session) => session.kind === "skill")).toBe(false);
    }
    expect(coreSkeletonSessions("Monday", "mma").map((session) => session.kind)).toEqual(["strength"]);
    expect(coreSkeletonSessions("Wednesday", "mma").map((session) => session.kind)).toEqual([
      "conditioning",
      "mobility",
    ]);
    expect(coreSkeletonSessions("Friday", "mma")[0]?.label).toBe("Conditioning");
    expect(coreSkeletonSessions("Saturday", "mma")).toEqual([]);
  });

  it("keeps a short warm-up and cooldown on every weights and conditioning session", () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
    const sessions = days.flatMap((day) => coreSkeletonSessions(day, "mma"));
    const work = sessions.filter((session) => session.kind === "strength" || session.kind === "conditioning");
    const recovery = sessions.filter((session) => session.kind === "mobility");
    expect(work.map((session) => session.kind)).toEqual([
      "strength",
      "strength",
      "conditioning",
      "strength",
      "conditioning",
      "conditioning",
    ]);
    expect(recovery.map((session) => session.label)).toEqual([
      "Mobility — shoulders and hips",
      "Mobility — easy hips",
      "Mobility — easy hips",
    ]);
    for (const session of work) {
      const bookend = mobilityBookendsForSession({
        kind: session.kind,
        title: session.title ?? session.label,
        subtitle: session.detail,
        label: session.label,
      });
      expect(bookend?.activate.id).toBeTruthy();
      expect(bookend?.recover.id).toBeTruthy();
    }
    for (const session of recovery) {
      expect(
        mobilityBookendsForSession({
          kind: session.kind,
          title: session.title ?? session.label,
          label: session.label,
        }),
      ).toBeNull();
    }
  });
});

describe("saved bagwork", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves a custom workout, logs rounds, and counts them on history and load", async () => {
    const user = await makeUser("bagwork@example.com");
    const saved = await saveCustomBagWorkoutForUser({
      userId: user.id,
      name: "Southpaw bag",
      description: "Long jab.\nLeft kick.",
      regions: "shoulders,hips,shins",
    });
    const launch = await resolveBagworkLaunch(user.id, {
      bagwork: `saved:${saved.id}`,
      rounds: "4",
      workMin: "3",
      restMin: "1",
    });
    expect(launch).toMatchObject({
      key: `saved:${saved.id}`,
      name: "Southpaw bag",
      rounds: 4,
      workSeconds: 180,
      restSeconds: 60,
    });

    const session = await logBagworkSessionForUser({
      userId: user.id,
      workoutKey: "all-hooks",
      rounds: 4,
      workSeconds: 180,
      notes: "Hands stayed home.",
      rpe: 7,
    });
    expect(session.title).toBe("All hooks");
    expect(session.status).toBe("complete");
    expect(session.sessionRpe).toBe(7);
    expect(session.sets).toHaveLength(4);
    expect(session.sets.every((set) => set.prescriptionKey === "bagwork" && set.durationSeconds === 180)).toBe(true);
    expect(bagworkHistoryLine(session)).toBe("4 rounds · 3 min · RPE 7");

    const progress = buildProgressSummary([session], "lb");
    expect(progress.sessionCount).toBe(1);
    expect(progress.points[0]?.volume).toBe(84);
    expect(progress.points[0]?.label).toBe("All hooks");

    const telemetry = await getHomeTelemetry({ userId: user.id, now: new Date(), timeZone: "America/Denver" });
    const today = telemetry.days.find((day) => day.bagLoad > 0);
    expect(today?.bagLoad).toBe(84);
    expect(telemetry.weekLoad).toBe(0);
  });
});
