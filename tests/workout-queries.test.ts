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
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
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

    const created = [];
    for (let index = 0; index < 5; index += 1) {
      const session = await startWorkoutFromDay({
        userId: user.id,
        programDayId: day.id,
        preferredUnits: "lb",
      });
      if (index < 3) {
        await updateWorkoutSessionForUser({
          userId: user.id,
          workoutId: session.id,
          title: session.title,
          performedAt: new Date(Date.now() - index * 86_400_000),
          notes: "",
          status: "complete",
          sets: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 8,
              loadValue: 30,
              loadUnit: "lb",
              completed: true,
            },
          ],
        });
      }
      created.push(session);
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
