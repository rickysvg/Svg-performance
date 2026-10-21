import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  createBodyMetricForUser,
  deleteBodyMetricForUser,
  deletePhotoPlaceholderForUser,
  getBodyMetricForUser,
  getPhotoPlaceholderForUser,
  listBodyMetricsForUser,
  optionalBodyFatPercent,
  recordBodyFatAlongsideTodayWeight,
  recordWeightEntryForUser,
  upsertPhotoPlaceholderForUser,
} from "@/lib/body-metrics";

describe("body metric and photo placeholder ownership", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks user B from reading or deleting user A's weight log", async () => {
    const userA = await makeUser("metric-a@example.com");
    const userB = await makeUser("metric-b@example.com");
    const metric = await createBodyMetricForUser(userA.id, {
      kind: "weight",
      value: 185,
      unit: "lb",
      recordedAt: new Date("2026-09-21T08:00:00"),
    });

    const owned = await getBodyMetricForUser(metric.id, userA.id);
    expect(owned.value).toBe(185);
    expect(owned.userId).toBe(userA.id);

    await expect(getBodyMetricForUser(metric.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(deleteBodyMetricForUser(metric.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const still = await listBodyMetricsForUser(userA.id, "weight");
    expect(still).toHaveLength(1);
    expect(still[0].id).toBe(metric.id);
  });

  it("blocks user B from reading or clearing user A's photo placeholder", async () => {
    const userA = await makeUser("photo-a@example.com");
    const userB = await makeUser("photo-b@example.com");
    const photo = await upsertPhotoPlaceholderForUser(userA.id, {
      slot: "front",
      caption: "week 1",
      recordedAt: new Date("2026-09-21"),
    });

    const owned = await getPhotoPlaceholderForUser(photo.id, userA.id);
    expect(owned.slot).toBe("front");
    expect(owned.caption).toBe("week 1");

    await expect(getPhotoPlaceholderForUser(photo.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(deletePhotoPlaceholderForUser(photo.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("stores optional body fat alongside a weigh-in", async () => {
    const user = await makeUser("weigh-fat@example.com");
    const recordedAt = new Date("2026-10-21T15:00:00.000Z");
    await recordWeightEntryForUser(user.id, {
      value: 185,
      unit: "lb",
      recordedAt,
      bodyFatPercent: 12.5,
    });
    await recordWeightEntryForUser(user.id, {
      value: 184,
      unit: "lb",
      recordedAt: new Date("2026-10-20T15:00:00.000Z"),
    });

    const rows = await listBodyMetricsForUser(user.id);
    const fat = rows.filter((row) => row.kind === "bodyFat");
    const weights = rows.filter((row) => row.kind === "weight");
    expect(weights).toHaveLength(2);
    expect(fat).toHaveLength(1);
    expect(fat[0]?.value).toBe(12.5);
    expect(fat[0]?.unit).toBe("percent");
    expect(fat[0]?.recordedAt.toISOString()).toBe(recordedAt.toISOString());
    expect(optionalBodyFatPercent("")).toBeNull();
    expect(optionalBodyFatPercent("  ")).toBeNull();
    expect(optionalBodyFatPercent("18.26")).toBe(18.3);
    expect(() => optionalBodyFatPercent("80")).toThrow(/70/);
  });

  it("stores a home body-fat entry on today's weigh-in", async () => {
    const user = await makeUser("home-fat-today@example.com");
    const recordedAt = new Date("2026-10-21T15:00:00.000Z");
    await recordWeightEntryForUser(user.id, {
      value: 180,
      unit: "lb",
      recordedAt,
      bodyFatPercent: 15,
    });
    const saved = await recordBodyFatAlongsideTodayWeight(user.id, {
      value: 14.2,
      timeZone: "UTC",
      now: new Date("2026-10-21T18:00:00.000Z"),
    });
    expect(saved.value).toBe(14.2);
    expect(saved.recordedAt.getTime()).toBe(recordedAt.getTime() + 1000);

    await expect(
      recordBodyFatAlongsideTodayWeight(user.id, {
        value: 13,
        timeZone: "UTC",
        now: new Date("2026-10-22T18:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BODY_METRIC" });
  });

  it("rejects fake wearable-looking kinds and empty values", async () => {
    const user = await makeUser("metric-bad@example.com");
    await expect(
      createBodyMetricForUser(user.id, {
        kind: "stepsFromWatch",
        value: 8000,
        unit: "steps",
        recordedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "BODY_METRIC" });
  });
});
