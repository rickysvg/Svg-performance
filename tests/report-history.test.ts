import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DARU_EXERCISES } from "@/lib/daru-exercises";
import { liftMetadataKind, liftRegionForExercise, UNMAPPED_EXERCISE_NAMES } from "@/lib/lift-region";
import { prisma } from "@/lib/prisma";
import {
  buildPeriodReport,
  buildWeekArchive,
  currentWeekKey,
  emptyMetrics,
  isMondayKey,
  loadReportHistory,
  metricCards,
  periodDelta,
  summarizePeriod,
  type ReportHistory,
  type ReportSession,
} from "@/lib/report-history";
import { mondayWeekBounds as mondayBounds } from "@/lib/wrapped";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";
import { makeUser, resetDatabase } from "./helpers";

const TZ = "America/Denver";
const NOW = zonedCivilToUtc(2026, 10, 21, TZ);

function session(partial: Partial<ReportSession> & Pick<ReportSession, "performedAt" | "sets">): ReportSession {
  return {
    id: partial.id ?? "s1",
    performedAt: partial.performedAt,
    createdAt: partial.createdAt ?? partial.performedAt,
    updatedAt: partial.updatedAt ?? partial.performedAt,
    status: partial.status ?? "complete",
    title: partial.title ?? "Session",
    difficultyRating: partial.difficultyRating ?? "",
    sessionRpe: partial.sessionRpe ?? null,
    elapsedSeconds: partial.elapsedSeconds ?? null,
    backfilled: partial.backfilled ?? false,
    sets: partial.sets,
  };
}

function history(extra: Partial<ReportHistory> = {}): ReportHistory {
  return {
    userId: "user-1",
    timeZone: TZ,
    displayUnit: "lb",
    prefs: {
      primaryFocus: null,
      weeklyAvailability: [],
      sessionsPerWeek: null,
      trainingFocus: null,
      liftDaysPerWeek: null,
      experienceLevel: null,
      email: null,
      outsideTraining: [],
    },
    sessions: [],
    outside: [],
    now: NOW,
    ...extra,
  };
}

describe("progress report history", () => {
  it("keeps a Sunday-night Denver session in that Monday week", () => {
    const sundayNightUtc = new Date("2026-10-19T05:30:00.000Z");
    const rows = buildWeekArchive(
      history({
        now: NOW,
        sessions: [
          session({
            performedAt: sundayNightUtc,
            elapsedSeconds: 1800,
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 100,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
        ],
      }),
    );
    const week = rows.find((row) => row.weekStartKey === "2026-10-12");
    const next = rows.find((row) => row.weekStartKey === "2026-10-19");
    expect(week?.sessions).toBe(1);
    expect(next?.sessions).toBe(0);
    expect(rows.map((row) => row.weekStartKey)[0]).toBe(currentWeekKey(NOW, TZ));
    expect(rows.map((row) => row.weekStartKey)).toEqual([...rows.map((row) => row.weekStartKey)].sort().reverse());
  });

  it("keeps an empty week between logged weeks and colors the load change", () => {
    const rows = buildWeekArchive(
      history({
        sessions: [
          session({
            id: "early",
            performedAt: zonedCivilToUtc(2026, 10, 6, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 50,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
          session({
            id: "later",
            performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 100,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
        ],
      }),
    );
    const gap = rows.find((row) => row.weekStartKey === "2026-10-12");
    const later = rows.find((row) => row.weekStartKey === "2026-10-19");
    expect(gap?.sessions).toBe(0);
    expect(later?.trainingLoad).toBe(500);
    expect(later?.delta?.direction).toBe("up");
    expect(later?.delta?.absolute).toBe(500);
    expect(later?.delta?.percent).toBeNull();
    const compared = buildPeriodReport(
      history({
        sessions: [
          session({
            id: "early",
            performedAt: zonedCivilToUtc(2026, 10, 6, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 50,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
          session({
            id: "later",
            performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 100,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
        ],
      }),
      "week",
      "2026-10-19",
      "2026-10-05",
      "all",
    );
    expect(compared?.baselineKey).toBe("2026-10-05");
    expect(compared?.cards.find((card) => card.id === "volume")?.current).toBe(500);
    expect(compared?.cards.find((card) => card.id === "volume")?.baseline).toBe(250);
  });

  it("does not invent a percent when the previous period is empty", () => {
    const delta = periodDelta(4, 0);
    expect(delta.direction).toBe("up");
    expect(delta.absolute).toBe(4);
    expect(delta.percent).toBeNull();
    const down = periodDelta(2, 4);
    expect(down.direction).toBe("down");
    expect(down.percent).toBe(50);
  });

  it("splits focus charts by lift region and assault bike, and leaves easy bike out", () => {
    const sessions = [
      session({
        id: "lower",
        performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
        sets: [
          {
            exerciseName: "Goblet squat",
            reps: 8,
            loadValue: 100,
            loadUnit: "lb",
            logMode: "load_reps",
            durationSeconds: null,
            completed: true,
            prescriptionKey: "",
          },
        ],
      }),
      session({
        id: "upper",
        performedAt: zonedCivilToUtc(2026, 10, 21, TZ),
        sets: [
          {
            exerciseName: "Dumbbell bench press",
            reps: 5,
            loadValue: 40,
            loadUnit: "lb",
            logMode: "load_reps",
            durationSeconds: null,
            completed: true,
            prescriptionKey: "",
          },
        ],
      }),
      session({
        id: "bike",
        performedAt: zonedCivilToUtc(2026, 10, 19, TZ),
        elapsedSeconds: 600,
        sets: [
          {
            exerciseName: "Assault bike intervals",
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            logMode: "timed_round",
            durationSeconds: 600,
            completed: true,
            prescriptionKey: "",
          },
        ],
      }),
      session({
        id: "easy",
        performedAt: zonedCivilToUtc(2026, 10, 19, TZ),
        elapsedSeconds: 300,
        sets: [
          {
            exerciseName: "Easy bike intervals",
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            logMode: "timed",
            durationSeconds: 300,
            completed: true,
            prescriptionKey: "",
          },
        ],
      }),
    ];
    const lower = summarizePeriod({ sessions, outside: [], focus: "lower", displayUnit: "lb" });
    const upper = summarizePeriod({ sessions, outside: [], focus: "upper", displayUnit: "lb" });
    const bike = summarizePeriod({ sessions, outside: [], focus: "bike", displayUnit: "lb" });
    expect(lower.volume).toBe(800);
    expect(lower.sessions).toBe(1);
    expect(upper.volume).toBe(200);
    expect(upper.sessions).toBe(1);
    expect(bike.sessions).toBe(1);
    expect(bike.bikeSeconds).toBeGreaterThan(0);
    expect(bike.volume).toBe(0);
    const cards = metricCards(bike, emptyMetrics(), "bike", "lb").map((card) => card.id);
    expect(cards).toContain("time");
    expect(cards).not.toContain("volume");
    expect(cards).not.toContain("rounds");
  });

  it("splits sparring rounds into amateur, pro, and unspecified", () => {
    const metrics = summarizePeriod({
      sessions: [
        session({
          performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
          sets: [
            {
              exerciseName: "Sparring rounds",
              reps: null,
              loadValue: null,
              loadUnit: "lb",
              logMode: "timed_round",
              durationSeconds: 180,
              completed: true,
              prescriptionKey: "round:sparring:60",
            },
            {
              exerciseName: "Sparring rounds",
              reps: null,
              loadValue: null,
              loadUnit: "lb",
              logMode: "timed_round",
              durationSeconds: 180,
              completed: true,
              prescriptionKey: "round:sparring:60",
            },
          ],
        }),
      ],
      outside: [
        { dateKey: "2026-10-18", rounds: 4, minutesPerRound: 3, sessionRating: 4, roundType: "amateur" },
        { dateKey: "2026-10-19", rounds: 3, minutesPerRound: 5, sessionRating: null, roundType: "pro" },
        { dateKey: "2026-10-17", rounds: 2, minutesPerRound: 3, sessionRating: 3, roundType: "" },
      ],
      focus: "all",
      displayUnit: "lb",
    });
    expect(metrics.sparring).toMatchObject({ amateur: 4, pro: 3, unspecified: 4, total: 11 });
    expect(metrics.rounds.sparring).toBe(11);
    const report = buildPeriodReport(
      history({
        sessions: [],
        outside: [
          { dateKey: "2026-10-20", rounds: 5, minutesPerRound: 3, sessionRating: 5, roundType: "pro" },
          { dateKey: "2026-10-13", rounds: 2, minutesPerRound: 3, sessionRating: 4, roundType: "amateur" },
        ],
      }),
      "week",
      "2026-10-19",
      "2026-10-05",
      "all",
    );
    expect(report?.sparring?.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining(["sparring-total", "sparring-amateur", "sparring-pro"]),
    );
    expect(report?.baselineKey).toBe("2026-10-12");
    const kept = buildPeriodReport(
      history({
        sessions: [],
        outside: [
          { dateKey: "2026-10-20", rounds: 5, minutesPerRound: 3, sessionRating: 5, roundType: "pro" },
          { dateKey: "2026-10-06", rounds: 1, minutesPerRound: 3, sessionRating: 3, roundType: "amateur" },
        ],
      }),
      "week",
      "2026-10-19",
      "2026-10-05",
      "all",
    );
    expect(kept?.baselineKey).toBe("2026-10-05");
    expect(buildPeriodReport(history(), "week", "2026-10-21", null, "all")).toBeNull();
    expect(buildPeriodReport(history(), "week", "2026-11-02", null, "all")).toBeNull();
    expect(isMondayKey("2026-10-19", TZ)).toBe(true);
    expect(isMondayKey("2026-10-20", TZ)).toBe(false);
  });

  it("uses the Monday week, not a rolling seven days", () => {
    const wednesday = zonedCivilToUtc(2026, 10, 21, APP_TIMEZONE);
    const monday = mondayBounds(wednesday, APP_TIMEZONE);
    expect(monday.from.getTime()).toBeLessThan(wednesday.getTime());
    const rollingStart = new Date(wednesday.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(monday.from.getTime()).toBeGreaterThan(rollingStart.getTime());
  });

  it("classifies library lifts and leaves reviewed non-lifts unmapped", () => {
    expect(liftRegionForExercise("Goblet squat")).toBe("lower");
    expect(liftRegionForExercise("Dumbbell bench press")).toBe("upper");
    expect(liftRegionForExercise("Bent-over DB shrug")).toBe("upper");
    expect(liftRegionForExercise("Sled hamstring drag")).toBe("lower");
    expect(liftMetadataKind("Farmer's carry")).toBe("other");
    for (const name of UNMAPPED_EXERCISE_NAMES) {
      expect(liftMetadataKind(name)).toBe("unmapped");
    }
    const known = new Set<string>(UNMAPPED_EXERCISE_NAMES);
    for (const row of DARU_EXERCISES) {
      if (liftMetadataKind(row.name) === "unmapped") {
        expect(known.has(row.name)).toBe(true);
      }
    }
  });
});

describe("report history ownership", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reads one member's sessions in one pass and ignores another member", async () => {
    const owner = await makeUser("report-owner@example.com");
    const other = await makeUser("report-other@example.com");
    await prisma.profile.update({ where: { userId: owner.id }, data: { timeZone: TZ } });
    await prisma.workoutSession.create({
      data: {
        userId: other.id,
        title: "Not yours",
        performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 5,
              loadValue: 200,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "Yours",
        performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 5,
              loadValue: 80,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    await prisma.outsideSessionLog.create({
      data: {
        userId: owner.id,
        dateKey: "2026-10-20",
        rounds: 3,
        minutesPerRound: 3,
        roundType: "",
      },
    });
    const loaded = await loadReportHistory(owner.id, NOW);
    expect(loaded.sessions).toHaveLength(1);
    expect(loaded.sessions[0]?.title).toBe("Yours");
    expect(loaded.outside).toHaveLength(1);
    expect(loaded.outside[0]?.roundType).toBe("");
    const archive = buildWeekArchive(loaded);
    expect(archive.find((row) => row.weekStartKey === "2026-10-19")?.sessions).toBe(2);
    expect(archive.some((row) => row.trainingLoad === 1000)).toBe(false);
  });
});

describe("round type copy", () => {
  it("labels the sparring field Round type and never says bout", () => {
    const files = [
      "src/components/training/SparringLogForm.tsx",
      "src/components/report/CompareBars.tsx",
      "src/components/report/PeriodReportView.tsx",
      "src/app/(member)/sparring/page.tsx",
      "src/app/(member)/progress/page.tsx",
      "src/lib/report-history.ts",
      "src/lib/outside-log.ts",
      "src/app/actions/outside-log.ts",
    ];
    const form = fs.readFileSync(path.join(process.cwd(), "src/components/training/SparringLogForm.tsx"), "utf8");
    expect(form).toContain("Round type");
    expect(form).toContain(">Unspecified</option>");
    expect(form).toContain(">Amateur</option>");
    expect(form).toContain(">Pro</option>");
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text).not.toMatch(/\bbout\b/i);
    }
  });
});
