import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE } from "@/lib/timezone";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import { startWorkoutFromDay } from "@/lib/workouts";
import { makeUser, resetDatabase } from "./helpers";

let sessionToken = "";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionToken ? { value: sessionToken } : undefined),
    set: () => undefined,
  }),
  headers: async () => new Headers(),
}));

describe("viewing a short-saved log", () => {
  beforeEach(async () => {
    sessionToken = "";
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not write when the log page renders", async () => {
    const page = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/training/log/[sessionId]/page.tsx"),
      "utf8",
    );
    expect(page).not.toContain("continuePartialWorkoutForUser");

    const user = await makeUser("view-short-log@example.com");
    const created = await createSessionRecord(user.id);
    sessionToken = created.token;
    const program = await getDemoProgram();
    const day = program.days[0];
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const kept = started.sets[0];
    expect(kept).toBeTruthy();
    await prisma.workoutSet.deleteMany({ where: { workoutSessionId: started.id } });
    await prisma.workoutSet.create({
      data: {
        workoutSessionId: started.id,
        exerciseName: kept!.exerciseName,
        setNumber: 1,
        reps: 8,
        loadValue: 40,
        loadUnit: "lb",
        completed: true,
        prescriptionKey: kept!.prescriptionKey,
      },
    });
    const saved = await prisma.workoutSession.update({
      where: { id: started.id },
      data: {
        status: "complete",
        notes: "short",
        plannedSetCount: 1,
        elapsedSeconds: 90,
        finishedAt: started.performedAt,
      },
    });
    const before = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: saved.id },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(before.status).toBe("complete");
    expect(before.sets).toHaveLength(1);
    const timerBefore = await readWorkoutTimerFields(saved.id, prisma);
    expect(timerBefore.elapsedSeconds).toBe(90);
    expect(timerBefore.finishedAt?.toISOString()).toBe(started.performedAt.toISOString());

    const { default: WorkoutLogPage } = await import("@/app/(member)/training/log/[sessionId]/page");
    const view = await WorkoutLogPage({
      params: Promise.resolve({ sessionId: saved.id }),
      searchParams: Promise.resolve({}),
    });
    expect(view).toBeTruthy();

    const after = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: saved.id },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    expect(after.status).toBe(before.status);
    expect(after.sets.map((set) => set.id)).toEqual(before.sets.map((set) => set.id));
    const timerAfter = await readWorkoutTimerFields(saved.id, prisma);
    expect(timerAfter.finishedAt?.toISOString() ?? null).toBe(timerBefore.finishedAt?.toISOString() ?? null);
    expect(timerAfter.elapsedSeconds).toBe(timerBefore.elapsedSeconds);
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    expect(after.notes).toBe(before.notes);
    expect(after.plannedSetCount).toBe(before.plannedSetCount);
  });
});
