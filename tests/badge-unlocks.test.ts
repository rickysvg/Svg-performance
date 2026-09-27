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
    await expect(readSeenBadgeUnlocksForUser(user.id)).resolves.toEqual(
      expect.arrayContaining(first.map((row) => row.id)),
    );
  });

  it("keeps sparks on the unlock overlay only and respects reduced motion", () => {
    const overlay = read("src/components/progress/BadgeUnlockOverlay.tsx");
    const sparks = read("src/components/progress/BadgeSparks.tsx");
    const grid = read("src/components/progress/BadgesGrid.tsx");
    const css = read("src/app/globals.css");
    expect(overlay).toContain("BadgeSparks");
    expect(overlay).toContain("Keep going");
    expect(overlay).toContain("Share");
    expect(overlay).toContain("shareOrDownloadCard");
    expect(overlay).toContain("navigator.vibrate");
    expect(overlay).toContain("prefers-reduced-motion");
    expect(overlay).toContain("playCategorySfx");
    expect(overlay).toContain("delayMs={900}");
    expect(overlay).toContain("badge-unlock-fly");
    expect(overlay).toContain("badge-unlock-ring");
    expect(overlay).toContain("Badge unlocked");
    expect(sparks).toContain("#CBF805");
    expect(sparks).toContain("prefers-reduced-motion");
    expect(sparks).toContain("delayMs = 900");
    expect(sparks).toContain("lighter");
    expect(grid).not.toContain("BadgeSparks");
    expect(css).toContain("badge-cine-in");
    expect(css).toContain("perspective");
    expect(css).toContain("rotateX");
    expect(css).toContain("badge-unlock-backdrop");
    expect(css).toContain("isolation: isolate");
    expect(css).toContain("badge-unlock-ring");
    expect(css).toContain("badge-unlock-rays");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("badge-unlock-slam");
    expect(overlay).toContain("badge-unlock-glow");
    expect(overlay).toContain("badge-unlock-title");
    expect(overlay).toContain("badge-unlock-share");
    expect(css).toContain("badge-unlock-share");
    expect(css).toContain("#cbf805");
    expect(read("src/components/profile/SoundEffectsToggle.tsx")).toContain("Sound effects on");
    expect(read("src/components/training/WorkoutLogForm.tsx")).toContain("primeUnlockAudio");
    expect(read("prisma/schema.prisma")).toContain("seenBadgeUnlocksJson");
  });
});
