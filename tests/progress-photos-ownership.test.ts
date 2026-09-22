import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  createProgressPhotoForUser,
  deleteProgressPhotoForUser,
  getProgressPhotoForUser,
  listProgressPhotosForUser,
  readProgressPhotoFileForUser,
  updateProgressPhotoForUser,
  validateProgressPhotoBytes,
} from "@/lib/progress-photos";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("progress photo ownership and type checks", () => {
  let tempDir = "";

  beforeEach(async () => {
    await resetDatabase();
    tempDir = mkdtempSync(path.join(os.tmpdir(), "svg-photos-"));
    process.env.PROGRESS_PHOTO_DIR = tempDir;
  });

  afterAll(async () => {
    delete process.env.PROGRESS_PHOTO_DIR;
    await prisma.$disconnect();
  });

  it("lets the owner read and edit, and blocks user B from the file and row", async () => {
    const userA = await makeUser("photo-own-a@example.com");
    const userB = await makeUser("photo-own-b@example.com");
    const photo = await createProgressPhotoForUser(userA.id, {
      bytes: PNG_1X1,
      claimedType: "image/png",
      caption: "week 1",
      recordedAt: new Date("2026-09-21T12:00:00"),
    });

    const owned = await getProgressPhotoForUser(photo.id, userA.id);
    expect(owned.caption).toBe("week 1");
    expect(owned.mimeType).toBe("image/png");
    const file = await readProgressPhotoFileForUser(photo.id, userA.id);
    expect(file.bytes.byteLength).toBe(PNG_1X1.byteLength);

    await expect(getProgressPhotoForUser(photo.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(readProgressPhotoFileForUser(photo.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(deleteProgressPhotoForUser(photo.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      updateProgressPhotoForUser(photo.id, userB.id, {
        caption: "stolen",
        recordedAt: new Date("2026-09-22T12:00:00"),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await listProgressPhotosForUser(userB.id)).toHaveLength(0);
    expect(await listProgressPhotosForUser(userA.id)).toHaveLength(1);

    const updated = await updateProgressPhotoForUser(photo.id, userA.id, {
      caption: "week 2",
      recordedAt: new Date("2026-09-22T12:00:00"),
    });
    expect(updated.caption).toBe("week 2");

    await deleteProgressPhotoForUser(photo.id, userA.id);
    expect(await listProgressPhotosForUser(userA.id)).toHaveLength(0);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects gif/pdf-looking bytes and oversized files", () => {
    expect(() => validateProgressPhotoBytes(Buffer.from("GIF89a...."))).toThrow(AppError);
    expect(() =>
      validateProgressPhotoBytes(Buffer.from("%PDF-1.4"), "application/pdf"),
    ).toThrow(AppError);
    const huge = Buffer.alloc(5 * 1024 * 1024 + 20, 0xff);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    expect(() => validateProgressPhotoBytes(huge, "image/jpeg")).toThrow(AppError);
    expect(validateProgressPhotoBytes(PNG_1X1, "image/png")).toBe("image/png");
  });

  it("does not let a coach read another member's photo URL helper", async () => {
    const member = await makeUser("photo-member@example.com");
    const coach = await makeUser("photo-coach@example.com", false, "coach");
    const photo = await createProgressPhotoForUser(member.id, {
      bytes: PNG_1X1,
      claimedType: "image/png",
      caption: "private",
      recordedAt: new Date("2026-09-21T12:00:00"),
    });
    await expect(readProgressPhotoFileForUser(photo.id, coach.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    rmSync(tempDir, { recursive: true, force: true });
  });
});
