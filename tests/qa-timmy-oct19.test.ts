import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { AppError } from "@/lib/errors";
import { currentPlanLine } from "@/lib/trial";
import { summaryHeaderWhen } from "@/lib/coach/day-summary";
import { parseCoachMarkdown } from "@/lib/coach/markdown";
import { summaryReadAction } from "@/lib/coach/browser-speech";
import { prescribedRestSeconds } from "@/lib/exercise-media";
import {
  loggerProgressDetail,
  orderWorkoutSets,
  timedRoundMarkAllowed,
} from "@/lib/logger-progress";
import { saveSparringLog, sparringDateError, sparringNeedsEase } from "@/lib/outside-log";
import { writeRecoveryCheckIn } from "@/lib/recovery-ease";
import { weekTrainingSnapshot, weeklyCheckInAllowed, weeklyCheckInReviewed } from "@/lib/weekly-checkin";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import { removeSessionExercise, undoExerciseRemoval } from "@/lib/exercise-removal-store";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { startWorkoutFromDay } from "@/lib/workouts";
import { APP_TIMEZONE } from "@/lib/timezone";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const NOW = new Date("2026-10-19T18:00:00.000Z");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Timmy Oct 19 plan and check-in copy", () => {
  it("labels an active trial as Pro trial with days left", () => {
    expect(
      currentPlanLine({ trialActive: true, trialDaysLeft: 6, planLabel: "SVG Pro" }),
    ).toBe("Pro trial, 6 days left");
    expect(
      currentPlanLine({ trialActive: true, trialDaysLeft: 1, planLabel: "SVG Pro" }),
    ).toBe("Pro trial, 1 day left");
    expect(
      currentPlanLine({ trialActive: false, trialDaysLeft: 0, planLabel: "SVG Pro" }),
    ).toBe("SVG Pro");
    const pricing = read("src/app/pricing/page.tsx");
    const profile = read("src/app/(member)/profile/page.tsx");
    expect(pricing).toContain("Current plan:");
    expect(pricing).toContain("currentPlanLine(");
    expect(profile).toContain("Current plan:");
    expect(profile).toContain("currentPlanLine(");
  });

  it("keeps the check-in form open for a Pro trial and reviews coaching only", async () => {
    await resetDatabase();
    const trial = await makeUser("trial-checkin@example.com");
    await prisma.profile.update({
      where: { userId: trial.id },
      data: {
        trialStartedAt: new Date("2026-10-18T00:00:00.000Z"),
        trialEndsAt: new Date("2026-10-26T00:00:00.000Z"),
      },
    });
    expect(await weeklyCheckInAllowed(trial.id, NOW)).toBe(true);
    expect(await weeklyCheckInReviewed(trial.id, NOW)).toBe(false);

    const coaching = await makeUser("coach-review@example.com");
    await prisma.subscription.create({
      data: {
        userId: coaching.id,
        plan: "coaching",
        status: "active",
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    expect(await weeklyCheckInReviewed(coaching.id, NOW)).toBe(true);
  });

  it("counts finished workouts through today and explains sparring separately", async () => {
    await resetDatabase();
    const user = await makeUser("sessions@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: "America/Denver", sessionsPerWeek: 4 },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Monday lift",
        performedAt: new Date("2026-10-19T16:00:00.000Z"),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 135 }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Future lift",
        performedAt: new Date("2026-10-21T16:00:00.000Z"),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 135 }] },
      },
    });
    const snapshot = await weekTrainingSnapshot(user.id, NOW, "America/Denver");
    expect(snapshot.sessionsCompleted).toBe(1);
    expect(snapshot.sessionTitles).toEqual(["Monday lift"]);
    expect(read("src/components/checkin/CheckInForm.tsx")).toMatch(/Sparring logs stay separate/);
  });
});

describe("Timmy Oct 19 sparring and coach surfaces", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("blocks a future sparring day and still eases a rough past score", async () => {
    expect(sparringDateError("2026-10-20", NOW, "America/Denver")).toMatch(/Future/);
    expect(sparringDateError("2026-10-19", NOW, "America/Denver")).toBeNull();
    const user = await makeUser("future-spar@example.com");
    await expect(
      saveSparringLog(user.id, {
        dateKey: "2026-10-20",
        weekday: "Tuesday",
        rounds: 3,
        minutesPerRound: 3,
        sessionRating: 2,
        bodyRating: 2,
        now: NOW,
        timeZone: "America/Denver",
      }),
    ).rejects.toBeInstanceOf(AppError);

    await prisma.profile.update({
      where: { userId: user.id },
      data: { trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), aiCoachId: "ricky" },
    });
    const saved = await saveSparringLog(user.id, {
      dateKey: "2026-10-17",
      weekday: "Saturday",
      rounds: 4,
      minutesPerRound: 3,
      sessionRating: 2,
      bodyRating: 2,
      soreSpots: ["ribs"],
      now: NOW,
      timeZone: "America/Denver",
    });
    expect(sparringNeedsEase(saved)).toBe(true);
    const checkIn = await writeRecoveryCheckIn(user.id, saved);
    expect(checkIn?.easeNote).toMatch(/body rating 2/);
    expect(read("src/components/home/SparringLogTile.tsx")).toContain('href="/sparring"');
    expect(read("src/app/(member)/home/page.tsx")).toContain("<HomeQuickActions");
    expect(read("src/components/home/HomeQuickActions.tsx")).toContain("<SparringLogTile");
    expect(read("src/app/(member)/training/page.tsx")).not.toContain("<SparringLogTile");
    expect(read("src/app/(member)/home/page.tsx")).not.toContain("Log sparring");
    expect(read("src/app/(member)/training/page.tsx")).not.toContain("Log sparring");
    expect(read("src/app/(member)/fuel/page.tsx")).toContain('redirect("/nutrition")');
  });

  it("renders coach markdown without treating it as raw HTML", () => {
    const blocks = parseCoachMarkdown(
      "## Today\n\nKeep the **jab** long.\n\n- Hands up\n- *Chin* down\n\nSee [the plan](https://example.com/plan).\n\n<script>alert(1)</script>",
    );
    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    const strong = blocks[1]?.type === "paragraph" ? blocks[1].inlines.find((part) => part.type === "strong") : null;
    expect(strong).toMatchObject({ text: "jab" });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    const linkBlock = blocks.find((block) => block.type === "paragraph" && block.inlines.some((part) => part.type === "link"));
    expect(linkBlock && linkBlock.type === "paragraph" ? linkBlock.inlines : []).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "link", href: "https://example.com/plan" })]),
    );
    const html = blocks.flatMap((block) => (block.type === "paragraph" || block.type === "heading" ? block.inlines : []));
    expect(html.some((part) => part.type === "text" && part.text.includes("<script>"))).toBe(true);
    expect(read("src/components/coach/CoachLiveThread.tsx")).toContain("<CoachMarkdown");
    expect(read("src/components/coach/CoachMarkdown.tsx")).not.toContain("dangerouslySetInnerHTML");
  });

  it("checks the read-aloud limit before play and dates the summary header", () => {
    expect(summaryReadAction({ phase: "idle", readAloudsLeft: 0 })).toBe("blocked");
    expect(summaryReadAction({ phase: "idle", readAloudsLeft: 2 })).toBe("play");
    expect(summaryReadAction({ phase: "loading", readAloudsLeft: 0 })).toBe("wait");
    expect(summaryHeaderWhen("Monday", "2026-10-19")).toBe("Monday · Oct 19");
  });
});

describe("Timmy Oct 19 logger", () => {
  it("requires seconds on a timed round and counts checked rounds", () => {
    expect(
      timedRoundMarkAllowed({ mode: "timed_round", markingDone: true, durationSeconds: null }),
    ).toBe(false);
    expect(
      timedRoundMarkAllowed({ mode: "timed_round", markingDone: true, durationSeconds: 0 }),
    ).toBe(false);
    expect(
      timedRoundMarkAllowed({ mode: "timed_round", markingDone: true, durationSeconds: 180 }),
    ).toBe(true);
    expect(
      timedRoundMarkAllowed({ mode: "reps_load", markingDone: true, durationSeconds: null }),
    ).toBe(true);
    expect(
      loggerProgressDetail({ mode: "timed_round", setIndex: 1, setCount: 5, checked: 2 }),
    ).toBe("Done 2 of 5");
    expect(loggerProgressDetail({ mode: "reps_load", setIndex: 3, setCount: 4, checked: 2 })).toBe(
      "Set 3 of 4",
    );
  });

  it("shows the swapped exercise rest before the plan refreshes", () => {
    expect(
      prescribedRestSeconds({ override: 45, slot: 90, planned: 60, fallback: 90 }),
    ).toBe(45);
    expect(prescribedRestSeconds({ slot: 75, planned: 60, fallback: 90 })).toBe(75);
    expect(prescribedRestSeconds({ planned: 60, fallback: 90 })).toBe(60);
    expect(prescribedRestSeconds({ fallback: 90 })).toBe(90);
  });

  it("orders restored sets by sortOrder so undo keeps the original card", () => {
    const scrambled = orderWorkoutSets([
      { exerciseName: "Face pull", sortOrder: 2, setNumber: 1 },
      { exerciseName: "Goblet squat", sortOrder: 0, setNumber: 1 },
      { exerciseName: "Reverse lunge", sortOrder: 1, setNumber: 1 },
    ]);
    expect(scrambled.map((set) => set.exerciseName)).toEqual([
      "Goblet squat",
      "Reverse lunge",
      "Face pull",
    ]);
  });

  it("puts an undone exercise back in its original position", async () => {
    await resetDatabase();
    const user = await makeUser("undo-order@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    const before = [
      ...new Set(
        [...started.sets]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((set) => set.exerciseName),
      ),
    ];
    expect(before.indexOf("One-arm row")).toBeGreaterThan(0);
    const removed = await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: "One-arm row",
      exerciseName: "One-arm row",
      workoutSessionId: started.id,
      blockKey: trainingBlockKey(NOW, APP_TIMEZONE),
    });
    const restored = await undoExerciseRemoval({
      userId: user.id,
      removalId: removed.id,
    });
    const after = [
      ...new Set(
        [...(restored.sets ?? [])]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((set) => set.exerciseName),
      ),
    ];
    expect(after).toEqual(before);
  });
});
