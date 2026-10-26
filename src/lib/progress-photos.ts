import { mkdir, unlink, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";

export const PROGRESS_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROGRESS_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProgressPhotoMime = (typeof PROGRESS_PHOTO_TYPES)[number];

const EXT_BY_MIME: Record<ProgressPhotoMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PROGRESS_PHOTO_DIR = path.join(process.cwd(), "uploads", "progress-photos");

export function progressPhotoStorageMode(): "blob" | "local" {
  if (process.env.PROGRESS_PHOTO_DIR?.trim()) return "local";
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local";
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new AppError(
      "PROGRESS_PHOTO",
      "Photo storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
  return token;
}

async function loadBlob() {
  try {
    return await import("@vercel/blob");
  } catch {
    throw new AppError(
      "PROGRESS_PHOTO",
      "Photo storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
}

export function progressPhotoRoot() {
  const fromEnv = process.env.PROGRESS_PHOTO_DIR?.trim();
  if (fromEnv) return fromEnv;
  return PROGRESS_PHOTO_DIR;
}

function userDir(userId: string) {
  const fromEnv = process.env.PROGRESS_PHOTO_DIR?.trim();
  if (fromEnv) return path.join(/*turbopackIgnore: true*/ fromEnv, userId);
  return path.join(process.cwd(), "uploads", "progress-photos", userId);
}

export function detectProgressPhotoMime(bytes: Uint8Array): ProgressPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function validateProgressPhotoBytes(bytes: Uint8Array, claimedType?: string) {
  if (bytes.byteLength === 0) {
    throw new AppError("PROGRESS_PHOTO", "Choose a photo to upload.");
  }
  if (bytes.byteLength > PROGRESS_PHOTO_MAX_BYTES) {
    throw new AppError("PROGRESS_PHOTO", "That photo is larger than 5 MB. Pick a smaller jpeg, png, or webp.");
  }
  const detected = detectProgressPhotoMime(bytes);
  if (!detected) {
    throw new AppError("PROGRESS_PHOTO", "Use a jpeg, png, or webp photo. Other file types are rejected.");
  }
  if (claimedType && claimedType !== "application/octet-stream" && claimedType !== detected) {
    throw new AppError("PROGRESS_PHOTO", "The file type did not match the image. Use a jpeg, png, or webp.");
  }
  return detected;
}

function assertOwnPhoto<T extends { userId: string }>(row: T | null, userId: string): T {
  if (!row) {
    throw new NotFoundError("Progress photo not found.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's progress photos.");
  }
  return row;
}

/** Newest photos the timeline renders. The progress count uses countProgressPhotosForUser. */
export const PROGRESS_PHOTO_LIST_TAKE = 80;

export async function countProgressPhotosForUser(userId: string) {
  return prisma.progressPhoto.count({ where: { userId } });
}

export async function listProgressPhotosForUser(userId: string, take = PROGRESS_PHOTO_LIST_TAKE) {
  return prisma.progressPhoto.findMany({
    where: { userId },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function getProgressPhotoForUser(photoId: string, userId: string) {
  const row = await prisma.progressPhoto.findUnique({ where: { id: photoId } });
  return assertOwnPhoto(row, userId);
}

export async function createProgressPhotoForUser(
  userId: string,
  input: {
    bytes: Uint8Array;
    claimedType?: string;
    caption: string;
    recordedAt: Date;
  },
) {
  if (Number.isNaN(input.recordedAt.getTime())) {
    throw new AppError("PROGRESS_PHOTO", "Enter a valid date.");
  }
  const mimeType = validateProgressPhotoBytes(input.bytes, input.claimedType);
  const ext = EXT_BY_MIME[mimeType];
  const caption = input.caption.trim().slice(0, 120);
  const row = await prisma.progressPhoto.create({
    data: {
      userId,
      storedName: "pending",
      mimeType,
      byteSize: input.bytes.byteLength,
      caption,
      recordedAt: input.recordedAt,
    },
  });
  const storedName = `${row.id}.${ext}`;
  try {
    if (progressPhotoStorageMode() === "blob") {
      const blob = await loadBlob();
      const stored = await blob.put(
        `progress-photos/${userId}/${storedName}`,
        Buffer.from(input.bytes),
        {
          access: "private",
          token: blobToken(),
          contentType: mimeType,
          addRandomSuffix: false,
        },
      );
      return prisma.progressPhoto.update({
        where: { id: row.id },
        data: { storedName: stored.url, storageKind: "blob" },
      });
    }
    const dir = userDir(userId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(/*turbopackIgnore: true*/ dir, storedName);
    await writeFile(/*turbopackIgnore: true*/ filePath, input.bytes);
    return prisma.progressPhoto.update({
      where: { id: row.id },
      data: { storedName, storageKind: "local" },
    });
  } catch (error) {
    await prisma.progressPhoto.delete({ where: { id: row.id } }).catch(() => undefined);
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PROGRESS_PHOTO",
      "Photo storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob and try again.",
    );
  }
}

export async function updateProgressPhotoForUser(
  photoId: string,
  userId: string,
  input: { caption: string; recordedAt: Date },
) {
  await getProgressPhotoForUser(photoId, userId);
  if (Number.isNaN(input.recordedAt.getTime())) {
    throw new AppError("PROGRESS_PHOTO", "Enter a valid date.");
  }
  return prisma.progressPhoto.update({
    where: { id: photoId },
    data: {
      caption: input.caption.trim().slice(0, 120),
      recordedAt: input.recordedAt,
    },
  });
}

function localPhotoPath(userId: string, storedName: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(storedName)) {
    throw new NotFoundError("That photo file is missing from disk.");
  }
  return path.join(/*turbopackIgnore: true*/ userDir(userId), storedName);
}

async function readStoredPhoto(row: { userId: string; storageKind: string; storedName: string }) {
  if (row.storageKind === "blob") {
    const blob = await loadBlob();
    const result = await blob.get(row.storedName, { access: "private", token: blobToken() });
    if (!result?.stream || result.statusCode !== 200) {
      throw new NotFoundError("That photo file is missing from disk.");
    }
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  try {
    return await readFile(/*turbopackIgnore: true*/ localPhotoPath(row.userId, row.storedName));
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new NotFoundError("That photo file is missing from disk.");
  }
}

async function deleteStoredPhoto(row: { userId: string; storageKind: string; storedName: string }) {
  if (row.storageKind === "blob") {
    if (progressPhotoStorageMode() !== "blob" && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) return;
    try {
      const blob = await loadBlob();
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) return;
      await blob.del(row.storedName, { token });
    } catch {
      // Account deletion still proceeds if Blob is unreachable.
    }
    return;
  }
  if (row.storedName === "pending") return;
  try {
    await unlink(/*turbopackIgnore: true*/ localPhotoPath(row.userId, row.storedName));
  } catch {
    // Missing files should not block delete.
  }
}

export async function readProgressPhotoFileForUser(photoId: string, userId: string) {
  const row = await getProgressPhotoForUser(photoId, userId);
  const bytes = await readStoredPhoto(row);
  return { row, bytes };
}

export async function deleteProgressPhotoForUser(photoId: string, userId: string) {
  const row = await getProgressPhotoForUser(photoId, userId);
  await prisma.progressPhoto.delete({ where: { id: row.id } });
  await deleteStoredPhoto(row);
  return row;
}

export async function deleteProgressPhotoMediaForUser(userId: string) {
  const rows = await prisma.progressPhoto.findMany({
    where: { userId },
    select: { userId: true, storageKind: true, storedName: true },
  });
  await Promise.all(rows.map((row) => deleteStoredPhoto(row)));
}

export function progressPhotoSrc(photoId: string) {
  return `/api/progress-photos/${photoId}`;
}
