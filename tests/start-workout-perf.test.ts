import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import { getPreviousLoadsForUser, startWorkoutFromDay } from "@/lib/workouts";

const NOW = new Date("2026-10-26T18:00:00.000Z");

describe("start workout with a 2015 history", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("opens a session in under 300ms of server time", async () => {
    await resetDatabase();
    const user = await makeUser("start-2015@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        timeZone: "America/Denver",
        onboardingCompletedAt: new Date("2015-03-01T00:00:00.000Z"),
        planChoiceAt: new Date("2015-03-01T00:00:00.000Z"),
        trainingFocus: "sc_only",
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "2015 squat",
        performedAt: new Date("2015-06-15T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Back squat",
              setNumber: 1,
              sortOrder: 0,
              reps: 5,
              loadValue: 225,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Recent squat",
        performedAt: new Date(Date.now() - 20 * 86_400_000),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Back squat",
              setNumber: 1,
              sortOrder: 0,
              reps: 5,
              loadValue: 135,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    for (let index = 0; index < 24; index += 1) {
      await prisma.workoutSession.create({
        data: {
          userId: user.id,
          title: `Old log ${index}`,
          performedAt: new Date(Date.UTC(2016, index % 12, (index % 27) + 1, 18)),
          status: "complete",
          sets: {
            create: [
              {
                exerciseName: index % 2 === 0 ? "Back squat" : "Dumbbell bench press",
                setNumber: 1,
                sortOrder: 0,
                reps: 5,
                loadValue: 135,
                loadUnit: "lb",
                completed: true,
              },
            ],
          },
        },
      });
    }

    const program = await getDemoProgram();
    const day = program.days[0];
    await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      now: new Date("2026-10-20T18:00:00.000Z"),
    });

    const started = performance.now();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      now: NOW,
    });
    const elapsed = performance.now() - started;
    expect(session.status).toBe("draft");
    expect(session.sets.length).toBeGreaterThan(0);

    await getPreviousLoadsForUser(user.id, ["Back squat", "Dumbbell bench press"]);
    const previousStarted = performance.now();
    const previous = await getPreviousLoadsForUser(user.id, ["Back squat", "Dumbbell bench press"], session.id);
    const previousMs = performance.now() - previousStarted;
    expect(previous["Back squat"]?.[1]?.loadValue).toBe(135);
    expect(elapsed).toBeLessThan(300);
    expect(previousMs).toBeLessThan(300);
  });
});
