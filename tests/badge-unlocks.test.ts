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
    expect(serializeUnlockQuery(["streak_7", "lift_100kg"])).toBe("streak_7,lift_l3");
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
    expect(overlay).toContain("playUnlockSfx");
    expect(overlay).toContain("delayMs={700}");
    expect(overlay).toContain("badge-unlock-fly");
    expect(overlay).toContain("Badge unlocked");
    expect(overlay).toContain("unlockMoreLine");
    expect(overlay).not.toContain("badge-unlock-rays");
    expect(overlay).not.toContain("badge-unlock-ring");
    expect(sparks).toContain("CelebrationFx");
    expect(sparks).toContain("delayMs = 700");
    expect(read("src/components/progress/SpriteFx.tsx")).toContain("ember_burst");
    expect(read("src/components/progress/SpriteFx.tsx")).toContain("star_flash");
    expect(read("src/components/progress/SpriteFx.tsx")).toContain("EmberMotes");
    expect(read("src/components/progress/SpriteFx.tsx")).toContain("destination-in");
    expect(read("src/components/progress/SpriteFx.tsx")).not.toContain("ember_drift");
    expect(read("src/app/globals.css")).toContain("fx-feather");
    expect(read("src/app/(member)/progress/page.tsx")).toContain("progress-tab");
    expect(read("src/app/(member)/progress/page.tsx")).toContain("h-11");
    expect(read("src/lib/badge-sfx.ts")).toContain("playFinishSfx");
    expect(read("src/lib/badge-sfx.ts")).toContain("playUnlockSfx");
    expect(read("src/lib/badge-sfx.ts")).toContain('ACTIVE_UNLOCK_SFX: UnlockSfxName = "metal"');
    expect(read("src/lib/badge-sfx.ts")).toContain("metal:");
    expect(read("src/lib/badge-sfx.ts")).toContain("fightnight:");
    expect(read("src/lib/badge-sfx.ts")).toContain("studio1_boom:");
    expect(read("src/lib/badge-sfx.ts")).toContain("studio2_brass:");
    expect(read("src/lib/badge-sfx.ts")).toContain("studio3_metal_braam:");
    expect(read("src/lib/badge-sfx.ts")).toContain("unlockSfxStartDelayMs");
    expect(overlay).toContain("unlockSfxStartDelayMs");
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_cinematic.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_metal.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_fightnight.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_studio1_boom.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_studio2_brass.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/unlock_studio3_metal_braam.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/win_studio1_boom.mp3"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public/sfx/win_cinematic.mp3"))).toBe(true);
    expect(read("src/lib/workout-complete.ts")).toContain("YOU PUT IN THE WORK.");
    expect(read("src/components/training/WorkoutWinScreen.tsx")).toContain("playFinishSfx");
    expect(read("src/components/training/WorkoutWinScreen.tsx")).toContain("workout_complete_hero.webp");
    expect(read("src/app/(member)/training/log/[sessionId]/done/page.tsx")).toContain("WorkoutWinScreen");
    expect(grid).not.toContain("BadgeSparks");
    expect(css).toContain("badge-cine-in");
    expect(css).toContain("perspective");
    expect(css).toContain("rotateX");
    expect(css).toContain("badge-unlock-backdrop");
    expect(css).toContain("isolation: isolate");
    expect(css).toContain("plus-lighter");
    expect(css).toContain("mix-blend-mode: screen");
    expect(css).not.toContain("badge-unlock-rays");
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
