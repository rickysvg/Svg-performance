import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { aiRemainingLabel, consumeAiUse } from "@/lib/ai-usage";
import { firstSpokenChunk } from "@/lib/coach/browser-speech";
import { buildDaySummaryFacts } from "@/lib/coach/day-summary";
import { runCoachNoteStream } from "@/lib/coach/stream";
import { memberFacingTitle } from "@/lib/member-copy";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { civilDayInstant } from "@/lib/performed-at";
import { detectNewPrs, newPrExerciseCount } from "@/lib/personal-bests";
import { coachingSpotsLine } from "@/lib/pricing";
import { isResumeLoggerPath } from "@/lib/locked-paths";
import { prisma } from "@/lib/prisma";
import { buildTrainingStreak, streakStatusLine } from "@/lib/streaks";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";
import { formatWorkoutCompleteDate } from "@/lib/workout-complete";
import { makeUser, resetDatabase } from "./helpers";
import { startTrialForUser } from "@/lib/trial";
import { PRO_AI_MESSAGES_PER_DAY } from "@/lib/pricing";
import type { DayPlan, ResolvedPlanSession } from "@/lib/week-plan";

const DENVER = APP_TIMEZONE;

describe("progress uses the member local day", () => {
  it("treats a UTC-midnight stamp as that civil day in Denver", () => {
    const stored = new Date("2026-10-18T00:00:00.000Z");
    const local = civilDayInstant(stored, DENVER);
    expect(dayKey(local, DENVER)).toBe("2026-10-18");
    expect(formatWorkoutCompleteDate(local, DENVER)).toBe("SUN OCT 18");
    expect(formatWorkoutCompleteDate(stored, DENVER)).toBe("SAT OCT 17");
  });

  it("counts today's session on the streak", () => {
    const now = new Date("2026-10-19T18:00:00.000Z");
    const logged = civilDayInstant(new Date("2026-10-19T00:00:00.000Z"), DENVER);
    const streak = buildTrainingStreak({
      completedDates: [logged],
      prefs: {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        planAnchor: now,
      },
      now,
      timeZone: DENVER,
    });
    expect(dayKey(logged, DENVER)).toBe("2026-10-19");
    expect(streakStatusLine(streak)).toMatch(/Today counts/);
    expect(streakStatusLine(streak)).not.toMatch(/train today to make it/);
  });
});

describe("one PR per exercise", () => {
  it("counts three sets of one exercise as a single new best", () => {
    const at = new Date("2026-10-19T18:00:00.000Z");
    const sets = [95, 100, 105].map((load) => ({
      exerciseName: "Goblet squat",
      reps: 8,
      loadValue: load,
      loadUnit: "lb" as const,
      logMode: "load_reps",
      completed: true,
      performedAt: at,
    }));
    const prs = detectNewPrs([], sets, "lb", DENVER);
    expect(prs.length).toBeGreaterThan(1);
    expect(newPrExerciseCount(prs)).toBe(1);
    const repeat = detectNewPrs(sets, sets, "lb", DENVER);
    expect(newPrExerciseCount(repeat)).toBe(0);
  });
});

describe("member-facing titles", () => {
  it("strips DEMO labels and catalog day numbers", () => {
    expect(memberFacingTitle("DEMO — Day 17 — Lower body")).toBe("Lower body");
    expect(memberFacingTitle("Day 3 — Intelligent jab")).toBe("Intelligent jab");
  });
});

describe("swap keeps the plan", () => {
  it("carries a matching log, keeps the plan set count and RIR, and skips the (2) suffix", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Sit-to-stand",
          setNumber: 1,
          reps: 8,
          loadValue: null,
          loadUnit: "lb",
          logMode: "reps_only",
          completed: true,
          rir: "0-1 RIR",
        },
        {
          exerciseName: "Sit-to-stand",
          setNumber: 2,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "reps_only",
          completed: false,
          rir: "0-1 RIR",
        },
      ],
      ["Sit-to-stand"],
      {
        name: "Bodyweight squat",
        sets: 3,
        reps: "8",
        loadText: "2-3 RIR · smooth",
        logMode: "reps_only",
      },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    expect(merged).toHaveLength(3);
    expect(merged.every((set) => set.exerciseName === "Bodyweight squat")).toBe(true);
    expect(merged.map((set) => set.exerciseName).join(" ")).not.toMatch(/\(2\)/);
    expect(merged[0]?.reps).toBe(8);
    expect(merged[0]?.completed).toBe(true);
    expect(merged.every((set) => set.rir === "2-3 RIR")).toBe(true);
  });
});

describe("bag summary order", () => {
  it("lists shadowbox round 1 before the later bag work", () => {
    const plan: DayPlan = {
      weekday: "Monday",
      active: true,
      optionalDay: false,
      summary: "Bag",
      sessions: [],
      deload: false,
      testingWeek: false,
      mesoBlock: "A",
      mesoLabel: "Block A",
      outside: null,
    };
    const session: ResolvedPlanSession = {
      slot: "A",
      kind: "skill",
      label: "Bag",
      title: "Intelligent jab",
      subtitle: "",
      optional: false,
      dayNumber: 1,
      sourceWeekday: "Monday",
    };
    const facts = buildDaySummaryFacts({
      plan,
      sessions: [session],
      skillExercisesByDayNumber: new Map([
        [
          1,
          [
            { name: "Shadowbox round 1 — empty hands", loadText: "" },
            { name: "Shadowbox round 2 — hand weights", loadText: "" },
            { name: "Intelligent jab", loadText: "" },
          ],
        ],
      ]),
    });
    expect(facts.sessions[0]?.lines[0]).toBe("Shadowbox round 1 — empty hands");
    expect(facts.sessions[0]?.lines[1]).toMatch(/hand weights/);
  });
});

describe("AI cap and remaining count", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("shows the daily count at 5 left and the weekly count for academy", () => {
    expect(
      aiRemainingLabel({ tier: "pro", messagesLeft: 5, messagesWindow: "day" }),
    ).toBe("5 of 30 left today");
    expect(aiRemainingLabel({ tier: "pro", messagesLeft: 6, messagesWindow: "day" })).toBeNull();
    expect(
      aiRemainingLabel({ tier: "academy", messagesLeft: 2, messagesWindow: "week" }),
    ).toBe("2 of 3 left this week");
  });

  it("returns only the limit, not a previous answer", async () => {
    const user = await makeUser("cap@example.com");
    await startTrialForUser(user.id);
    for (let i = 0; i < PRO_AI_MESSAGES_PER_DAY; i += 1) {
      await consumeAiUse({ userId: user.id, kind: "message", surface: "note" });
    }
    const result = await runCoachNoteStream({
      user,
      body: {
        kind: "note",
        message: "Was that too heavy?",
        exerciseName: "Goblet squat",
      },
    });
    expect(result.status).toBe(402);
    expect(result.content).toBe("");
    expect(result.paywall).toBe("ai_daily_cap");
    expect(JSON.stringify(result)).not.toMatch(/previous answer|cached/i);
  });
});

describe("pricing spots and logger resume", () => {
  it("uses natural spot copy and keeps an in-progress logger open", () => {
    expect(coachingSpotsLine(20)).toBe("20 coaching spots open");
    expect(coachingSpotsLine(0)).toBe("Sold out");
    expect(isResumeLoggerPath("/training/log/abc")).toBe(true);
    expect(isResumeLoggerPath("/training")).toBe(false);
    expect(firstSpokenChunk("Ricky here. Monday is bag work. Then you lift.")).toBe("Ricky here.");
  });
});

describe("onboarding and swap copy", () => {
  it("persists chosen days and does not ask to confirm email before a trial", () => {
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/onboarding/OnboardingForm.tsx"), "utf8");
    const plan = fs.readFileSync(path.join(process.cwd(), "src/app/onboarding/plan/page.tsx"), "utf8");
    const menu = fs.readFileSync(path.join(process.cwd(), "src/components/training/ExerciseCardMenu.tsx"), "utf8");
    expect(form).toContain('type="hidden" name="weeklyAvailability"');
    expect(form).toContain("if (days.length > 0) return;");
    expect(plan).not.toMatch(/confirm your email/i);
    expect(menu).not.toContain("will be cleared");
    expect(menu).toContain("data-swap-sheet");
    expect(menu).toContain('if (event.key === "Enter") event.preventDefault()');
  });
});
