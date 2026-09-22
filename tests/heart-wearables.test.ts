import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  analyzeHeartRate,
  createRestingSampleForUser,
  createWorkoutHrForUser,
  deleteRestingSampleForUser,
  deleteWorkoutHrForUser,
  getHeartDeviceStatus,
  getProgressHeartTiles,
  getRestingSampleForUser,
  getWorkoutHrForUser,
  importHeartCsvForUser,
  loadDemoHeartDataForUser,
  parseHeartCsv,
  syncPolarForUser,
  zoneIndexForBpm,
  zonesFromSamples,
} from "@/lib/heart";
import { isPolarConfigured, parseIsoDurationSeconds, parsePolarZones, savePolarConnection } from "@/lib/polar";
import { createBodyMetricForUser } from "@/lib/body-metrics";

describe("heart rate wearables", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.POLAR_CLIENT_ID;
    delete process.env.POLAR_CLIENT_SECRET;
    delete process.env.POLAR_REDIRECT_URI;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks user B from reading or deleting user A's resting and workout HR", async () => {
    const userA = await makeUser("hr-a@example.com");
    const userB = await makeUser("hr-b@example.com");
    const resting = await createRestingSampleForUser(userA.id, {
      bpm: 58,
      recordedAt: new Date("2026-09-20T07:00:00"),
      source: "manual",
    });
    const workout = await createWorkoutHrForUser(userA.id, {
      startedAt: new Date("2026-09-20T10:00:00"),
      endedAt: new Date("2026-09-20T10:45:00"),
      avgBpm: 148,
      maxBpm: 178,
      source: "manual",
      zone1Seconds: 120,
      zone2Seconds: 300,
      zone3Seconds: 600,
      zone4Seconds: 400,
      zone5Seconds: 100,
    });

    await expect(getRestingSampleForUser(resting.id, userA.id)).resolves.toMatchObject({
      bpm: 58,
      userId: userA.id,
    });
    await expect(getWorkoutHrForUser(workout.id, userA.id)).resolves.toMatchObject({
      avgBpm: 148,
      userId: userA.id,
    });
    await expect(getRestingSampleForUser(resting.id, userB.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getWorkoutHrForUser(workout.id, userB.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteRestingSampleForUser(resting.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(deleteWorkoutHrForUser(workout.id, userB.id)).rejects.toBeInstanceOf(ForbiddenError);

    const stillResting = await prisma.hrRestingSample.findUnique({ where: { id: resting.id } });
    const stillWorkout = await prisma.hrWorkoutSession.findUnique({ where: { id: workout.id } });
    expect(stillResting?.userId).toBe(userA.id);
    expect(stillWorkout?.userId).toBe(userA.id);
  });

  it("never reports Polar or Apple Watch connected without keys and a token", async () => {
    const user = await makeUser("hr-status@example.com");
    expect(isPolarConfigured()).toBe(false);
    const empty = await getHeartDeviceStatus(user.id);
    expect(empty.polarConfigured).toBe(false);
    expect(empty.polarConnected).toBe(false);
    expect(empty.appleWatchConnected).toBe(false);

    await prisma.polarConnection.create({
      data: {
        userId: user.id,
        polarUserId: "99",
        accessToken: "leftover-token",
      },
    });
    const leftover = await getHeartDeviceStatus(user.id);
    expect(leftover.polarConfigured).toBe(false);
    expect(leftover.polarConnected).toBe(false);
    expect(leftover.appleWatchConnected).toBe(false);

    process.env.POLAR_CLIENT_ID = "id";
    process.env.POLAR_CLIENT_SECRET = "secret";
    process.env.POLAR_REDIRECT_URI = "http://localhost:3000/api/polar/callback";
    expect(isPolarConfigured()).toBe(true);
    const keysNoTokenUser = await makeUser("hr-keys@example.com");
    const keysOnly = await getHeartDeviceStatus(keysNoTokenUser.id);
    expect(keysOnly.polarConfigured).toBe(true);
    expect(keysOnly.polarConnected).toBe(false);
    expect(keysOnly.appleWatchConnected).toBe(false);

    const connected = await getHeartDeviceStatus(user.id);
    expect(connected.polarConfigured).toBe(true);
    expect(connected.polarConnected).toBe(true);
    expect(connected.appleWatchConnected).toBe(false);
  });

  it("computes zones from sample fixtures using % of max HR", () => {
    expect(zoneIndexForBpm(100, 190)).toBe(1);
    expect(zoneIndexForBpm(120, 190)).toBe(2);
    expect(zoneIndexForBpm(140, 190)).toBe(3);
    expect(zoneIndexForBpm(165, 190)).toBe(4);
    expect(zoneIndexForBpm(180, 190)).toBe(5);

    const start = new Date("2026-09-20T10:00:00Z");
    const samples = [
      { at: start, bpm: 110 },
      { at: new Date(start.getTime() + 60_000), bpm: 130 },
      { at: new Date(start.getTime() + 120_000), bpm: 150 },
      { at: new Date(start.getTime() + 180_000), bpm: 170 },
      { at: new Date(start.getTime() + 240_000), bpm: 185 },
    ];
    const zones = zonesFromSamples(samples, 190);
    expect(zones.zone1Seconds).toBe(60);
    expect(zones.zone2Seconds).toBe(60);
    expect(zones.zone3Seconds).toBe(60);
    expect(zones.zone4Seconds).toBe(60);
    expect(zones.zone5Seconds).toBe(60);
  });

  it("builds RHR trend and high-zone insights from fixtures", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const resting = [
      { bpm: 62, recordedAt: new Date("2026-08-25T12:00:00Z"), source: "manual" },
      { bpm: 61, recordedAt: new Date("2026-08-28T12:00:00Z"), source: "manual" },
      { bpm: 60, recordedAt: new Date("2026-09-01T12:00:00Z"), source: "manual" },
      { bpm: 54, recordedAt: new Date("2026-09-18T12:00:00Z"), source: "manual" },
      { bpm: 53, recordedAt: new Date("2026-09-20T12:00:00Z"), source: "manual" },
      { bpm: 52, recordedAt: new Date("2026-09-21T12:00:00Z"), source: "manual" },
    ];
    const workouts = [
      {
        startedAt: new Date("2026-09-20T10:00:00Z"),
        avgBpm: 160,
        maxBpm: 180,
        source: "polar",
        zone1Seconds: 60,
        zone2Seconds: 60,
        zone3Seconds: 60,
        zone4Seconds: 400,
        zone5Seconds: 400,
      },
    ];
    const analysis = analyzeHeartRate({ resting, workouts }, now);
    expect(analysis.rhrTrend).toBe("down");
    expect(analysis.insights.some((line) => line.includes("trending down"))).toBe(true);
    expect(analysis.insights.some((line) => line.includes("higher heart-rate zones"))).toBe(true);
    expect(analysis.disclaimer).toContain("not medical advice");
    expect(analysis.lastWorkout?.avgBpm).toBe(160);
    expect(analysis.weeklyZones.zone4 + analysis.weeklyZones.zone5).toBeGreaterThanOrEqual(40);
  });

  it("imports CSV as source=import and updates Progress HR tiles", async () => {
    const user = await makeUser("hr-import@example.com");
    const csv = [
      "type,recordedAt,bpm",
      "resting,2026-09-20T07:00:00,57",
      "type,startedAt,endedAt,avgBpm,maxBpm,zone1Seconds,zone2Seconds,zone3Seconds,zone4Seconds,zone5Seconds",
      "workout,2026-09-20T10:00:00,2026-09-20T10:40:00,141,172,100,200,400,300,80",
    ].join("\n");
    const parsed = parseHeartCsv(csv);
    expect(parsed.resting).toHaveLength(1);
    expect(parsed.workouts).toHaveLength(1);
    await importHeartCsvForUser(user.id, csv);
    const tiles = await getProgressHeartTiles(user.id);
    expect(tiles.rhr?.value).toBe("57 bpm");
    expect(tiles.rhr?.hint).toContain("Imported");
    expect(tiles.lastWorkout?.value).toBe("141 / 172 bpm");
    expect(tiles.lastWorkout?.hint).toContain("Imported");
    expect(tiles.lastWorkout?.hint.toLowerCase()).not.toContain("apple watch connected");
  });

  it("loads DEMO samples labeled demo, never as Polar/Apple connected", async () => {
    const user = await makeUser("hr-demo@example.com");
    await loadDemoHeartDataForUser(user.id, new Date("2026-09-22T12:00:00Z"));
    const tiles = await getProgressHeartTiles(user.id);
    expect(tiles.rhr?.source).toBe("demo");
    expect(tiles.rhr?.hint).toBe("DEMO sample");
    expect(tiles.lastWorkout?.source).toBe("demo");
    const status = await getHeartDeviceStatus(user.id);
    expect(status.polarConnected).toBe(false);
    expect(status.appleWatchConnected).toBe(false);
  });

  it("prefers HR samples over typed body-metric resting HR on Progress tiles", async () => {
    const user = await makeUser("hr-tiles@example.com");
    await createBodyMetricForUser(user.id, {
      kind: "restingHr",
      value: 70,
      unit: "bpm",
      recordedAt: new Date("2026-09-10T08:00:00"),
    });
    const empty = await getProgressHeartTiles(user.id);
    expect(empty.rhr?.value).toContain("70");
    expect(empty.rhr?.hint).toBe("Typed by you");

    await createRestingSampleForUser(user.id, {
      bpm: 55,
      recordedAt: new Date("2026-09-21T07:00:00"),
      source: "polar",
    });
    const filled = await getProgressHeartTiles(user.id);
    expect(filled.rhr?.value).toBe("55 bpm");
    expect(filled.rhr?.hint).toBe("From Polar");
  });

  it("syncs Polar exercises and nightly recharge through a mock client", async () => {
    const user = await makeUser("hr-polar@example.com");
    process.env.POLAR_CLIENT_ID = "id";
    process.env.POLAR_CLIENT_SECRET = "secret";
    process.env.POLAR_REDIRECT_URI = "http://localhost:3000/api/polar/callback";
    await savePolarConnection(user.id, {
      accessToken: "token-a",
      tokenType: "Bearer",
      polarUserId: "77",
      expiresAt: null,
    });

    await expect(syncPolarForUser(user.id, async () => ({ status: 503, body: {} }))).rejects.toMatchObject({
      code: "POLAR",
    });

    const result = await syncPolarForUser(user.id, async (url) => {
      if (url.includes("/v3/exercises")) {
        return {
          status: 200,
          body: {
            exercises: [
              {
                id: "ex-1",
                start_time: "2026-09-20T10:00:00",
                duration: "PT45M",
                heart_rate: { average: 150, maximum: 175 },
                heart_rate_zones: [
                  { index: 1, "in-zone": "PT5M" },
                  { index: 2, "in-zone": "PT10M" },
                  { index: 3, "in-zone": "PT15M" },
                  { index: 4, "in-zone": "PT10M" },
                  { index: 5, "in-zone": "PT5M" },
                ],
              },
            ],
          },
        };
      }
      if (url.includes("nightly-recharge")) {
        return {
          status: 200,
          body: { recharges: [{ date: "2026-09-21", heart_rate_avg: 54 }] },
        };
      }
      return { status: 404, body: {} };
    });
    expect(result.workouts).toBe(1);
    expect(result.resting).toBe(1);
    const tiles = await getProgressHeartTiles(user.id);
    expect(tiles.rhr?.value).toBe("54 bpm");
    expect(tiles.rhr?.source).toBe("polar");
    expect(tiles.lastWorkout?.source).toBe("polar");
    expect(parseIsoDurationSeconds("PT1H2M3S")).toBe(3723);
    expect(parsePolarZones([{ index: 4, "in-zone": "PT2M" }])[3]).toBe(120);
  });

  it("refuses Polar sync when keys are missing or there is no token", async () => {
    const user = await makeUser("hr-nosync@example.com");
    await expect(syncPolarForUser(user.id)).rejects.toMatchObject({ code: "POLAR" });
    process.env.POLAR_CLIENT_ID = "id";
    process.env.POLAR_CLIENT_SECRET = "secret";
    process.env.POLAR_REDIRECT_URI = "http://localhost:3000/api/polar/callback";
    await expect(syncPolarForUser(user.id)).rejects.toMatchObject({
      message: "Polar is not connected.",
    });
  });
});
