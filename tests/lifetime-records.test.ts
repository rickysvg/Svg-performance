import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getPersonalRecordsForUser } from "@/lib/records";
import { detectNewPrsForSession, getCompanionProgress, summarizeBadges } from "@/lib/progress-companion";

const NOW = new Date("2026-10-26T18:00:00.000Z");
const TZ = "America/Denver";
const RECENT = new Date("2026-10-24T18:00:00.000Z");
const OLD = new Date("2015-06-15T18:00:00.000Z");

async function logDeadlift(userId: string, title: string, performedAt: Date, loadValue: number) {
  return prisma.workoutSession.create({
    data: {
      userId,
      title,
      performedAt,
      status: "complete",
      sets: {
        create: [
          {
            exerciseName: "Deadlift",
            setNumber: 1,
            sortOrder: 0,
            reps: 5,
            loadValue,
            loadUnit: "lb",
            completed: true,
            logMode: "load_reps",
          },
        ],
      },
    },
  });
}

describe("all-time records for a 2015 member", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps a 405 deadlift, does not flag 300 as a new PR, and earns 9 of 43 badges", async () => {
    await resetDatabase();
    const user = await makeUser("deadlift-2015@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: TZ, trainingFocus: "sc_only" },
    });
    await logDeadlift(user.id, "2015 deadlift", OLD, 405);
    for (let index = 0; index < 9; index += 1) {
      await logDeadlift(user.id, `Recent deadlift ${index + 1}`, RECENT, 225);
    }

    const records = await getPersonalRecordsForUser(user.id, "lb", NOW, TZ);
    const companion = await getCompanionProgress(user.id, "lb", NOW);
    const board = records.loadRecords.find((row) => row.exerciseName === "Deadlift");
    const listed = companion.records.find((row) => row.exerciseName === "Deadlift");
    expect(board?.bestLoad).toBe(405);
    expect(listed?.primary.kind).toBe("heaviest");
    expect(listed?.primary.value).toBe(405);
    expect(companion.workoutCount).toBe(10);
    expect(summarizeBadges(companion.badges)).toEqual({ earned: 9, total: 43 });
    expect(companion.badges.filter((row) => row.id.startsWith("streak_") && row.earned)).toEqual([]);

    const today = await logDeadlift(user.id, "Today deadlift", NOW, 300);
    const prs = await detectNewPrsForSession(user.id, today.id, "lb");
    expect(prs.filter((row) => row.exerciseName === "Deadlift")).toEqual([]);
  });
});
