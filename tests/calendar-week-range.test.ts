import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getCalendarSchedule } from "@/lib/calendar";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { sameWeekdayDayParam } from "@/lib/week-carousel";

describe("calendar week range", () => {
  it("keeps the same weekday when prefetching the next week", () => {
    const weeks = [
      {
        weekStart: "2026-10-19",
        days: [
          { weekday: "Monday", dayParam: "2026-10-19" },
          { weekday: "Wednesday", dayParam: "2026-10-21" },
        ],
      },
      {
        weekStart: "2026-10-26",
        days: [
          { weekday: "Monday", dayParam: "2026-10-26" },
          { weekday: "Wednesday", dayParam: "2026-10-28" },
        ],
      },
    ];
    expect(sameWeekdayDayParam(weeks, weeks[1]!, "2026-10-21")).toBe("2026-10-28");
  });

  it("reads one week of a long history and still shows an older week", async () => {
    await resetDatabase();
    const user = await makeUser("long-history@example.com");
    const now = new Date();
    const old = new Date(now.getTime() - 800 * 86_400_000);
    await prisma.workoutSession.createMany({
      data: Array.from({ length: 1500 }, (_, index) => ({
        userId: user.id,
        title: `History ${index}`,
        status: "complete",
        performedAt: new Date(now.getTime() - (index + 40) * 86_400_000),
      })),
    });
    const history = await prisma.workoutSession.findMany({
      where: { userId: user.id, title: { startsWith: "History " } },
      select: { id: true },
    });
    await prisma.workoutSet.createMany({
      data: history.map((row) => ({
        workoutSessionId: row.id,
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 5,
        completed: true,
        sortOrder: 0,
      })),
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Old week lift",
        status: "complete",
        performedAt: old,
        sets: {
          create: [{ exerciseName: "Goblet squat", setNumber: 1, reps: 5, completed: true, sortOrder: 0 }],
        },
      },
    });

    const started = performance.now();
    const current = await getCalendarSchedule(user.id, now, now);
    const weekMs = performance.now() - started;
    const allStarted = performance.now();
    const all = await listWorkoutSessionsForUser(user.id);
    const allMs = performance.now() - allStarted;
    const oldWeek = await getCalendarSchedule(user.id, now, old);

    expect(all.length).toBeGreaterThanOrEqual(1500);
    expect(current.days.some((day) => day.activities.some((item) => item.title === "Old week lift"))).toBe(false);
    expect(oldWeek.days.some((day) => day.activities.some((item) => item.title === "Old week lift"))).toBe(true);
    console.log(JSON.stringify({ historySessions: all.length, weekBuildMs: Math.round(weekMs), fullHistoryMs: Math.round(allMs) }));
    expect(weekMs).toBeLessThan(2500);
  }, 60_000);
});
