import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  fightReminderNote,
  isFightReminderDay,
  postWorkoutNote,
  sparringCheckNote,
  weeklyRecapMessage,
} from "@/lib/coach/auto-copy";
import {
  coachRecapAiEnabled,
  maybePolishRecap,
  noteAfterWorkout,
  postProactiveNote,
  postWeeklyRecap,
  runCoachProactiveCron,
  runCoachRecapCron,
  sundayKeyFor,
} from "@/lib/coach/auto-notes";

const SUNDAY_EVENING = new Date("2026-10-19T00:30:00.000Z");

async function onboard(userId: string, when = new Date("2026-10-01T15:00:00.000Z")) {
  await prisma.profile.update({
    where: { userId },
    data: {
      onboardingCompletedAt: when,
      timeZone: "America/Denver",
      weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
      sessionsPerWeek: 3,
    },
  });
}

describe("coach template notes", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.COACH_RECAP_AI;
  });

  afterEach(() => {
    delete process.env.COACH_RECAP_AI;
  });

  it("keeps the model off and builds the recap from logged facts", async () => {
    expect(coachRecapAiEnabled()).toBe(false);
    const draft = weeklyRecapMessage({
      sessionsDone: 0,
      missed: 0,
      planKnown: false,
      streak: 0,
      loadUps: [],
      sparringBody: [],
    });
    await expect(maybePolishRecap(draft)).resolves.toBe(draft);
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.COACH_RECAP_AI = "1";
    expect(coachRecapAiEnabled()).toBe(true);
    await expect(maybePolishRecap(draft)).resolves.toBe(draft);
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;

    expect(sundayKeyFor(new Date("2026-10-18T23:00:00.000Z"), "America/Denver")).toBe("2026-10-11");
    expect(sundayKeyFor(SUNDAY_EVENING, "America/Denver")).toBe("2026-10-18");
    expect(
      weeklyRecapMessage({
        sessionsDone: 3,
        missed: 1,
        planKnown: true,
        streak: 4,
        loadUps: [{ name: "Squat", from: 185, to: 195, unit: "lb", pr: true }],
        sparringBody: [3, 4],
      }),
    ).toBe(
      "Week recap. You logged 3 sessions. Squat PR, 185 to 195 lb. Streak is 4 days. Missed 1 session. Sparring body rating 3, then 4. Next week: make the session you missed. Nothing extra.",
    );
    expect(postWorkoutNote({ loadUps: [], missedRir: [] })).toBeNull();
    expect(
      postWorkoutNote({
        loadUps: [{ name: "Bench", from: 135, to: 145, unit: "lb" }],
        missedRir: ["Squat"],
      }),
    ).toContain("RIR was blank on Squat");
    expect(sparringCheckNote({ bodyRating: 2, sore: ["ribs"] })).toMatch(/coach or a doctor/);
    expect(fightReminderNote(7)).toMatch(/7 days/);
    expect(fightReminderNote(1)).toMatch(/tomorrow/);
    expect(isFightReminderDay(3)).toBe(true);
    expect(isFightReminderDay(2)).toBe(false);
  });

  it("posts one Sunday recap per week and still allows one proactive note that day", async () => {
    const user = await makeUser("recap@example.com");
    await onboard(user.id);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lower",
        performedAt: new Date("2026-10-14T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 185 }],
        },
      },
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: { nextFightDate: new Date(Date.UTC(2026, 9, 25)) },
    });

    const first = await postWeeklyRecap(user.id, SUNDAY_EVENING);
    const second = await postWeeklyRecap(user.id, SUNDAY_EVENING);
    expect(first.posted).toBe(true);
    expect(second).toMatchObject({ posted: false, reason: "already" });

    const fight = await postProactiveNote(user.id, SUNDAY_EVENING);
    const again = await postProactiveNote(user.id, SUNDAY_EVENING);
    expect(fight).toMatchObject({ posted: true, kind: "fight" });
    expect(again).toMatchObject({ posted: false, reason: "capped" });

    const messages = await prisma.chatMessage.findMany({ orderBy: { createdAt: "asc" } });
    expect(messages.map((row) => row.content)).toEqual([
      expect.stringContaining("Week recap."),
      expect.stringContaining("Fight is in 7 days"),
    ]);
    expect(messages.every((row) => row.role === "assistant")).toBe(true);

    const cron = await runCoachRecapCron(SUNDAY_EVENING);
    expect(cron.posted).toBe(0);
  });

  it("notes a load increase after a workout and caps the day", async () => {
    const user = await makeUser("loads@example.com");
    await onboard(user.id);
    const program = await prisma.program.create({
      data: {
        slug: `auto-${user.id}`,
        title: "Test",
        description: "Test",
        days: {
          create: {
            dayNumber: 1,
            title: "Lower",
            focus: "strength",
            exercises: {
              create: {
                sortOrder: 0,
                name: "Squat",
                sets: 3,
                reps: "5",
                loadText: "185 lb · 2 RIR",
                restSeconds: 120,
              },
            },
          },
        },
      },
      include: { days: true },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lower",
        performedAt: new Date("2026-10-12T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 185, rir: "2" }],
        },
      },
    });
    const next = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: program.days[0]!.id,
        title: "Lower",
        performedAt: new Date("2026-10-14T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 195, rir: "" }],
        },
      },
    });

    const noted = await noteAfterWorkout(user.id, next.id, new Date("2026-10-14T20:00:00.000Z"));
    const capped = await noteAfterWorkout(user.id, next.id, new Date("2026-10-14T21:00:00.000Z"));
    expect(noted.posted).toBe(true);
    expect(capped).toMatchObject({ posted: false, reason: "capped" });
    const message = await prisma.chatMessage.findFirstOrThrow();
    expect(message.content).toContain("Squat went from 185 to 195 lb");
    expect(message.content).toContain("RIR was blank on Squat");

    const morning = await runCoachProactiveCron(new Date("2026-10-15T16:00:00.000Z"));
    expect(morning.posted).toBe(0);
  });
});
