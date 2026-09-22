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
