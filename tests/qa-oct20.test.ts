import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { dedupeGoalLine, formatGoalDisplay } from "@/lib/onboarding";
import { parseCoachMarkdown } from "@/lib/coach/markdown";
import { easeDayPlan, recoveryEaseReason } from "@/lib/recovery-ease";
import { weekChipActivities } from "@/components/training/WeekStrip";
import { restAfterExerciseChange, startRestTimer } from "@/lib/rest-timer";
import { REMOVE_TOAST_MS } from "@/components/training/RemoveToast";
import { DEMO_FORM_VIDEOS, lookupFormVideo, showFormVideoPending } from "@/lib/form-videos";
import { saveSparringLog, sparringDateError } from "@/lib/outside-log";
import { AppError } from "@/lib/errors";
import { stripWeekMarker, v2StrengthDays } from "@/lib/v2-lifts";
import type { DayPlan } from "@/lib/week-plan";

function heavyDay(): DayPlan {
  return {
    weekday: "Tuesday",
    active: true,
    optionalDay: false,
    summary: "Bag+Lift",
    sessions: [
      { kind: "skill", label: "Bag", title: "Bag", heavy: true },
      { kind: "strength", label: "Lift", title: "Lift", heavy: true },
    ],
    deload: false,
    testingWeek: false,
    mesoBlock: "A",
    mesoLabel: "Block A",
    outside: null,
  };
}

describe("QA Oct 20", () => {
  it("shows a duplicated goal once", () => {
    expect(dedupeGoalLine("Get stronger for training — Get stronger for training")).toBe(
      "Get stronger for training",
    );
    expect(formatGoalDisplay("stronger-for-class", "Get stronger for training")).toBe(
      "Get stronger for training",
    );
    expect(dedupeGoalLine("Get stronger for training — fight in the spring")).toBe(
      "Get stronger for training — fight in the spring",
    );
  });

  it("keeps a coach ordered list as one list across blank lines", () => {
    const blocks = parseCoachMarkdown("1. Hands home\n\n1. Chin down\n\n1. Exit on the bell");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: true });
    if (blocks[0]?.type !== "list") return;
    expect(blocks[0].items).toHaveLength(3);
  });

  it("labels an eased heavy day Mobility+Cardio for the week chip", () => {
    const eased = easeDayPlan(heavyDay(), recoveryEaseReason({ bodyRating: 2, soreSpots: [] }));
    expect(eased.easedTo).toBe("mobility");
    expect(eased.plan.summary).toBe("Mobility+Cardio");
    expect(eased.plan.sessions.map((session) => session.title)).toEqual([
      "Mobility — light",
      "Easy cardio",
    ]);
    expect(weekChipActivities(eased.plan.summary).map((chip) => chip.id)).toEqual([
      "Mobility",
      "Cardio",
    ]);
  });

  it("keeps a running rest timer when the exercise is swapped", () => {
    const timer = startRestTimer("Goblet squat", 120, 1_000);
    const next = restAfterExerciseChange(timer, new Set(["Sit-to-stand"]), "Sit-to-stand", 5_000);
    expect(next?.exerciseName).toBe("Sit-to-stand");
    expect(next?.endsAtMs).toBe(timer.endsAtMs);
    expect(restAfterExerciseChange(timer, new Set(["Other"]), undefined, 5_000)).toBeNull();
  });

  it("leaves the undo toast up for about eight seconds", () => {
    expect(REMOVE_TOAST_MS).toBe(8000);
  });

  it("uses the NASM single-leg clip and a real video for step-out and stick", () => {
    expect(DEMO_FORM_VIDEOS["Single-leg RDL"]?.url).toContain("6xdD0Ny0ztk");
    expect(DEMO_FORM_VIDEOS["Single-leg RDL"]?.title).not.toMatch(/BEST|Master/i);
    const step = lookupFormVideo("Step-out and stick");
    expect(showFormVideoPending(step)).toBe(false);
    expect(step.url).toContain("soqQy4dzEts");
    const hinge = v2StrengthDays()
      .flatMap((day) => day.exercises.create)
      .find((row) => row.name === "Single-leg RDL");
    expect(stripWeekMarker(hinge?.notes)).toMatch(/RIR on the line/);
    expect(stripWeekMarker(hinge?.notes)).not.toMatch(/2 or easier/);
  });
});

describe("QA Oct 20 sparring save", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores an optional partner and rejects a future day", async () => {
    const now = new Date("2026-10-20T18:00:00.000Z");
    expect(sparringDateError("2026-10-21", now, "America/Denver")).toMatch(/Future/);
    const user = await makeUser("qa-oct20-spar@example.com");
    await expect(
      saveSparringLog(user.id, {
        dateKey: "2026-10-21",
        weekday: "Wednesday",
        rounds: 3,
        minutesPerRound: 3,
        sessionRating: 4,
        bodyRating: 3,
        now,
        timeZone: "America/Denver",
      }),
    ).rejects.toBeInstanceOf(AppError);
    const saved = await saveSparringLog(user.id, {
      dateKey: "2026-10-20",
      weekday: "Tuesday",
      rounds: 3,
      minutesPerRound: 3,
      intensity: "moderate",
      partner: "Alex",
      sessionRating: 4,
      bodyRating: 3,
      now,
      timeZone: "America/Denver",
    });
    expect(saved.intensity).toBe("moderate");
    expect(saved.partner).toBe("Alex");
  });
});
