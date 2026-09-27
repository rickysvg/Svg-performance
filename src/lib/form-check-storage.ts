import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  FORM_CHECK_MAX_BYTES,
  FORM_CHECK_MAX_SECONDS,
  type FormCheckMime,
} from "@/lib/form-check-shared";

export {
  FORM_CHECK_MAX_BYTES,
  FORM_CHECK_MAX_SECONDS,
  FORM_CHECK_TYPES,
  type FormCheckMime,
} from "@/lib/form-check-shared";

const EXT_BY_MIME: Record<FormCheckMime, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const LOCAL_ROOT = path.join(process.cwd(), "uploads", "form-checks");

export function formCheckStorageMode(): "blob" | "local" {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local";
}

export function formCheckRoot() {
  const fromEnv = process.env.FORM_CHECK_DIR?.trim();
  if (fromEnv) return fromEnv;
  return LOCAL_ROOT;
}

export function formCheckStorageNotice(): string | null {
  if (process.env.VERCEL === "1" && formCheckStorageMode() === "local") {
    return "Uploads need Vercel Blob on this host. Set BLOB_READ_WRITE_TOKEN, then try again.";
  }
  return null;
}

export function detectFormCheckMime(bytes: Uint8Array): FormCheckMime | null {
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm";
  }
  return null;
}

export function validateFormCheckBytes(bytes: Uint8Array, claimedType?: string) {
  if (bytes.byteLength === 0) {
    throw new AppError("FORM_CHECK", "Choose a clip to upload.");
  }
  if (bytes.byteLength > FORM_CHECK_MAX_BYTES) {
    throw new AppError(
      "FORM_CHECK",
      "That clip is larger than 24 MB. Keep it to 60 seconds or less.",
    );
  }
  const detected = detectFormCheckMime(bytes);
  if (!detected) {
    throw new AppError("FORM_CHECK", "Use an mp4, mov, or webm clip.");
  }
  if (
    claimedType &&
    claimedType !== "application/octet-stream" &&
    claimedType !== detected &&
    !(claimedType === "video/quicktime" && detected === "video/mp4") &&
    !(claimedType === "video/mp4" && detected === "video/quicktime")
  ) {
    throw new AppError("FORM_CHECK", "The file type did not match the video. Use mp4, mov, or webm.");
  }
  return detected;
}

export function assertClipDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 1) {
    throw new AppError(
      "FORM_CHECK",
      "Could not read the clip length. Use a video up to 60 seconds.",
    );
  }
  const rounded = Math.ceil(seconds);
  if (rounded > FORM_CHECK_MAX_SECONDS) {
    throw new AppError("FORM_CHECK", "Keep the clip to 60 seconds or less.");
  }
  return rounded;
}

function safeKey(storageKey: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(storageKey)) {
    throw new AppError("FORM_CHECK", "That clip file is missing.");
  }
  return storageKey;
}

function assertPathSegment(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new AppError("FORM_CHECK", "That clip file is missing.");
  }
}

function localFilePath(userId: string, storageKey: string) {
  assertPathSegment(userId);
  const key = safeKey(storageKey);
  const fromEnv = process.env.FORM_CHECK_DIR?.trim();
  if (fromEnv) {
    return path.join(/*turbopackIgnore: true*/ fromEnv, userId, key);
  }
  return path.join(process.cwd(), "uploads", "form-checks", userId, key);
}

function localUserDir(userId: string) {
  assertPathSegment(userId);
  const fromEnv = process.env.FORM_CHECK_DIR?.trim();
  if (fromEnv) return path.join(/*turbopackIgnore: true*/ fromEnv, userId);
  return path.join(process.cwd(), "uploads", "form-checks", userId);
}

async function loadBlob() {
  try {
    return await import("@vercel/blob");
  } catch {
    throw new AppError(
      "FORM_CHECK",
      "Video storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new AppError(
      "FORM_CHECK",
      "Video storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob.",
    );
  }
  return token;
}

export async function writeFormCheckMedia(input: {
  userId: string;
  checkId: string;
  bytes: Uint8Array;
  mime: FormCheckMime;
}): Promise<{ storageKind: "local" | "blob"; storageKey: string }> {
  if (formCheckStorageMode() === "blob") {
    try {
      const blob = await loadBlob();
      const ext = EXT_BY_MIME[input.mime];
      const stored = await blob.put(
        `form-checks/${input.userId}/${input.checkId}.${ext}`,
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
        "FORM_CHECK",
        "Video storage is not available. Set BLOB_READ_WRITE_TOKEN for Vercel Blob and try again.",
      );
    }
  }

  const ext = EXT_BY_MIME[input.mime];
  const storageKey = `${input.checkId}.${ext}`;
  try {
    const dir = localUserDir(input.userId);
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ localFilePath(input.userId, storageKey), input.bytes);
  } catch {
    throw new AppError(
      "FORM_CHECK",
      "Video storage is not available on this server. Set BLOB_READ_WRITE_TOKEN to store clips in Vercel Blob.",
    );
  }
  return { storageKind: "local", storageKey };
}

export async function readFormCheckMedia(input: {
  userId: string;
  storageKind: string;
  storageKey: string;
}): Promise<Uint8Array> {
  if (input.storageKind === "blob") {
    const blob = await loadBlob();
    const result = await blob.get(input.storageKey, { access: "private", token: blobToken() });
    if (!result?.stream || result.statusCode !== 200) {
      throw new AppError("FORM_CHECK", "That clip file is missing.");
    }
    const response = new Response(result.stream);
    return new Uint8Array(await response.arrayBuffer());
  }
  try {
    return await readFile(/*turbopackIgnore: true*/ localFilePath(input.userId, input.storageKey));
  } catch {
    throw new AppError("FORM_CHECK", "That clip file is missing.");
  }
}

async function deleteOneMedia(input: {
  userId: string;
  storageKind: string;
  storageKey: string;
}) {
  if (input.storageKind === "blob") {
    if (formCheckStorageMode() !== "blob") return;
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

export async function deleteFormCheckMediaForUser(userId: string) {
  const rows = await prisma.formCheck.findMany({
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
  await rm(/*turbopackIgnore: true*/ localUserDir(userId), {
    recursive: true,
    force: true,
  });
}
