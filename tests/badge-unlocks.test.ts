import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  newlyEarnedBadges,
  parseSeenBadgeUnlocks,
  parseUnlockQuery,
  seedSeenExcludingNew,
  serializeUnlockQuery,
  unlockLine,
  unseenEarnedBadges,
} from "@/lib/badge-unlocks";
import { evaluateBadges } from "@/lib/badges";
import { PLATE_OUTLINE_PATH, PLATE_OUTLINE_POINTS } from "@/lib/plate-outline";
import { detectUnseenBadgeUnlocksForSession } from "@/lib/progress-companion";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";
import { readSeenBadgeUnlocksForUser } from "@/lib/profile";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("badge unlock queue and seen store", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("samples the plate silhouette for the neon outline and sparks", () => {
    expect(PLATE_OUTLINE_PATH.startsWith("M")).toBe(true);
    expect(PLATE_OUTLINE_POINTS).toHaveLength(64);
    expect(
      PLATE_OUTLINE_POINTS.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1),
    ).toBe(true);
  });

  it("parses unlock ids and writes the unseen line", () => {
    expect(parseUnlockQuery("streak_7,bike_50,nope")).toEqual(["streak_7", "bike_50"]);
    expect(serializeUnlockQuery(["streak_7", "lift_100kg"])).toBe("streak_7,lift_100kg");
    expect(unlockLine("7-day streak")).toBe("Unlocked: 7-day streak");
    expect(parseSeenBadgeUnlocks('["streak_7"]')).toEqual(["streak_7"]);
  });

  it("queues newly earned badges and seeds older ones as already seen", () => {
    const before = evaluateBadges({
      workoutCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      sets: [],
    });
    const after = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      sets: [],
    });
    const fresh = newlyEarnedBadges(before, after);
    expect(fresh.map((row) => row.id)).toContain("first_session");
    expect(
      seedSeenExcludingNew(
        after.filter((row) => row.earned).map((row) => row.id),
        fresh.map((row) => row.id),
      ),
    ).toEqual([]);
    expect(unseenEarnedBadges(after, ["first_session"]).every((row) => row.id !== "first_session")).toBe(
      true,
    );
  });

  it("stores a seen unlock so the same athlete does not see it again", async () => {
    const user = await makeUser("unlock@example.com");
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
          loadValue: 225,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const first = await detectUnseenBadgeUnlocksForSession(user.id, session.id, "lb");
    expect(first.some((row) => row.id === "first_session")).toBe(true);
    await prisma.profile.update({
      where: { userId: user.id },
      data: { seenBadgeUnlocksJson: JSON.stringify(first.map((row) => row.id)) },
    });
    const again = await detectUnseenBadgeUnlocksForSession(user.id, session.id, "lb");
    expect(again.map((row) => row.id)).not.toContain("first_session");
    expect(readSeenBadgeUnlocksForUser(user.id)).resolves.toEqual(
      expect.arrayContaining(first.map((row) => row.id)),
    );
  });

  it("keeps sparks on the unlock overlay only and respects reduced motion", () => {
    const overlay = read("src/components/progress/BadgeUnlockOverlay.tsx");
    const sparks = read("src/components/progress/BadgeSparks.tsx");
    const outline = read("src/components/progress/BadgeUnlockOutline.tsx");
    const plateOutline = read("src/lib/plate-outline.ts");
    const grid = read("src/components/progress/BadgesGrid.tsx");
    const css = read("src/app/globals.css");
    expect(overlay).toContain("BadgeSparks");
    expect(overlay).toContain("BadgeUnlockOutline");
    expect(overlay).toContain("Keep going");
    expect(overlay).toContain("Share");
    expect(overlay).toContain("shareOrDownloadCard");
    expect(overlay).toContain("navigator.vibrate");
    expect(overlay).toContain("prefers-reduced-motion");
    expect(overlay).toContain("unlockLine");
    expect(overlay).toContain("delayMs={900}");
    expect(overlay).toContain("badge-unlock-fly");
    expect(overlay).toContain("badge-unlock-spec");
    expect(overlay).not.toContain("badge-unlock-glint");
    expect(overlay).not.toContain("badge-unlock-ring");
    expect(overlay).not.toContain("badge-unlock-shine-wrap");
    expect(sparks).toContain("#CBF805");
    expect(sparks).toContain("prefers-reduced-motion");
    expect(sparks).toContain("delayMs = 900");
    expect(sparks).toContain("PLATE_OUTLINE_POINTS");
    expect(sparks).toContain("lighter");
    expect(sparks).not.toContain("plateRim");
    expect(outline).toContain("PLATE_OUTLINE_PATH");
    expect(outline).toContain("pathLength");
    expect(plateOutline).toContain("octagon");
    expect(grid).not.toContain("BadgeSparks");
    expect(css).toContain("badge-cine-in");
    expect(css).toContain("perspective");
    expect(css).toContain("rotateX");
    expect(css).toContain("badge-unlock-backdrop");
    expect(css).toContain("badge-unlock-smoke");
    expect(css).toContain("badge-plate-shine");
    expect(css).toContain("badge-outline-draw");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("badge-unlock-slam");
    expect(css).not.toContain("badge-unlock-ring");
    expect(overlay).toContain("badge-unlock-glow");
    expect(read("src/components/progress/BadgePlate.tsx")).toContain("maskImage");
    expect(read("prisma/schema.prisma")).toContain("seenBadgeUnlocksJson");
  });
});
