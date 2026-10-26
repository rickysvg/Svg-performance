import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getHomeToday } from "@/lib/home";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { getTodayGuide } from "@/lib/today";
import { presentVipUpsell } from "@/lib/vip-store";
import { shouldShowThirdWorkoutCard } from "@/lib/trial";
import { PROGRESS_SESSION_TAKE, listRecentSessionsForUser } from "@/lib/workouts";
import { getLatestBodyMetricsForUser, listBodyMetricsForUser } from "@/lib/body-metrics";
import { countProgressPhotosForUser } from "@/lib/progress-photos";
import { getNutritionSummaryForDay, getRecentNutritionDays } from "@/lib/nutrition";
import { getProgressHeartTiles } from "@/lib/heart";
import { sparringLogsForWeek, sparringTrend } from "@/lib/outside-log";
import { getPersonalRecordsForUser } from "@/lib/records";
import { getCompanionProgress } from "@/lib/progress-companion";

const NOW = new Date("2026-10-26T18:00:00.000Z");
const TZ = "America/Denver";

async function loadHome(userId: string) {
  await Promise.all([
    getHomeToday(userId, NOW, TZ),
    getTodayGuide(userId, NOW, TZ),
    getHomeTelemetry({ userId, timeZone: TZ, now: NOW }),
    shouldShowThirdWorkoutCard(userId, "member_access", NOW),
  ]);
  await presentVipUpsell(userId, NOW);
}

async function loadProgress(userId: string) {
  await Promise.all([
    listRecentSessionsForUser(userId, PROGRESS_SESSION_TAKE),
    getLatestBodyMetricsForUser(userId),
    listBodyMetricsForUser(userId, "weight"),
    countProgressPhotosForUser(userId),
    getNutritionSummaryForDay(userId, NOW, TZ),
    getRecentNutritionDays(userId, 7, NOW, TZ),
    getProgressHeartTiles(userId),
    sparringLogsForWeek(userId, NOW, TZ),
    sparringTrend(userId, 16),
  ]);
  await getHomeTelemetry({ userId, timeZone: TZ, now: NOW });
  const records = await getPersonalRecordsForUser(userId, "lb", NOW, TZ);
  const companion = await getCompanionProgress(userId, "lb", NOW);
  return { records, companion };
}

describe("home and progress with a 2015 session", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stays under 500ms of server time", async () => {
    await resetDatabase();
    const user = await makeUser("old-history@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        timeZone: TZ,
        onboardingCompletedAt: new Date("2015-03-01T00:00:00.000Z"),
        planChoiceAt: new Date("2015-03-01T00:00:00.000Z"),
        trainingFocus: "sc_only",
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "2015 squat",
        performedAt: new Date("2015-06-15T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Back squat",
              setNumber: 1,
              sortOrder: 0,
              reps: 5,
              loadValue: 225,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Recent squat",
        performedAt: new Date("2026-10-24T18:00:00.000Z"),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Back squat",
              setNumber: 1,
              sortOrder: 0,
              reps: 5,
              loadValue: 135,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    await prisma.bodyMetric.create({
      data: {
        userId: user.id,
        kind: "weight",
        value: 190,
        unit: "lb",
        recordedAt: new Date("2015-06-15T18:00:00.000Z"),
      },
    });
    await prisma.nutritionEntry.create({
      data: {
        userId: user.id,
        eatenAt: new Date("2015-06-15T18:00:00.000Z"),
        mealType: "lunch",
        name: "Old plate",
        calories: 400,
        proteinG: 20,
        carbsG: 40,
        fatG: 10,
      },
    });

    await loadHome(user.id);
    await loadProgress(user.id);

    const homeStarted = performance.now();
    await loadHome(user.id);
    const homeMs = performance.now() - homeStarted;

    const progressStarted = performance.now();
    const progress = await loadProgress(user.id);
    const progressMs = performance.now() - progressStarted;

    const squat = progress.records.loadRecords.find((row) => row.exerciseName === "Back squat");
    expect(squat?.bestLoad).toBe(225);
    const companionSquat = progress.companion.records.find((row) => row.exerciseName === "Back squat");
    expect(companionSquat?.primary.kind).toBe("heaviest");
    expect(companionSquat?.primary.value).toBe(225);
    expect(progress.companion.streak.current).toBeGreaterThanOrEqual(0);
    expect(homeMs).toBeLessThan(500);
    expect(progressMs).toBeLessThan(500);
  });
});
