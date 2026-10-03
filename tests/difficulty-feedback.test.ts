import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  DIFFICULTY_RATINGS,
  classifyCompletedWorkout,
  distributionSummary,
  summarizeDifficulty,
} from "@/lib/difficulty";
import { listDifficultyFeedbackForStaff } from "@/lib/reports";
import { getDemoProgram } from "@/lib/programs";
import {
  rateWorkoutSessionForUser,
  startRoundWorkoutForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function finishDay(userId: string, programDayId: string, performedAt: Date) {
  const session = await startWorkoutFromDay({
    userId,
    programDayId,
    preferredUnits: "lb",
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
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 8,
        loadValue: 40,
        loadUnit: "lb",
        completed: true,
      },
    ],
  });
}

async function finishBag(userId: string, performedAt: Date) {
  const session = await startRoundWorkoutForUser({
    userId,
    mode: "bag",
    rounds: 3,
    workSeconds: 180,
    preferredUnits: "lb",
  });
  return updateWorkoutSessionForUser({
    userId,
    workoutId: session.id,
    title: session.title,
    performedAt,
    notes: "",
    status: "complete",
    sets: session.sets.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: null,
      loadValue: null,
      loadUnit: "lb" as const,
      logMode: "timed_round" as const,
      durationSeconds: set.durationSeconds,
      completed: true,
    })),
  });
}

describe("post-workout difficulty feedback", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("classifies bag, lift, bike, and GPP without a second scale", () => {
    expect(
      classifyCompletedWorkout({ title: "Heavy bag rounds", exerciseNames: ["Heavy bag rounds"] }),
    ).toBe("bag");
    expect(classifyCompletedWorkout({ title: "Pad rounds" })).toBe("bag");
    expect(
      classifyCompletedWorkout({
        title: "DEMO — Day 1 — Lower body strength",
        programDayTitle: "Day 1 — Lower body strength",
      }),
    ).toBe("lift");
    expect(
      classifyCompletedWorkout({
        title: "DEMO — Day 4 — Assault bike",
        programDayTitle: "Day 4 — Assault bike",
        exerciseNames: ["Assault bike intervals"],
      }),
    ).toBe("bike");
    expect(
      classifyCompletedWorkout({
        title: "DEMO — Day 10 — Friday GPP",
        programDayTitle: "Day 10 — Friday GPP",
        programDayFocus: "bike finisher inside GPP",
      }),
    ).toBe("gpp");
    expect(DIFFICULTY_RATINGS.map((item) => item.score)).toEqual([1, 2, 3, 4, 5]);
    const summary = summarizeDifficulty(["too_easy", "hard", "hard"]);
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(2.3);
    expect(summary.distribution.find((row) => row.value === "hard")?.count).toBe(2);
    expect(distributionSummary(summary.distribution)).toContain("Hard 2");
    expect(distributionSummary(summary.distribution)).toContain("Too easy 1");
  });

  it("saves a finished-session rating and shows it per session and in the aggregates", async () => {
    const admin = await makeUser("feel-admin@example.com", false, "admin");
    const coach = await makeUser("feel-coach@example.com", false, "coach");
    const member = await makeUser("feel-member@example.com");
    const other = await makeUser("feel-other@example.com");
    const program = await getDemoProgram();
    const liftDay = program.days.find((day) => /lower body/i.test(day.title));
    const bikeDay = program.days.find((day) => /bike/i.test(day.title));
    const gppDay = program.days.find((day) => /gpp/i.test(day.title));
    expect(liftDay && bikeDay && gppDay).toBeTruthy();
    if (!liftDay || !bikeDay || !gppDay) return;

    const easy = await finishDay(member.id, liftDay.id, new Date("2026-09-20T12:00:00Z"));
    const right = await finishDay(member.id, liftDay.id, new Date("2026-09-21T12:00:00Z"));
    const bike = await finishDay(member.id, bikeDay.id, new Date("2026-09-22T12:00:00Z"));
    const gppHard = await finishDay(member.id, gppDay.id, new Date("2026-09-23T12:00:00Z"));
    const gppMax = await finishDay(member.id, gppDay.id, new Date("2026-09-24T12:00:00Z"));
    const bag = await finishBag(member.id, new Date("2026-09-25T15:00:00Z"));
    const skipped = await finishDay(member.id, liftDay.id, new Date("2026-09-19T12:00:00Z"));

    expect(easy.difficultyRating).toBe("");
    const savedEasy = await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: easy.id,
      difficultyRating: "too_easy",
    });
    expect(savedEasy.difficultyRating).toBe("too_easy");
    await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: right.id,
      difficultyRating: "just_right",
    });
    await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: bike.id,
      difficultyRating: "very_hard",
    });
    await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: gppHard.id,
      difficultyRating: "hard",
    });
    await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: gppMax.id,
      difficultyRating: "extremely_difficult",
    });
    await rateWorkoutSessionForUser({
      userId: member.id,
      workoutId: bag.id,
      difficultyRating: "too_easy",
    });

    const hidden = await finishDay(other.id, bikeDay.id, new Date("2026-09-26T12:00:00Z"));
    await rateWorkoutSessionForUser({
      userId: other.id,
      workoutId: hidden.id,
      difficultyRating: "hard",
    });

    await prisma.coachAssignment.create({
      data: { coachUserId: coach.id, memberUserId: member.id },
    });

    const feedback = await listDifficultyFeedbackForStaff({
      staffUserId: admin.id,
      staffRole: "admin",
    });
    expect(feedback.ratedCount).toBe(7);
    expect(feedback.unratedCount).toBe(1);

    const bagRow = feedback.sessions.find((row) => row.sessionId === bag.id);
    expect(bagRow?.difficultyLabel).toBe("Too easy");
    expect(bagRow?.score).toBe(1);
    expect(bagRow?.workoutType).toBe("Bag");
    expect(bagRow?.displayName).toBe("feel-member");

    const skippedRow = feedback.sessions.find((row) => row.sessionId === skipped.id);
    expect(skippedRow?.difficultyLabel).toBe("Not rated");
    expect(skippedRow?.difficultyRating).toBe("");

    const bikeBucket = feedback.byWorkoutType.find((row) => row.key === "bike");
    expect(bikeBucket?.label).toBe("Bike");
    expect(bikeBucket?.count).toBe(2);
    expect(bikeBucket?.average).toBe(3.5);
    expect(bikeBucket?.distribution.find((row) => row.value === "very_hard")?.count).toBe(1);
    expect(bikeBucket?.distribution.find((row) => row.value === "hard")?.count).toBe(1);
    expect(distributionSummary(bikeBucket?.distribution ?? [])).toContain("Very hard 1");

    const gppBucket = feedback.byWorkoutType.find((row) => row.key === "gpp");
    expect(gppBucket?.count).toBe(2);
    expect(gppBucket?.average).toBe(4);
    expect(distributionSummary(gppBucket?.distribution ?? [])).toBe(
      "Too easy 0 · Just right 0 · Hard 1 · Very hard 0 · Extremely difficult 1",
    );

    const liftDayBucket = feedback.byProgramDay.find((row) => row.key === liftDay.id);
    expect(liftDayBucket?.count).toBe(2);
    expect(liftDayBucket?.average).toBe(1.5);
    expect(liftDayBucket?.label).toBe(liftDay.title);
    expect(feedback.byProgramDay.find((row) => row.key === bag.id)).toBeUndefined();

    const coachView = await listDifficultyFeedbackForStaff({
      staffUserId: coach.id,
      staffRole: "coach",
    });
    expect(coachView.sessions.map((row) => row.userId)).not.toContain(other.id);
    expect(coachView.sessions.some((row) => row.sessionId === bag.id)).toBe(true);
    expect(coachView.byWorkoutType.find((row) => row.key === "bike")?.count).toBe(1);

    await expect(
      listDifficultyFeedbackForStaff({ staffUserId: member.id, staffRole: "member" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("puts the 1–5 prompt on the finish screen and renders it for staff", () => {
    const win = read("src/components/training/WorkoutWinScreen.tsx");
    const picker = read("src/components/training/SessionFeelPicker.tsx");
    const report = read("src/components/staff/SessionFeelReport.tsx");
    const page = read("src/app/(member)/staff/reports/page.tsx");
    const done = read("src/app/(member)/training/log/[sessionId]/done/page.tsx");

    expect(done).toContain("difficultyRating={view.session.difficultyRating}");
    expect(win).toContain("SessionFeelPicker");
    expect(win).toContain('data-win-done="1"');
    expect(picker).toContain("How hard was that?");
    expect(picker).toContain("data-feel-optional");
    expect(picker).toContain("rateFinishedWorkoutAction");
    expect(picker).toContain("DIFFICULTY_RATINGS.map");
    expect(picker).toContain("{item.label}");
    expect(picker).toContain("{item.score}");
    expect(picker).toContain("data-difficulty={item.value}");
    expect(picker).not.toMatch(/\brequired\b/);
    expect(page).toContain("SessionFeelReport");
    expect(page).toContain("listDifficultyFeedbackForStaff");
    expect(report).toContain("{session.difficultyLabel}");
    expect(report).toContain("distributionSummary(bucket.distribution)");
    expect(report).toContain("bucket.average");
    expect(report).toContain("Recent sessions");
    expect(report).toContain("By workout type");
    expect(report).toContain("By program day");
  });
});
