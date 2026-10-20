import { describe, expect, it } from "vitest";
import { campPlanWeekIndex } from "@/lib/fight-camp";
import { mesoBlockForWeekIndex, weekInBlock } from "@/lib/mesocycle";
import { blockWeekLabel, planStructureGroups, planStructureLine } from "@/lib/plan-structure";
import { applySwapsToExercises, trainingBlockKey } from "@/lib/exercise-swap";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import { lookupFormVideo, nocookieEmbedSrc } from "@/lib/form-videos";
import { resolveLoggedPerformedAt, sessionCivilDay } from "@/lib/performed-at";
import {
  SESSION_DURATION_CAP_SECONDS,
  formatShareDuration,
  sessionDurationSeconds,
} from "@/lib/share-card";
import { scaleExercises } from "@/lib/training-scale";
import { v2StrengthDays } from "@/lib/v2-lifts";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import { APP_TIMEZONE, dayKey, formatDateTimeLocal } from "@/lib/timezone";

const DENVER = APP_TIMEZONE;

function liftDay() {
  const day = v2StrengthDays().find((row) => row.title.startsWith("Lift 1"));
  if (!day) throw new Error("Lift 1 missing");
  return day;
}

function scaleLift(weekIndex: number, campPhase: "base" | "build" | null) {
  const day = liftDay();
  return scaleExercises(day.exercises.create, {
    band: "intermediate",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: day.dayNumber,
    weekIndex,
    campPhase,
  });
}

describe("fight camp uses the 3-week plan", () => {
  it("keeps week 1–3 loads in base instead of a flat camp dose", () => {
    const main = (weekIndex: number, phase: "base" | "build" | null) =>
      scaleLift(weekIndex, phase).find((row) => row.planSlot === "strength" && /trap-bar/i.test(row.name));
    const base0 = main(0, "base");
    const base1 = main(1, "base");
    const base2 = main(2, "base");
    expect(base0?.loadText).toMatch(/2-3 RIR/);
    expect(base0?.loadText).toMatch(/78%/);
    expect(base1?.loadText).toMatch(/1-2 RIR/);
    expect(base1?.loadText).toMatch(/83%/);
    expect(base2?.loadText).toMatch(/0-1 RIR/);
    expect(base2?.loadText).toMatch(/88%/);
    expect(base0?.loadText).not.toMatch(/Camp strength/);
    expect(main(0, "build")?.loadText).toMatch(/Camp strength/);
    expect(main(0, null)?.loadText).toBe(base0?.loadText);
  });

  it("maps camp week 4 of 12 onto block B, week 1 of 3", () => {
    const index = campPlanWeekIndex({ weekNumber: 4, phase: "base" });
    expect(index).toBe(3);
    expect(weekInBlock(index ?? 0)).toBe(1);
    expect(mesoBlockForWeekIndex(index ?? 0)).toBe("B");
    expect(blockWeekLabel(index ?? 0)).toBe("Week 1 of 3");
    expect(campPlanWeekIndex({ weekNumber: 4, phase: "pre-camp" })).toBeNull();
  });

  it("keeps a camp block key on block B when the off-season week would be later", () => {
    const monday = new Date("2026-10-19T16:00:00.000Z");
    const key = trainingBlockKey(monday, DENVER, new Date("2026-01-05T16:00:00.000Z"), 3);
    expect(key).toBe("2026-10-19:B");
  });

  it("groups a lift into warm-up, power, strength, and conditioning", () => {
    const groups = planStructureGroups(scaleLift(3, "base"));
    const line = planStructureLine(groups);
    expect(line).toContain("Warm-up");
    expect(line).toContain("Power");
    expect(line).toContain("Strength");
    expect(line).toContain("Conditioning");
    expect(line).not.toMatch(/Session A/);
    expect(groups.find((group) => group.label === "Warm-up")?.exercises.length).toBeGreaterThan(0);
  });
});

describe("Goblet squat clip trim", () => {
  it("passes start and end for nfX7IFK9UNI even when the stored URL has none", () => {
    const form = lookupFormVideo("Goblet squat", [
      {
        name: "Goblet squat",
        formVideoUrl: "https://www.youtube.com/watch?v=nfX7IFK9UNI",
        formVideoPending: false,
      },
    ]);
    expect(form.url).toContain("nfX7IFK9UNI");
    expect(form.url).toMatch(/[?&]t=0/);
    expect(form.url).toContain("end=29");
    const embed = nocookieEmbedSrc(form.url);
    expect(embed).toContain("start=0");
    expect(embed).toContain("end=29");
    expect(embed).toContain("nfX7IFK9UNI");
  });
});

describe("duplicate swap stays two exercises", () => {
  it("does not fold Sit-to-stand into the Goblet squat already in the session", () => {
    const shown = applySwapsToExercises(
      [
        { name: "Sit-to-stand", sets: 4, reps: "8", restSeconds: 60 },
        { name: "Goblet squat", sets: 4, reps: "6", restSeconds: 90 },
      ],
      [
        {
          originalName: "Sit-to-stand",
          replacementName: "Goblet squat",
          scope: "session",
          workoutSessionId: "session-1",
          blockKey: "2026-10-19:A",
          sets: 4,
          reps: "8",
          loadText: "2-3 RIR",
          restSeconds: 60,
          logMode: "load_reps",
          notes: "",
          retiredNames: [],
        },
      ],
      { blockKey: "2026-10-19:A", sessionId: "session-1" },
    );
    expect(shown).toHaveLength(2);
    expect(new Set(shown.map((row) => row.name)).size).toBe(2);
    expect(shown.map((row) => row.name)).toContain("Goblet squat");
    expect(shown.map((row) => row.name).some((name) => name.startsWith("Goblet squat ·"))).toBe(true);
  });
});

describe("done screen time", () => {
  it("caps a 25 hour open session instead of showing 0:00", () => {
    const start = new Date("2026-10-19T16:00:00.000Z");
    const seconds = sessionDurationSeconds({
      title: "Lift 1",
      status: "complete",
      performedAt: start,
      createdAt: start,
      updatedAt: new Date(start.getTime() + 25 * 60 * 60 * 1000),
      sets: [
        {
          exerciseName: "Goblet squat",
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(seconds).toBe(SESSION_DURATION_CAP_SECONDS);
    expect(formatShareDuration(seconds)).toBe("4:00:00");
    const tiles = workoutCompleteTiles({
      session: {
        title: "Lift 1",
        status: "complete",
        performedAt: start,
        createdAt: start,
        updatedAt: new Date(start.getTime() + 25 * 60 * 60 * 1000),
        sets: [
          {
            exerciseName: "Goblet squat",
            reps: 8,
            loadValue: 40,
            loadUnit: "lb",
            completed: true,
          },
        ],
      },
      displayUnit: "lb",
      newPrCount: 0,
    });
    expect(tiles.find((tile) => tile.key === "time")?.value).toBe("4:00:00");
    expect(tiles.find((tile) => tile.key === "time")?.value).not.toBe("0:00");
  });
});

describe("Monday volume stays on Monday", () => {
  it("counts a Monday evening Denver session on Monday, not Tuesday", () => {
    const mondayEvening = new Date("2026-10-20T02:00:00.000Z");
    expect(dayKey(mondayEvening, DENVER)).toBe("2026-10-19");
    expect(sessionCivilDay({ performedAt: mondayEvening, createdAt: mondayEvening }, DENVER)).toBe(
      "2026-10-19",
    );
  });

  it("keeps a logged Monday draft on Monday when it is saved Tuesday morning", () => {
    const started = new Date("2026-10-20T02:00:00.000Z");
    const saved = new Date("2026-10-20T15:00:00.000Z");
    expect(sessionCivilDay({ performedAt: saved, createdAt: started }, DENVER)).toBe("2026-10-19");
    const resolved = resolveLoggedPerformedAt({
      raw: formatDateTimeLocal(started, DENVER),
      existing: started,
      now: saved,
      timeZone: DENVER,
      completing: true,
      hasPriorLogs: true,
    });
    expect(dayKey(resolved, DENVER)).toBe("2026-10-19");
  });

  it("still treats a UTC-midnight date stamp as the civil day it names", () => {
    const stamp = new Date("2026-10-19T00:00:00.000Z");
    expect(sessionCivilDay({ performedAt: stamp, createdAt: stamp }, DENVER)).toBe("2026-10-19");
  });
});
