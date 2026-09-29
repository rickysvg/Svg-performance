import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  BADGE_IDS,
  badgeLadders,
  evaluateBadges,
  liftBadgeTitle,
  liftLadderThreshold,
  mapLegacyBadgeId,
  type BadgeSetLike,
} from "@/lib/badges";
import {
  capUnlockQueue,
  migrateSeenBadgeIds,
  newlyEarnedBadges,
  parseUnlockQuery,
  seedSeenExcludingNew,
  serializeUnlockQuery,
  unlockMoreLine,
} from "@/lib/badge-unlocks";
import { detectUnseenBadgeUnlocksForSession } from "@/lib/progress-companion";
import { readSeenBadgeUnlocksForUser } from "@/lib/profile";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import { FX_CLIPS, frameIndexAt } from "@/lib/fx-clips";

function liftSet(load: number, unit: "lb" | "kg"): BadgeSetLike {
  return {
    exerciseName: "Trap bar deadlift",
    loadValue: load,
    loadUnit: unit,
    completed: true,
    performedAt: new Date("2026-09-22T12:00:00Z"),
  };
}

function padSets(count: number): BadgeSetLike[] {
  return Array.from({ length: count }, () => ({
    exerciseName: "Pad rounds",
    loadValue: null,
    loadUnit: "lb",
    durationSeconds: 180,
    logMode: "timed_round",
    completed: true,
    performedAt: new Date("2026-09-22T12:00:00Z"),
  }));
}

describe("badge ladders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ships 43 logical rungs and 48 pack art files for lift unit variants", () => {
    expect(BADGE_IDS).toHaveLength(43);
    const packIds = JSON.parse(
      fs.readFileSync("/tmp/badge-pack-v2/badge-app-pack-v2/manifest.json", "utf8"),
    ).badges as { id: string }[];
    expect(packIds).toHaveLength(48);
    for (const stem of ["lift_l1_lb", "lift_l5_kg", "pads_20", "first_session", "streak_3"]) {
      expect(fs.existsSync(path.join(process.cwd(), `public/badges/${stem}.webp`))).toBe(true);
    }
  });

  it("awards easy early lift rungs in the athlete unit", () => {
    const lb = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      displayUnit: "lb",
      sets: [liftSet(135, "lb")],
    });
    expect(lb.find((row) => row.id === "lift_l1")?.earned).toBe(true);
    expect(lb.find((row) => row.id === "lift_l2")?.earned).toBe(false);
    expect(liftLadderThreshold("lift_l1", "lb")).toBe(135);
    expect(liftLadderThreshold("lift_l3", "kg")).toBe(100);
    expect(liftBadgeTitle("lift_l3", "lb")).toBe("225 lb lift");
    expect(liftBadgeTitle("lift_l5", "kg")).toBe("405 lb lift");

    const fromKgSet = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      displayUnit: "lb",
      sets: [liftSet(100, "kg")],
    });
    expect(fromKgSet.find((row) => row.id === "lift_l3")?.earned).toBe(true);
    expect(fromKgSet.find((row) => row.id === "lift_l3")?.title).toBe("225 lb lift");
    expect(fromKgSet.find((row) => row.id === "lift_l4")?.earned).toBe(false);

    const converted = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      displayUnit: "lb",
      sets: [liftSet(100, "kg")],
    });
    expect(converted.find((row) => row.id === "lift_l3")?.earned).toBe(true);
  });

  it("uses hold, bike, martial, grind ladder thresholds", () => {
    const badges = evaluateBadges({
      workoutCount: 5,
      currentStreak: 5,
      longestStreak: 14,
      displayUnit: "lb",
      sets: [
        ...padSets(20),
        {
          exerciseName: "Assault bike 15/15",
          loadValue: null,
          loadUnit: "lb",
          durationSeconds: 15,
          logMode: "timed_round",
          completed: true,
          performedAt: new Date("2026-09-22T12:00:00Z"),
        },
        ...Array.from({ length: 9 }, () => ({
          exerciseName: "Assault bike 15/15",
          loadValue: null,
          loadUnit: "lb",
          durationSeconds: 15,
          logMode: "timed_round" as const,
          completed: true,
          performedAt: new Date("2026-09-22T12:00:00Z"),
        })),
        {
          exerciseName: "Front plank hold",
          loadValue: null,
          loadUnit: "lb",
          durationSeconds: 60,
          logMode: "timed",
          completed: true,
          performedAt: new Date("2026-09-22T12:00:00Z"),
        },
      ],
    });
    expect(badges.find((row) => row.id === "first_session")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "workouts_5")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "workouts_10")?.earned).toBe(false);
    expect(badges.find((row) => row.id === "streak_14")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "streak_30")?.earned).toBe(false);
    expect(badges.find((row) => row.id === "bike_10")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "bike_25")?.earned).toBe(false);
    expect(badges.find((row) => row.id === "hold_1min")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "hold_2min")?.earned).toBe(false);
    expect(badges.find((row) => row.id === "pads_20")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "pads_35")?.earned).toBe(false);
  });

  it("maps old milestone ids onto the matching ladder rungs", () => {
    expect(mapLegacyBadgeId("lift_100kg")).toBe("lift_l3");
    expect(mapLegacyBadgeId("lift_200kg")).toBe("lift_l5");
    expect(mapLegacyBadgeId("pads_250")).toBe("pads_250");
    expect(migrateSeenBadgeIds(["lift_100kg", "streak_7", "nope"])).toEqual(["lift_l3", "streak_7"]);
    expect(parseUnlockQuery("lift_100kg,bike_50")).toEqual(["lift_l3", "bike_50"]);
    expect(serializeUnlockQuery(["streak_7", "lift_100kg"])).toBe("streak_7,lift_l3");
  });

  it("caps the unlock animation queue and writes an and-N-more line", () => {
    const { shown, extra } = capUnlockQueue(["a", "b", "c", "d", "e"]);
    expect(shown).toEqual(["a", "b", "c"]);
    expect(extra).toBe(2);
    expect(unlockMoreLine(2)).toBe("and 2 more");
    expect(unlockMoreLine(1)).toBe("and 1 more");
  });

  it("treats lower rungs already qualified as silent history, not a fresh unlock flood", () => {
    const before = evaluateBadges({
      workoutCount: 12,
      currentStreak: 12,
      longestStreak: 12,
      displayUnit: "lb",
      sets: [liftSet(225, "lb")],
    });
    const after = evaluateBadges({
      workoutCount: 13,
      currentStreak: 13,
      longestStreak: 13,
      displayUnit: "lb",
      sets: [liftSet(225, "lb")],
    });
    expect(after.filter((row) => row.earned).map((row) => row.id)).toEqual(
      expect.arrayContaining(["first_session", "workouts_10", "lift_l1", "lift_l2", "lift_l3"]),
    );
    const fresh = newlyEarnedBadges(before, after);
    expect(fresh.map((row) => row.id)).toEqual([]);
    const silent = seedSeenExcludingNew(
      after.filter((row) => row.earned).map((row) => row.id),
      fresh.map((row) => row.id),
    );
    expect(silent).toEqual(expect.arrayContaining(["lift_l1", "lift_l2", "lift_l3", "workouts_10"]));
    expect(silent).not.toContain("workouts_25");
  });

  it("retro-awards lower rungs from a migrated old id without returning them as unseen", async () => {
    const user = await makeUser("ladder@example.com");
    const program = await getDemoProgram();
    const earlier = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0]!.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: earlier.id,
      title: earlier.title,
      performedAt: new Date("2026-09-20T18:00:00.000Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Trap bar deadlift",
          setNumber: 1,
          reps: 3,
          loadValue: 225,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: { seenBadgeUnlocksJson: JSON.stringify(["first_session", "lift_100kg"]) },
    });
    const latest = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0]!.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: latest.id,
      title: latest.title,
      performedAt: new Date("2026-09-22T18:00:00.000Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Trap bar deadlift",
          setNumber: 1,
          reps: 3,
          loadValue: 185,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const unseen = await detectUnseenBadgeUnlocksForSession(user.id, latest.id, "lb");
    expect(unseen.map((row) => row.id)).not.toContain("lift_l1");
    expect(unseen.map((row) => row.id)).not.toContain("lift_l2");
    expect(unseen.map((row) => row.id)).not.toContain("lift_l3");
    const seen = await readSeenBadgeUnlocksForUser(user.id);
    expect(seen).toEqual(expect.arrayContaining(["lift_l1", "lift_l2", "lift_l3", "first_session"]));
    expect(seen).not.toContain("lift_100kg");
  });

  it("only animates rungs earned on this session", async () => {
    const user = await makeUser("fresh@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0]!.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date("2026-09-22T18:00:00.000Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Trap bar deadlift",
          setNumber: 1,
          reps: 3,
          loadValue: 135,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const unseen = await detectUnseenBadgeUnlocksForSession(user.id, session.id, "lb");
    expect(unseen.map((row) => row.id)).toEqual(expect.arrayContaining(["first_session", "lift_l1"]));
    expect(unseen.map((row) => row.id)).not.toContain("lift_l3");
  });

  it("builds compact ladders with a featured next rung and earned chips", () => {
    const badges = evaluateBadges({
      workoutCount: 4,
      currentStreak: 4,
      longestStreak: 4,
      displayUnit: "lb",
      sets: padSets(22),
    });
    const pads = badgeLadders(badges).find((row) => row.id === "pads");
    expect(pads?.featured.id).toBe("pads_35");
    expect(pads?.featured.progressLabel).toBe("22/35");
    expect(pads?.earnedRungs.map((row) => row.id)).toEqual(["pads_20"]);
  });

  it("computes win-screen tiles from the real session", () => {
    const tiles = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 2,
      session: {
        title: "Lower",
        performedAt: new Date("2026-09-26T16:00:00.000Z"),
        updatedAt: new Date("2026-09-26T17:00:00.000Z"),
        status: "complete",
        sets: [
          {
            exerciseName: "Back squat",
            reps: 5,
            loadValue: 225,
            loadUnit: "lb",
            logMode: "load_reps",
            completed: true,
          },
          {
            exerciseName: "Pad rounds",
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            durationSeconds: 180,
            logMode: "timed_round",
            completed: true,
          },
        ],
      },
    });
    expect(tiles.find((row) => row.key === "time")?.value).toBe("60:00");
    expect(tiles.find((row) => row.key === "setsRounds")?.value).toBe("2 / 1");
    expect(tiles.find((row) => row.key === "volume")?.value).toBe("1,125");
    expect(tiles.find((row) => row.key === "prs")?.value).toBe("2");
    expect(tiles.find((row) => row.key === "volume")?.label).toBe("Total lbs");
  });

  it("steps sprite sheets at 30fps without wrapping one-shots", () => {
    expect(frameIndexAt(FX_CLIPS.star_flash, 0)).toBe(0);
    expect(frameIndexAt(FX_CLIPS.star_flash, 800)).toBe(23);
    expect(frameIndexAt(FX_CLIPS.star_flash, 2000)).toBe(23);
    expect(frameIndexAt(FX_CLIPS.ember_drift, 2400)).toBe(0);
    expect(FX_CLIPS.ring_comet.durationMs).toBe(1200);
  });
});
