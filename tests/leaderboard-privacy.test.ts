import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  getWorkoutLeaderboard,
  isVerifiedAcademy,
  optedInPublicName,
} from "@/lib/leaderboard";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";
import { evaluateBadges } from "@/lib/badges";

async function logWorkout(userId: string, performedAt: Date) {
  const program = await getDemoProgram();
  const session = await startWorkoutFromDay({
    userId,
    programDayId: program.days[0]!.id,
    preferredUnits: "kg",
  });
  return updateWorkoutSessionForUser({
    userId,
    workoutId: session.id,
    title: session.title,
    performedAt,
    notes: "",
    status: "complete",
    sets: [
      {
        exerciseName: "Trap bar deadlift",
        setNumber: 1,
        reps: 3,
        loadValue: 180,
        loadUnit: "kg",
        completed: true,
      },
    ],
  });
}

describe("leaderboard privacy and badges", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("never returns an email and hides people who have not opted in", async () => {
    const hidden = await makeUser("hidden@example.com");
    const shown = await makeUser("shown@example.com");
    await prisma.profile.update({
      where: { userId: shown.id },
      data: { displayName: "Maya J.", leaderboardOptIn: true },
    });
    await prisma.profile.update({
      where: { userId: hidden.id },
      data: { displayName: "Hidden Person", leaderboardOptIn: false },
    });
    const now = new Date("2026-09-22T18:00:00.000Z");
    await logWorkout(shown.id, now);
    await logWorkout(hidden.id, now);

    const board = await getWorkoutLeaderboard({
      viewerId: hidden.id,
      now,
      timeZone: "America/Denver",
    });
    expect(JSON.stringify(board)).not.toMatch(/@/);
    expect(JSON.stringify(board)).not.toMatch(/hidden@example.com|shown@example.com/i);
    expect(board.entries.some((row) => row.displayName === "Maya J.")).toBe(true);
    expect(board.entries.some((row) => row.userId === hidden.id)).toBe(false);
    expect(board.you).toBeNull();
  });

  it("academy filter keeps only verified academy members", () => {
    expect(
      isVerifiedAcademy({ claimsGymMembership: true, gymMembershipVerified: true }),
    ).toBe(true);
    expect(
      isVerifiedAcademy({ claimsGymMembership: true, gymMembershipVerified: false }),
    ).toBe(false);
    expect(optedInPublicName({ leaderboardOptIn: false, displayName: "Maya J." })).toBeNull();
    expect(optedInPublicName({ leaderboardOptIn: true, displayName: "Maya J." })).toBe("Maya J.");
  });

  it("earns first-session and 100 kg lift badges from logged sets", () => {
    const badges = evaluateBadges({
      workoutCount: 1,
      currentStreak: 1,
      longestStreak: 1,
      sets: [
        {
          exerciseName: "Trap bar deadlift",
          loadValue: 180,
          loadUnit: "kg",
          completed: true,
          performedAt: new Date("2026-09-22T12:00:00Z"),
        },
      ],
      firstWorkoutAt: new Date("2026-09-22T12:00:00Z"),
    });
    expect(badges.find((row) => row.id === "first_session")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "lift_100kg")?.earned).toBe(true);
    expect(badges.find((row) => row.id === "streak_7")?.earned).toBe(false);
  });
});
