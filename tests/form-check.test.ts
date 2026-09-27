import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { canUseFeature } from "@/lib/entitlements";
import { startTrialForUser } from "@/lib/trial";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import {
  createFormCheckForUser,
  formCheckUsage,
  markFormCheckFeedbackSeen,
  presentFormCheckForAthlete,
  readFormCheckForActor,
  saveFormCheckFeedback,
  unseenFormCheckCount,
} from "@/lib/form-check";
import { formCheckStorageMode } from "@/lib/form-check-storage";

function tinyMp4() {
  const bytes = new Uint8Array(16);
  bytes[3] = 16;
  bytes[4] = 0x66;
  bytes[5] = 0x74;
  bytes[6] = 0x79;
  bytes[7] = 0x70;
  bytes[8] = 0x69;
  bytes[9] = 0x73;
  bytes[10] = 0x6f;
  bytes[11] = 0x6d;
  return bytes;
}

async function submit(
  userId: string,
  now: Date,
  timeZone: string,
  movementId = "jab-cross",
) {
  return createFormCheckForUser({
    userId,
    movementId,
    customMovement: "",
    note: "Look at the hook.",
    durationSeconds: 12,
    bytes: tinyMp4(),
    claimedType: "video/mp4",
    now,
    timeZone,
  });
}

describe("form check gating, limit, and review", () => {
  let dir = "";

  beforeEach(async () => {
    await resetDatabase();
    dir = await mkdtemp(path.join(os.tmpdir(), "svg-form-checks-"));
    process.env.FORM_CHECK_DIR = dir;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    delete process.env.ADMIN_EMAILS;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("locks free members and opens form check on a trial or Performance plan", async () => {
    expect(formCheckStorageMode()).toBe("local");
    const free = await makeUser("form-free@example.com");
    expect(await canUseFeature(free.id, "form_check")).toBe(false);
    await expect(submit(free.id, new Date("2026-09-10T12:00:00.000Z"), "UTC")).rejects.toMatchObject({
      code: "PLAN",
      message: expect.stringMatching(/Paid plans coming soon/),
    });
    expect(await prisma.formCheck.count()).toBe(0);

    const trial = await makeUser("form-trial@example.com");
    await startTrialForUser(trial.id);
    const created = await submit(trial.id, new Date("2026-09-10T12:00:00.000Z"), "UTC");
    expect(created.status).toBe("submitted");
    expect(created.movement).toBe("Jab–cross");

    const ended = await makeUser("form-ended@example.com");
    await prisma.profile.update({
      where: { userId: ended.id },
      data: { trialEndsAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    await expect(submit(ended.id, new Date("2026-09-10T12:00:00.000Z"), "UTC")).rejects.toMatchObject({
      code: "PLAN",
    });

    const paid = await makeUser("form-pro@example.com");
    await prisma.subscription.create({
      data: {
        userId: paid.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
        source: "admin",
      },
    });
    expect(await canUseFeature(paid.id, "form_check")).toBe(true);
    await expect(submit(paid.id, new Date("2026-09-11T12:00:00.000Z"), "UTC")).resolves.toMatchObject({
      status: "submitted",
    });
  });

  it("allows two checks in the athlete's month and blocks the third", async () => {
    const user = await makeUser("form-limit@example.com");
    await startTrialForUser(user.id);
    const zone = "Pacific/Honolulu";
    await submit(user.id, new Date("2026-09-15T18:00:00.000Z"), zone);
    await submit(user.id, new Date("2026-09-20T18:00:00.000Z"), zone);
    const usage = await formCheckUsage(user.id, new Date("2026-09-28T18:00:00.000Z"), zone);
    expect(usage.monthKey).toBe("2026-09");
    expect(usage.remaining).toBe(0);
    await expect(submit(user.id, new Date("2026-09-28T18:00:00.000Z"), zone)).rejects.toMatchObject({
      code: "FORM_CHECK",
    });
    expect(await prisma.formCheck.count({ where: { userId: user.id } })).toBe(2);

    const next = await submit(user.id, new Date("2026-10-02T18:00:00.000Z"), zone);
    expect(next.status).toBe("submitted");
    const october = await formCheckUsage(user.id, new Date("2026-10-02T18:00:00.000Z"), zone);
    expect(october.monthKey).toBe("2026-10");
    expect(october.remaining).toBe(1);
  });

  it("counts the month in the athlete's time zone, not UTC", async () => {
    const instant = new Date("2026-10-01T01:00:00.000Z");
    const honolulu = await makeUser("form-hnl@example.com");
    const tokyo = await makeUser("form-tyo@example.com");
    await startTrialForUser(honolulu.id);
    await startTrialForUser(tokyo.id);
    await submit(honolulu.id, new Date("2026-09-15T12:00:00.000Z"), "Pacific/Honolulu");
    await submit(honolulu.id, new Date("2026-09-20T12:00:00.000Z"), "Pacific/Honolulu");

    const honoluluUsage = await formCheckUsage(honolulu.id, instant, "Pacific/Honolulu");
    const tokyoUsage = await formCheckUsage(tokyo.id, instant, "Asia/Tokyo");
    expect(honoluluUsage.monthKey).toBe("2026-09");
    expect(honoluluUsage.remaining).toBe(0);
    expect(tokyoUsage.monthKey).toBe("2026-10");
    expect(tokyoUsage.remaining).toBe(2);

    await expect(submit(honolulu.id, instant, "Pacific/Honolulu")).rejects.toMatchObject({
      code: "FORM_CHECK",
    });
    await expect(submit(tokyo.id, instant, "Asia/Tokyo")).resolves.toMatchObject({
      status: "submitted",
    });
  });

  it("keeps clips private and signs reviewed notes as SVG Coach", async () => {
    const athlete = await makeUser("form-athlete@example.com");
    const stranger = await makeUser("form-stranger@example.com");
    const coach = await makeUser("form-coach@example.com", false, "coach");
    const admin = await makeUser("form-admin@example.com", false, "admin");
    const ricky = await makeUser("ricky@svg.example");
    await startTrialForUser(athlete.id);
    process.env.ADMIN_EMAILS = "Ricky@SVG.example, other@nope.com";
    expect(isFormCheckReviewer(ricky)).toBe(true);
    expect(isFormCheckReviewer(coach)).toBe(false);
    expect(isFormCheckReviewer(admin)).toBe(true);

    const row = await submit(athlete.id, new Date("2026-09-10T12:00:00.000Z"), "UTC");
    await expect(readFormCheckForActor(row.id, stranger)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(readFormCheckForActor(row.id, coach)).rejects.toBeInstanceOf(ForbiddenError);
    const own = await readFormCheckForActor(row.id, athlete);
    expect(own.bytes[4]).toBe(0x66);
    await expect(readFormCheckForActor(row.id, admin)).resolves.toMatchObject({
      row: { id: row.id },
    });
    await expect(readFormCheckForActor(row.id, ricky)).resolves.toMatchObject({
      row: { id: row.id },
    });

    await expect(
      saveFormCheckFeedback({
        actor: stranger,
        checkId: row.id,
        feedback: "Should not save.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      saveFormCheckFeedback({
        actor: coach,
        checkId: row.id,
        feedback: "Coaches do not review this queue.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await saveFormCheckFeedback({
      actor: ricky,
      checkId: row.id,
      feedback: "Chin down on the hook and bring the rear hand home.",
      now: new Date("2026-09-12T12:00:00.000Z"),
    });
    const saved = await prisma.formCheck.findUniqueOrThrow({ where: { id: row.id } });
    const presented = presentFormCheckForAthlete(saved);
    expect(presented.statusLabel).toBe("Reviewed");
    expect(presented.reviewerLabel).toBe("SVG Coach");
    expect(presented.feedback).toMatch(/Chin down/);
    expect(JSON.stringify(presented).toLowerCase()).not.toContain("ricky");
    expect(JSON.stringify(presented)).not.toContain(ricky.email);
    expect(await unseenFormCheckCount(athlete.id)).toBe(1);
    await markFormCheckFeedbackSeen(athlete.id);
    expect(await unseenFormCheckCount(athlete.id)).toBe(0);
  });

  it("rejects a clip longer than 60 seconds", async () => {
    const user = await makeUser("form-long@example.com");
    await startTrialForUser(user.id);
    await expect(
      createFormCheckForUser({
        userId: user.id,
        movementId: "sprawl",
        customMovement: "",
        note: "",
        durationSeconds: 61,
        bytes: tinyMp4(),
        claimedType: "video/mp4",
        now: new Date("2026-09-10T12:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "FORM_CHECK" });
    expect(await prisma.formCheck.count()).toBe(0);
  });
});
