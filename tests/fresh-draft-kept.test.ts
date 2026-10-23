import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE } from "@/lib/timezone";
import {
  discardEmptyWorkoutDraft,
  finalizePastLoggedDrafts,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";

describe("an in-progress draft stays until the member discards it", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps a minute-old fresh draft when the page hides", async () => {
    const user = await makeUser("fresh-hide@example.com");
    const program = await getDemoProgram();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSession.update({
      where: { id: started.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });

    expect(await discardEmptyWorkoutDraft(user.id, started.id)).toEqual({ discarded: false });
    const row = await prisma.workoutSession.findUnique({
      where: { id: started.id },
      include: { sets: true },
    });
    expect(row?.status).toBe("draft");
    expect(row?.sets.length).toBeGreaterThan(0);
  });

  it("reuses the fresh draft on a second start and does not prune it", async () => {
    const user = await makeUser("fresh-restart@example.com");
    const program = await getDemoProgram();
    const dayId = program.days[0].id;
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).toBe(started.id);
    expect(await finalizePastLoggedDrafts(user.id, new Date(), APP_TIMEZONE)).toBe(0);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.workoutSession.findUnique({ where: { id: started.id } })).toMatchObject({
      status: "draft",
    });
  });

  it("keeps the session when a save's sets are all removed", async () => {
    const user = await makeUser("fresh-empty-save@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const names = [...new Set(started.sets.map((set) => set.exerciseName))];
    await prisma.exerciseRemoval.createMany({
      data: names.map((name) => ({
        userId: user.id,
        programSlug: program.slug,
        dayNumber: day.dayNumber,
        originalName: name,
        exerciseName: name,
        workoutSessionId: started.id,
      })),
    });
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: "",
      status: "draft",
      sets: started.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        completed: false,
      })),
    });
    expect(saved.id).toBe(started.id);
    expect(await prisma.workoutSession.findUnique({ where: { id: started.id } })).not.toBeNull();
  });

  it("does not delete the open logger when a second save folds it into an earlier workout", async () => {
    const user = await makeUser("fresh-source@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const earlier = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: earlier.id,
      title: earlier.title,
      performedAt: earlier.performedAt,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: [
        {
          exerciseName: earlier.sets[0].exerciseName,
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const fresh = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(fresh.id).toBe(earlier.id);
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: fresh.id,
      title: fresh.title,
      performedAt: fresh.performedAt,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: [
        {
          exerciseName: earlier.sets[0].exerciseName,
          setNumber: 1,
          reps: 5,
          loadValue: 25,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(saved.id).toBe(earlier.id);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("only discards from the logger's explicit Cancel, not pagehide", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    expect(source).not.toContain("pagehide");
    expect(source).toContain("explicit: true");
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/workouts/discard-empty/route.ts"),
      "utf8",
    );
    expect(route).toContain("explicit");
  });
});
