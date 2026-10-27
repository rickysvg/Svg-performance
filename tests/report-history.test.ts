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
  formatDeltaBadge,
  isMondayKey,
  loadReportHistory,
  metricCards,
  monthBuckets,
  periodDelta,
  streakAt,
  summarizePeriod,
  type ReportHistory,
  type ReportSession,
} from "@/lib/report-history";
import { sessionCompletionDay } from "@/lib/performed-at";
import { currentTrainingStreak } from "@/lib/streaks";
import { mondayWeekBounds as mondayBounds } from "@/lib/wrapped";
import { getWeeklyProgressReport, strengthNoteForPeriod } from "@/lib/weekly-report";
import { listSparringLogs, SPARRING_LOG_LIST_DAYS } from "@/lib/outside-log";
import { listWorkoutSessionsForUser, PROGRESS_HISTORY_DAYS } from "@/lib/workouts";
import { addZonedDays, APP_TIMEZONE, dayKey, zonedCivilToUtc } from "@/lib/timezone";
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

  it("skips an empty week between logged weeks and still compares against it", () => {
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
    const later = rows.find((row) => row.weekStartKey === "2026-10-19");
    expect(rows.map((row) => row.weekStartKey)).not.toContain("2026-10-12");
    expect(rows.some((row) => row.weekStartKey === currentWeekKey(NOW, TZ))).toBe(true);
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
    expect(buildPeriodReport(history(), "week", "2015-03-09", null, "all")).toBeNull();
    expect(buildPeriodReport(history(), "month", "2015-03", null, "all")).toBeNull();
    expect(buildPeriodReport(history(), "month", "2015-13", null, "all")).toBeNull();
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
    expect(liftMetadataKind("Mountain climber")).toBe("other");
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

  it("does not load sessions after the week being shown", async () => {
    const owner = await makeUser("report-bound@example.com");
    await prisma.profile.update({ where: { userId: owner.id }, data: { timeZone: TZ } });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "In week",
        performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 50, completed: true }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "Later",
        performedAt: zonedCivilToUtc(2026, 10, 27, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 80, completed: true }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "Ancient",
        performedAt: zonedCivilToUtc(2014, 6, 2, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 40, completed: true }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "Old compare",
        performedAt: zonedCivilToUtc(2024, 1, 2, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 60, completed: true }] },
      },
    });
    const now = zonedCivilToUtc(2026, 11, 2, TZ);
    const bounded = await loadReportHistory(owner.id, now, { weekStartKey: "2026-10-19" });
    expect(bounded.sessions.map((row) => row.title).sort()).toEqual(["In week"]);
    expect(bounded.sessions.map((row) => row.title)).not.toContain("Later");
    expect(bounded.sessions.map((row) => row.title)).not.toContain("Ancient");
    expect(bounded.sessions.map((row) => row.title)).not.toContain("Old compare");
    const compared = await loadReportHistory(owner.id, now, {
      weekStartKey: "2026-10-19",
      compareKey: "2024-01-01",
    });
    expect(compared.sessions.map((row) => row.title).sort()).toEqual(["In week", "Old compare"]);
    const open = await loadReportHistory(owner.id, now);
    expect(open.sessions.map((row) => row.title).sort()).toEqual(["In week", "Later", "Old compare"]);
    expect(open.sessions.map((row) => row.title)).not.toContain("Ancient");
  });

  it("rejects an adversarial compare instead of loading that year", async () => {
    const owner = await makeUser("report-adversarial@example.com");
    await prisma.profile.update({ where: { userId: owner.id }, data: { timeZone: TZ } });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "Ancient compare",
        performedAt: zonedCivilToUtc(2015, 3, 10, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 40, completed: true }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: owner.id,
        title: "In week",
        performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 50, completed: true }] },
      },
    });
    const now = zonedCivilToUtc(2026, 11, 2, TZ);
    const started = performance.now();
    const loaded = await loadReportHistory(owner.id, now, {
      weekStartKey: "2026-10-19",
      compareKey: "2015-03-09",
    });
    const report = buildPeriodReport(loaded, "week", "2026-10-19", "2015-03-09", "all");
    expect(performance.now() - started).toBeLessThan(500);
    expect(loaded.sessions.map((row) => row.title)).toEqual(["In week"]);
    expect(report?.baselineKey).toBe("2026-10-12");
  });
});

describe("report qa fixes", () => {
  it("says New when the previous total is zero and writes time in hours and minutes", () => {
    expect(formatDeltaBadge(periodDelta(7190, 0), "percent", "number").text).toBe("New");
    expect(formatDeltaBadge(periodDelta(5940, 0), "percent", "time").text).toBe("New");
    expect(formatDeltaBadge(periodDelta(3600, 600), "count", "time").text).toBe("▲50m");
    expect(formatDeltaBadge(periodDelta(2, 4), "percent", "count").text).toBe("▼50%");
  });

  it("labels month weeks by the days inside the month and keeps the comparison week’s own name", () => {
    const september = monthBuckets("2026-09", TZ);
    const october = monthBuckets("2026-10", TZ);
    expect(september[0]?.detail).toBe("Sep 1–6, 2026");
    expect(september.some((bucket) => bucket.detail.includes("Aug"))).toBe(false);
    expect(october.at(-1)?.detail).toBe("Oct 26–31, 2026");
    const report = buildPeriodReport(
      history({
        now: zonedCivilToUtc(2026, 10, 26, TZ),
        sessions: [
          session({
            performedAt: zonedCivilToUtc(2026, 9, 2, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
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
            performedAt: zonedCivilToUtc(2026, 10, 27, TZ),
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
        ],
      }),
      "month",
      "2026-10",
      "2026-09",
      "all",
    );
    const octoberPoints = report?.charts[0]?.points ?? [];
    expect(octoberPoints.map((point) => point.detail)).toEqual(october.map((bucket) => bucket.detail));
    const sharedOctober = octoberPoints.find((point) => point.detail === "Oct 1–4, 2026");
    expect(sharedOctober?.baselineDetail).toBe("Sep 1–6, 2026");
    expect(sharedOctober?.baseline).toBeGreaterThan(0);
    expect(octoberPoints.at(-1)?.detail).toBe("Oct 26–31, 2026");
    expect(octoberPoints.at(-1)?.baselineDetail).toBe("Sep 28–30, 2026");
    expect(octoberPoints.every((point) => !point.baselineDetail.includes("Oct 26"))).toBe(true);
    expect(octoberPoints[0]?.label.startsWith("Oct")).toBe(true);
    const septemberReport = buildPeriodReport(
      history({
        now: zonedCivilToUtc(2026, 10, 26, TZ),
        sessions: [
          session({
            id: "aug-31",
            performedAt: zonedCivilToUtc(2026, 8, 31, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
                reps: 5,
                loadValue: 200,
                loadUnit: "lb",
                logMode: "load_reps",
                durationSeconds: null,
                completed: true,
                prescriptionKey: "",
              },
            ],
          }),
          session({
            id: "sep-2",
            performedAt: zonedCivilToUtc(2026, 9, 2, TZ),
            sets: [
              {
                exerciseName: "Goblet squat",
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
        ],
      }),
      "month",
      "2026-09",
      "2026-08",
      "all",
    );
    const points = septemberReport?.charts[0]?.points ?? [];
    const august = monthBuckets("2026-08", TZ);
    expect(points).toHaveLength(Math.max(september.length, august.length));
    expect(points[0]?.detail).toBe("Sep 1–6, 2026");
    expect(points[0]?.label).toBe("Sep 1");
    expect(points[0]?.baselineDetail).toBe("Aug 1–2, 2026");
    expect(points[0]?.current).toBeGreaterThan(0);
    expect(points[0]?.baseline).toBe(0);
    expect(points.slice(0, september.length).every((point) => point.detail.startsWith("Sep"))).toBe(true);
    const trail = points.find((point) => point.baselineDetail === "Aug 31, 2026");
    expect(trail?.detail).toBe("");
    expect(trail?.current).toBe(0);
    expect(trail?.baseline).toBeGreaterThan(0);
    expect(points.some((point) => point.detail.includes("Aug 31–Sep") || point.detail.includes("Aug 31 – Sep"))).toBe(
      false,
    );
    expect(points.some((point) => point.baselineDetail === "Aug 24–30, 2026" && point.detail === "Sep 28–30, 2026")).toBe(
      true,
    );
    const volume = septemberReport?.cards.find((card) => card.id === "volume");
    expect(volume?.current).toBe(200);
    expect(volume?.baseline).toBe(1000);
  });

  it("splits a mixed session’s time across lower and upper by set count", () => {
    const mixed = session({
      performedAt: zonedCivilToUtc(2026, 10, 20, TZ),
      elapsedSeconds: 1000,
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
    });
    const lower = summarizePeriod({ sessions: [mixed], outside: [], focus: "lower", displayUnit: "lb" });
    const upper = summarizePeriod({ sessions: [mixed], outside: [], focus: "upper", displayUnit: "lb" });
    expect(lower.trainingSeconds).toBe(667);
    expect(upper.trainingSeconds).toBe(333);
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
    expect(form).toContain("Round type (optional)");
    const bars = fs.readFileSync(path.join(process.cwd(), "src/components/report/CompareBars.tsx"), "utf8");
    expect(bars).toContain("report-sr");
    expect(bars).not.toContain("? LIME : LIME");
    expect(bars).toContain("#5ee0ff");
    expect(form).toContain(">Unspecified</option>");
    expect(form).toContain(">Amateur</option>");
    expect(form).toContain(">Pro</option>");
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(text).not.toMatch(/\bbout\b/i);
    }
  });
});

describe("period strength loads", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses the heaviest load logged in the week or month, not a later all-time best", async () => {
    const user = await makeUser("period-loads@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: TZ, preferredUnits: "lb" },
    });
    async function log(year: number, month: number, day: number, exerciseName: string, loadValue: number) {
      await prisma.workoutSession.create({
        data: {
          userId: user.id,
          title: exerciseName,
          performedAt: zonedCivilToUtc(year, month, day, TZ),
          status: "complete",
          sets: {
            create: [{ exerciseName, setNumber: 1, reps: 5, loadValue, loadUnit: "lb", completed: true }],
          },
        },
      });
    }
    await log(2026, 9, 30, "Goblet squat", 200);
    await log(2026, 10, 6, "Goblet squat", 225);
    await log(2026, 10, 7, "DB bench press", 135);
    await log(2026, 10, 20, "Goblet squat", 300);
    await log(2026, 10, 21, "DB bench press", 135);

    const oct5 = await getWeeklyProgressReport(user.id, zonedCivilToUtc(2026, 10, 7, TZ));
    expect(oct5.strengthNote).toContain("Goblet squat 225 lb");
    expect(oct5.strengthNote).toContain("DB bench press 135 lb");
    expect(oct5.strengthNote).not.toContain("300");
    expect(oct5.strengthNote).not.toMatch(/No load logged/);

    const oct19 = await getWeeklyProgressReport(user.id, zonedCivilToUtc(2026, 10, 21, TZ));
    expect(oct19.strengthNote).toContain("DB bench press 135 lb");
    expect(oct19.strengthNote).toContain("Goblet squat 300 lb");
    expect(oct19.strengthNote).not.toContain("225");

    const sep28 = await getWeeklyProgressReport(user.id, zonedCivilToUtc(2026, 9, 30, TZ));
    expect(sep28.strengthNote).toContain("Goblet squat 200 lb");
    expect(sep28.strengthNote).not.toContain("225");
    expect(sep28.strengthNote).not.toContain("300");

    const october = await strengthNoteForPeriod({
      userId: user.id,
      from: zonedCivilToUtc(2026, 10, 1, TZ),
      endExclusive: zonedCivilToUtc(2026, 11, 1, TZ),
      displayUnit: "lb",
      period: "month",
    });
    expect(october).toContain("Goblet squat 300 lb");
    expect(october).toContain("DB bench press 135 lb");
    expect(october).not.toContain("200");

    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Partial bench",
        performedAt: zonedCivilToUtc(2026, 10, 8, TZ),
        status: "partial",
        sets: {
          create: [
            { exerciseName: "DB row", setNumber: 1, reps: 5, loadValue: 95, loadUnit: "lb", completed: true },
            { exerciseName: "Goblet squat", setNumber: 1, reps: 5, loadValue: 400, loadUnit: "lb", completed: false },
          ],
        },
      },
    });
    const withPartial = await getWeeklyProgressReport(user.id, zonedCivilToUtc(2026, 10, 7, TZ));
    expect(withPartial.strengthNote).toContain("DB row 95 lb");
    expect(withPartial.strengthNote).toContain("Goblet squat 225 lb");
    expect(withPartial.strengthNote).not.toContain("400");
  });
});

describe("bounded history lists", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("limits the sparring list to the default date range", async () => {
    const user = await makeUser("sparring-range@example.com");
    const recent = dayKey(new Date(), APP_TIMEZONE);
    const old = dayKey(addZonedDays(new Date(), -(SPARRING_LOG_LIST_DAYS + 21), APP_TIMEZONE), APP_TIMEZONE);
    await prisma.outsideSessionLog.create({
      data: { userId: user.id, dateKey: recent, rounds: 2, minutesPerRound: 3, roundType: "pro" },
    });
    await prisma.outsideSessionLog.create({
      data: { userId: user.id, dateKey: old, rounds: 4, minutesPerRound: 3, roundType: "amateur" },
    });
    const listed = await listSparringLogs(user.id);
    expect(listed.map((row) => row.dateKey)).toEqual([recent]);
  });

  it("limits progress session loading to the requested start date", async () => {
    const user = await makeUser("progress-range@example.com");
    const since = new Date(Date.now() - PROGRESS_HISTORY_DAYS * 86_400_000);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Recent",
        performedAt: new Date(),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 50, completed: true }] },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Old",
        performedAt: new Date(since.getTime() - 7 * 86_400_000),
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, reps: 5, loadValue: 40, completed: true }] },
      },
    });
    const windowed = await listWorkoutSessionsForUser(user.id, { since });
    expect(windowed.map((row) => row.title)).toEqual(["Recent"]);
    const byDays = await listWorkoutSessionsForUser(user.id, { recentDays: PROGRESS_HISTORY_DAYS });
    expect(byDays.map((row) => row.title)).toEqual(["Recent"]);
    const all = await listWorkoutSessionsForUser(user.id);
    expect(all.map((row) => row.title).sort()).toEqual(["Old", "Recent"]);
  });
});

const loggedLift = {
  exerciseName: "Goblet squat",
  reps: 5,
  loadValue: 50,
  loadUnit: "lb",
  logMode: "load_reps",
  durationSeconds: null,
  completed: true,
  prescriptionKey: "",
};

describe("report performance", () => {
  it("groups a sparse archive once and ignores a compare before the window", () => {
    const origin = zonedCivilToUtc(2025, 5, 19, TZ);
    const sessions = Array.from({ length: 9 }, (_, index) =>
      session({
        id: `sparse-${index}`,
        performedAt: addZonedDays(origin, index * 9 * 7, TZ),
        sets: [{ ...loggedLift, loadValue: 40 + index }],
      }),
    );
    sessions.push(
      session({
        id: "ancient",
        performedAt: zonedCivilToUtc(2015, 3, 10, TZ),
        sets: [loggedLift],
      }),
    );
    const data = history({ sessions });
    const started = performance.now();
    const rows = buildWeekArchive(data);
    const report = buildPeriodReport(data, "week", "2026-10-19", "2015-03-09", "all");
    expect(performance.now() - started).toBeLessThan(500);
    expect(rows).toHaveLength(10);
    expect(rows.some((row) => row.weekStartKey === "2015-03-09")).toBe(false);
    expect(rows.filter((row) => row.sessions === 0).map((row) => row.weekStartKey)).toEqual([
      currentWeekKey(NOW, TZ),
    ]);
    expect(report?.baselineKey).toBe("2026-10-12");
    expect(report?.baselineKey).not.toBe("2015-03-09");
  });

  it("counts a long streak once instead of rebuilding the week plan per day", () => {
    const end = zonedCivilToUtc(2026, 10, 20, TZ);
    const sessions = Array.from({ length: 400 }, (_, index) =>
      session({
        id: `day-${index}`,
        performedAt: addZonedDays(end, -index, TZ),
        sets: [loggedLift],
      }),
    );
    const data = history({ sessions });
    const started = performance.now();
    const streak = streakAt(data, NOW);
    expect(performance.now() - started).toBeLessThan(500);
    expect(streak).toBeGreaterThan(20);
    const rows = buildWeekArchive(data);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.length).toBeLessThan(80);
  });

  it("matches the scheduled-day streak as of the period end", () => {
    const sessions = [
      session({ id: "mon", performedAt: zonedCivilToUtc(2026, 10, 19, TZ), sets: [loggedLift] }),
      session({ id: "tue", performedAt: zonedCivilToUtc(2026, 10, 20, TZ), sets: [loggedLift] }),
    ];
    const data = history({ sessions });
    const keys = sessions.map((row) => sessionCompletionDay(row, TZ));
    expect(streakAt(data, NOW)).toBe(currentTrainingStreak(keys, data.prefs, NOW, TZ));
  });

  it("matches the scheduled-day streak across the November daylight change", () => {
    const end = zonedCivilToUtc(2026, 11, 3, TZ);
    const sessions = Array.from({ length: 21 }, (_, index) =>
      session({
        id: `dst-${index}`,
        performedAt: addZonedDays(end, -index, TZ),
        sets: [loggedLift],
      }),
    );
    const data = history({ sessions, now: end });
    const keys = sessions.map((row) => sessionCompletionDay(row, TZ));
    expect(streakAt(data, end)).toBe(currentTrainingStreak(keys, data.prefs, end, TZ));
  });
});
