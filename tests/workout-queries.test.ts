import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import {
  DRAFT_SESSION_TAKE,
  RECENT_SESSION_TAKE,
  countWorkoutSessionsForUser,
  listDraftSessionsForUser,
  listRecentSessionsForUser,
} from "@/lib/workouts";

describe("narrow workout session queries", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("caps recent and draft helpers and keeps Train Continue behavior", async () => {
    expect(RECENT_SESSION_TAKE).toBeLessThanOrEqual(20);
    expect(DRAFT_SESSION_TAKE).toBeLessThanOrEqual(8);

    const user = await makeUser("queries@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];

    for (let index = 0; index < 5; index += 1) {
      await prisma.workoutSession.create({
        data: {
          userId: user.id,
          programDayId: day.id,
          title: day.title,
          performedAt: new Date(Date.now() - index * 86_400_000),
          status: index < 3 ? "complete" : "draft",
          sets: {
            create: [
              {
                exerciseName: "Goblet squat",
                setNumber: 1,
                reps: 8,
                loadValue: 30,
                loadUnit: "lb",
                completed: true,
              },
            ],
          },
        },
      });
    }

    const recentTwo = await listRecentSessionsForUser(user.id, 2);
    expect(recentTwo).toHaveLength(2);

    const drafts = await listDraftSessionsForUser(user.id, 8);
    expect(drafts.length).toBe(2);
    expect(drafts.every((row) => row.status === "draft")).toBe(true);
    expect(drafts.some((row) => row.programDayId === day.id)).toBe(true);

    expect(await countWorkoutSessionsForUser(user.id)).toBe(5);
  });
});
