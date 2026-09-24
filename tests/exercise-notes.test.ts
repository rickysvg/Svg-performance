import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  askExerciseNoteForUser,
  coachLaneForExercise,
  listExerciseNotesForUser,
  upsertExerciseNoteForUser,
} from "@/lib/exercise-notes";
import { getDemoProgram } from "@/lib/programs";

describe("exercise notepad", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("picks a coach lane from the movement name", () => {
    expect(coachLaneForExercise("Goblet squat")).toEqual({ topic: "conditioning" });
    expect(coachLaneForExercise("Jab–cross (1–2)")).toEqual({
      topic: "martial_art",
      art: "boxing",
    });
    expect(coachLaneForExercise("Closed guard hip tilt")).toEqual({
      topic: "martial_art",
      art: "jiu-jitsu",
    });
  });

  it("saves a note per member + exercise + day and hides it from other users", async () => {
    const owner = await makeUser("notes-owner@example.com");
    const other = await makeUser("notes-other@example.com");
    const strength = await getDemoProgram();
    const dayId = strength.days[0]!.id;
    await upsertExerciseNoteForUser({
      userId: owner.id,
      exerciseName: "Goblet squat",
      programDayId: dayId,
      body: "Elbows in. Last two reps were honest.",
    });
    const mine = await listExerciseNotesForUser(owner.id, {
      exerciseNames: ["Goblet squat", "Front plank"],
      programDayId: dayId,
    });
    expect(mine["Goblet squat"]?.body).toMatch(/Elbows in/);
    const theirs = await listExerciseNotesForUser(other.id, {
      exerciseNames: ["Goblet squat"],
      programDayId: dayId,
    });
    expect(theirs["Goblet squat"]).toBeUndefined();
  });

  it("asks SVG Coach offline and stores the reply on the note", async () => {
    const user = await makeUser("notes-ask@example.com");
    const strength = await getDemoProgram();
    const dayId = strength.days[0]!.id;
    const result = await askExerciseNoteForUser({
      userId: user.id,
      exerciseName: "Front plank",
      programDayId: dayId,
      body: "How long should I hold this if I am new?",
      logMode: "timed",
      plannedLine: "3 holds × 30–45 sec, 60s rest",
      experienceLevel: "beginner",
    });
    expect(result.body).toMatch(/hold/i);
    expect(result.aiReply).toMatch(/offline|DEMO|coach/i);
    expect(result.aiReply).not.toMatch(/Ricky wrote/i);
    expect(result.aiOffline).toBe(true);
    expect(result.refused).toBe(false);
    const stored = await prisma.exerciseNote.findFirst({
      where: { userId: user.id, exerciseName: "Front plank" },
    });
    expect(stored?.aiReply).toBe(result.aiReply);
  });

  it("refuses a dangerous notepad question without inventing a plan", async () => {
    const user = await makeUser("notes-pain@example.com");
    const result = await askExerciseNoteForUser({
      userId: user.id,
      exerciseName: "Goblet squat",
      body: "I have chest pain but I want to train through the pain tonight.",
      logMode: "load_reps",
    });
    expect(result.refused).toBe(true);
    expect(result.aiReply).toMatch(/Stop|medical|coach/i);
  });
});
