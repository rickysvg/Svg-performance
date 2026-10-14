import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { formCheckStorageMode } from "@/lib/form-check-storage";
import { FEEDBACK_SCREENSHOT_MAX_BYTES } from "@/lib/feedback-shared";

export const FEEDBACK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FeedbackImageMime = (typeof FEEDBACK_IMAGE_TYPES)[number];

const EXT_BY_MIME: Record<FeedbackImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function feedbackStorageMode(): "blob" | "local" {
  return formCheckStorageMode();
}

export function feedbackStorageNotice(): string | null {
  if (process.env.VERCEL === "1" && feedbackStorageMode() === "local") {
    return "Screenshots need Vercel Blob on this host. Set BLOB_READ_WRITE_TOKEN, or send the note without a picture.";
  }
  return null;
}

export function detectFeedbackImageMime(bytes: Uint8Array): FeedbackImageMime | null {
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

export function validateFeedbackImageBytes(bytes: Uint8Array, claimedType?: string) {
  if (bytes.byteLength === 0) {
    throw new AppError("FEEDBACK", "Choose a screenshot, or send the note without one.");
  }
  if (bytes.byteLength > FEEDBACK_SCREENSHOT_MAX_BYTES) {
    throw new AppError("FEEDBACK", "That screenshot is larger than 5 MB. Pick a smaller jpeg, png, or webp.");
  }
  const detected = detectFeedbackImageMime(bytes);
  if (!detected) {
    throw new AppError("FEEDBACK", "Use a jpeg, png, or webp screenshot.");
  }
  if (claimedType && claimedType !== "application/octet-stream" && claimedType !== detected) {
    throw new AppError("FEEDBACK", "The file type did not match the image. Use a jpeg, png, or webp.");
  }
  return detected;
}

function safeKey(storageKey: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(storageKey)) {
    throw new AppError("FEEDBACK", "That screenshot is missing.");
  }
  return storageKey;
}

function assertPathSegment(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new AppError("FEEDBACK", "That screenshot is missing.");
  }
}

function localUserDir(userId: string) {
  assertPathSegment(userId);
  const fromEnv = process.env.FEEDBACK_DIR?.trim();
  if (fromEnv) return path.join(/*turbopackIgnore: true*/ fromEnv, userId);
  return path.join(process.cwd(), "uploads", "member-feedback", userId);
}

function localFilePath(userId: string, storageKey: string) {
  assertPathSegment(userId);
  const key = safeKey(storageKey);
  const fromEnv = process.env.FEEDBACK_DIR?.trim();
  if (fromEnv) return path.join(/*turbopackIgnore: true*/ fromEnv, userId, key);
  return path.join(process.cwd(), "uploads", "member-feedback", userId, key);
}

async function loadBlob() {
  try {
    return await import("@vercel/blob");
  } catch {
    throw new AppError(
      "FEEDBACK",
      "Screenshot storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new AppError(
      "FEEDBACK",
      "Screenshot storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
  return token;
}

export async function writeFeedbackMedia(input: {
  userId: string;
  feedbackId: string;
  bytes: Uint8Array;
  mime: FeedbackImageMime;
}): Promise<{ storageKind: "local" | "blob"; storageKey: string }> {
  if (feedbackStorageMode() === "blob") {
    try {
      const blob = await loadBlob();
      const ext = EXT_BY_MIME[input.mime];
      const stored = await blob.put(
        `member-feedback/${input.userId}/${input.feedbackId}.${ext}`,
        Buffer.from(input.bytes),
        {
          access: "private",
          token: blobToken(),
          contentType: input.mime,
          addRandomSuffix: false,
        },
      );
      return { storageKind: "blob", storageKey: stored.url };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "FEEDBACK",
        "Screenshot storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob and try again.",
      );
    }
  }

  const ext = EXT_BY_MIME[input.mime];
  const storageKey = `${input.feedbackId}.${ext}`;
  try {
    const dir = localUserDir(input.userId);
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ localFilePath(input.userId, storageKey), input.bytes);
  } catch {
    throw new AppError(
      "FEEDBACK",
      "Screenshot storage is not available on this server. Send the note without a picture, or set BLOB_READ_WRITE_TOKEN.",
    );
  }
  return { storageKind: "local", storageKey };
}

export async function readFeedbackMedia(input: {
  userId: string;
  storageKind: string;
  storageKey: string;
}): Promise<Uint8Array> {
  if (input.storageKind === "blob") {
    const blob = await loadBlob();
    const result = await blob.get(input.storageKey, { access: "private", token: blobToken() });
    if (!result?.stream || result.statusCode !== 200) {
      throw new AppError("FEEDBACK", "That screenshot is missing.");
    }
    const response = new Response(result.stream);
    return new Uint8Array(await response.arrayBuffer());
  }
  try {
    return await readFile(/*turbopackIgnore: true*/ localFilePath(input.userId, input.storageKey));
  } catch {
    throw new AppError("FEEDBACK", "That screenshot is missing.");
  }
}

async function deleteOneMedia(input: {
  userId: string;
  storageKind: string;
  storageKey: string;
}) {
  if (!input.storageKey) return;
  if (input.storageKind === "blob") {
    if (feedbackStorageMode() !== "blob") return;
    try {
      const blob = await loadBlob();
      await blob.del(input.storageKey, { token: blobToken() });
    } catch {
      // Account deletion still proceeds if Blob is unreachable.
    }
    return;
  }
  try {
    await rm(/*turbopackIgnore: true*/ localFilePath(input.userId, input.storageKey), { force: true });
  } catch {
    // Missing files should not block account deletion.
  }
}

export async function deleteFeedbackMediaForUser(userId: string) {
  const rows = await prisma.memberFeedback.findMany({
    where: { userId },
    select: { storageKind: true, storageKey: true },
  });
  await Promise.all(
    rows.map((row) =>
      deleteOneMedia({
        userId,
        storageKind: row.storageKind,
        storageKey: row.storageKey,
      }),
    ),
  );
  await rm(/*turbopackIgnore: true*/ localUserDir(userId), { recursive: true, force: true }).catch(
    () => undefined,
  );
}
