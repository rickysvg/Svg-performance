import { describe, expect, it } from "vitest";
import { memberWeekIndex } from "@/lib/bike-sessions";
import { buildDaySummaryFacts } from "@/lib/coach/day-summary";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { loggerCursorFollowing } from "@/lib/logger-progress";
import { APP_TIMEZONE, dayKey, formatDateTimeLocal, parseDateTimeLocal } from "@/lib/timezone";
import { newPrExerciseCount } from "@/lib/personal-bests";
import { resolveLoggedPerformedAt } from "@/lib/performed-at";
import { sessionDurationSeconds } from "@/lib/share-card";
import { sessionTheme, todayStartLabel } from "@/lib/today-start";
import { scaleExercises } from "@/lib/training-scale";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import { formatWorkoutCompleteDate } from "@/lib/workout-complete";
import { planForDate, type DayPlan } from "@/lib/week-plan";
import { STRENGTH_DAY_BY_BLOCK } from "@/lib/mesocycle";

const DENVER = APP_TIMEZONE;
const MONDAY = new Date("2026-10-19T18:00:00.000Z");

describe("member week starts at day 1", () => {
  it("puts a member who joined this week on Block A, not Day 17", () => {
    expect(memberWeekIndex(MONDAY, MONDAY, DENVER)).toBe(0);
    const plan = planForDate(
      {
        primaryFocus: "mma",
        weeklyAvailability: ["Monday", "Wednesday", "Friday"],
        planAnchor: MONDAY,
      },
      MONDAY,
      DENVER,
    );
    const lift = plan.sessions.find((session) => session.kind === "strength");
    expect(lift?.dayNumber).toBe(STRENGTH_DAY_BY_BLOCK.A.monday);
    expect(lift?.dayNumber).not.toBe(STRENGTH_DAY_BY_BLOCK.C.monday);
  });
});

describe("logged session date", () => {
  it("keeps a same-day draft on the member's local day", () => {
    const existing = new Date("2026-10-19T18:04:00.000Z");
    const resolved = resolveLoggedPerformedAt({
      raw: formatDateTimeLocal(existing, DENVER),
      existing,
      now: new Date("2026-10-19T18:20:00.000Z"),
      timeZone: DENVER,
      completing: true,
    });
    expect(dayKey(resolved, DENVER)).toBe("2026-10-19");
    expect(resolved.toISOString()).toBe(existing.toISOString());
  });

  it("dates an untouched draft from another day on the day it is logged", () => {
    const existing = new Date("2026-10-17T18:00:00.000Z");
    const now = new Date("2026-10-19T18:00:00.000Z");
    const resolved = resolveLoggedPerformedAt({
      raw: formatDateTimeLocal(existing, DENVER),
      existing,
      now,
      timeZone: DENVER,
      completing: true,
    });
    expect(dayKey(resolved, DENVER)).toBe("2026-10-19");
    expect(formatWorkoutCompleteDate(resolved, DENVER)).toBe("MON OCT 19");
  });

  it("parses a datetime-local value in Denver instead of UTC", () => {
    const parsed = parseDateTimeLocal("2026-10-19T12:18", DENVER);
    expect(parsed).toBeTruthy();
    expect(dayKey(parsed!, DENVER)).toBe("2026-10-19");
    expect(formatWorkoutCompleteDate(parsed!, DENVER)).toBe("MON OCT 19");
  });
});

describe("finish screen stats", () => {
  it("counts a few minutes of work instead of showing 0:00", () => {
    const start = new Date("2026-10-19T18:00:00.000Z");
    const seconds = sessionDurationSeconds({
      title: "Lower body",
      status: "complete",
      performedAt: start,
      createdAt: start,
      updatedAt: new Date(start.getTime() + 4 * 60 * 1000),
      sets: [
        {
          exerciseName: "Goblet squat",
          reps: 8,
          loadValue: 25,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(seconds).toBe(240);
  });

  it("counts one new PR per exercise", () => {
    expect(
      newPrExerciseCount([
        { exerciseName: "Goblet squat" },
        { exerciseName: "Goblet squat" },
        { exerciseName: "Sit-to-stand" },
        { exerciseName: "Sit-to-stand" },
        { exerciseName: "Sit-to-stand" },
        { exerciseName: "Reverse lunge" },
      ]),
    ).toBe(3);
  });
});

describe("start today estimate", () => {
  it("uses the session name and one minute estimate", () => {
    const theme = sessionTheme(
      "Est. 42 min. Warm-up, themed rounds, then a short cooldown.",
      "Intelligent jab",
    );
    expect(theme).toBe("Intelligent jab");
    expect(
      todayStartLabel({ verb: "Start today", modality: "Skill", theme, minutes: 36 }),
    ).toBe("Start today · Skill · Intelligent jab · ~36 min");
    expect(todayStartLabel({ verb: "Start today", modality: "Skill", theme, minutes: 36 })).not.toMatch(
      /42/,
    );
  });
});

describe("exercise swap keeps the session", () => {
  it("preserves logged sets and does not collapse the exercise count", () => {
    const existing = [
      {
        exerciseName: "Sit-to-stand",
        setNumber: 1,
        reps: 8,
        loadValue: null,
        loadUnit: "lb" as const,
        logMode: "reps_only" as const,
        completed: true,
      },
      {
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 6,
        loadValue: 25,
        loadUnit: "lb" as const,
        logMode: "load_reps" as const,
        completed: true,
      },
    ];
    const merged = mergeReplacementSets(
      existing,
      ["Sit-to-stand"],
      {
        name: "Goblet squat",
        sets: 1,
        reps: "8",
        loadText: "",
        logMode: "reps_only",
      },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    expect(merged.some((set) => set.exerciseName === "Sit-to-stand")).toBe(false);
    expect(merged.some((set) => set.reps === 8 && set.completed)).toBe(true);
    expect(merged.some((set) => set.reps === 6 && set.loadValue === 25)).toBe(true);
    expect(merged.map((set) => set.exerciseName).join(" ")).not.toMatch(/\(2\)/);
  });
});

describe("logger header", () => {
  it("follows the exercise that was just logged", () => {
    const groups = [
      {
        name: "Sit-to-stand",
        sets: [
          { id: "a", completed: true },
          { id: "b", completed: false },
          { id: "c", completed: false },
        ],
      },
      {
        name: "Goblet squat",
        sets: [
          { id: "d", completed: true },
          { id: "e", completed: false },
        ],
      },
    ];
    const cursor = loggerCursorFollowing(groups, "Goblet squat");
    expect(cursor.exerciseIndex).toBe(2);
    expect(cursor.exerciseName).toBe("Goblet squat");
    expect(cursor.setIndex).toBe(2);
  });
});

describe("summary exercise order", () => {
  it("lists the beginner name the workout actually starts with", () => {
    const scaled = scaleExercises(
      [
        {
          name: "Squat jump or box step-up",
          sets: 3,
          reps: "6",
          restSeconds: 60,
          loadText: "3-5 RIR · Crisp landings",
          notes: "",
        },
      ],
      { band: "beginner", programSlug: DEMO_PROGRAM_SLUG, dayNumber: 17, weightAccess: "gym" },
    );
    expect(scaled[0]?.name).toBe("Sit-to-stand");
    const plan: DayPlan = {
      weekday: "Monday",
      active: true,
      optionalDay: false,
      summary: "Lift",
      sessions: [],
      deload: false,
      testingWeek: false,
      mesoBlock: "A",
      mesoLabel: "Block A",
      outside: null,
    };
    const facts = buildDaySummaryFacts({
      plan,
      sessions: [
        {
          slot: "A",
          kind: "strength",
          label: "Lower",
          title: "Lower body",
          subtitle: "",
          optional: false,
          dayNumber: 1,
        },
      ],
      exercisesByDayNumber: new Map([
        [1, [{ name: scaled[0]!.name, loadText: scaled[0]?.loadText ?? "" }]],
      ]),
      experienceLevel: "beginner",
    });
    expect(facts.sessions[0]?.lines[0]).toMatch(/^Sit-to-stand/);
    expect(facts.sessions[0]?.lines.join(" ")).not.toMatch(/Squat jump or box step-up/);
  });
});
