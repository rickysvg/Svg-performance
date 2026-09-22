import { mkdir, unlink, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { assertCanViewMemberTrend } from "@/lib/reports";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview } from "@/lib/plans";

export const TRAINING_CLIP_MAX_BYTES = 25 * 1024 * 1024;
export const TRAINING_CLIP_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export type TrainingClipMime = (typeof TRAINING_CLIP_TYPES)[number];

const EXT_BY_MIME: Record<TrainingClipMime, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function trainingClipRoot() {
  return (
    process.env.TRAINING_CLIP_DIR?.trim() ||
    path.join(process.cwd(), "uploads", "training-clips")
  );
}

function userDir(userId: string) {
  return path.join(trainingClipRoot(), userId);
}

export function detectTrainingClipMime(bytes: Uint8Array): TrainingClipMime | null {
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }
  return null;
}

export function validateTrainingClipBytes(bytes: Uint8Array, claimedType?: string) {
  if (bytes.byteLength === 0) {
    throw new AppError("CLIP", "Choose a training clip to upload.");
  }
  if (bytes.byteLength > TRAINING_CLIP_MAX_BYTES) {
    throw new AppError("CLIP", "That clip is larger than 25 MB. Pick a shorter mp4 or webm.");
  }
  const detected = detectTrainingClipMime(bytes);
  if (!detected) {
    throw new AppError("CLIP", "Use an mp4 or webm clip. Other file types are rejected.");
  }
  if (
    claimedType &&
    claimedType !== "application/octet-stream" &&
    claimedType !== detected &&
    !(claimedType === "video/quicktime" && detected === "video/mp4")
  ) {
    throw new AppError("CLIP", "The file type did not match the video. Use mp4 or webm.");
  }
  return detected;
}

export function parseTimestamp(input: string) {
  const trimmed = input.trim();
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60 * 60 * 3) {
    throw new AppError("CLIP", "Use a timestamp like 1:15 (mm:ss).");
  }
  return Math.floor(seconds);
}

export function formatTimestamp(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

async function assertClipAccess(actor: {
  id: string;
  role: string;
}, clip: { userId: string } | null) {
  if (!clip) {
    throw new NotFoundError("Training clip not found.");
  }
  if (clip.userId === actor.id) {
    return;
  }
  if (actor.role !== "admin" && actor.role !== "coach") {
    throw new ForbiddenError("You cannot open another member's training clip.");
  }
  await assertCanViewMemberTrend({
    staffUserId: actor.id,
    staffRole: actor.role,
    memberUserId: clip.userId,
  });
}

export async function assertCanUploadClip(userId: string) {
  const planId = await getEffectivePlanId(userId);
  if (!planHasCoachReview(planId)) {
    throw new AppError(
      "CLIP",
      "Timestamped video feedback is for Fighter Development and higher. Lower plans stay locked on purpose.",
    );
  }
}

export async function createTrainingClipForUser(input: {
  userId: string;
  title: string;
  memberNote: string;
  bytes: Uint8Array;
  claimedType?: string;
}) {
  await assertCanUploadClip(input.userId);
  const mime = validateTrainingClipBytes(input.bytes, input.claimedType);
  const title = input.title.trim().slice(0, 80) || "Training clip";
  const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${EXT_BY_MIME[mime]}`;
  await mkdir(userDir(input.userId), { recursive: true });
  const diskPath = path.join(userDir(input.userId), storedName);
  const row = await prisma.trainingClip.create({
    data: {
      userId: input.userId,
      storedName,
      mimeType: mime,
      byteSize: input.bytes.byteLength,
      title,
      memberNote: input.memberNote.trim().slice(0, 500),
    },
  });
  try {
    await writeFile(diskPath, input.bytes);
  } catch (error) {
    await prisma.trainingClip.delete({ where: { id: row.id } }).catch(() => undefined);
    throw error;
  }
  return row;
}

export async function listTrainingClipsForUser(userId: string) {
  return prisma.trainingClip.findMany({
    where: { userId },
    include: { notes: { orderBy: { seconds: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTrainingClipsForStaff(input: {
  staffUserId: string;
  staffRole: string;
  memberUserId: string;
}) {
  await assertCanViewMemberTrend(input);
  return prisma.trainingClip.findMany({
    where: { userId: input.memberUserId },
    include: { notes: { orderBy: { seconds: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingClipForActor(
  clipId: string,
  actor: { id: string; role: string },
) {
  const row = await prisma.trainingClip.findUnique({
    where: { id: clipId },
    include: {
      notes: { orderBy: { seconds: "asc" } },
      user: { select: { email: true, id: true } },
    },
  });
  await assertClipAccess(actor, row);
  return row!;
}

export async function addClipTimestampNote(input: {
  staffUserId: string;
  staffRole: string;
  clipId: string;
  timestamp: string;
  correction: string;
  drill: string;
}) {
  const clip = await prisma.trainingClip.findUnique({ where: { id: input.clipId } });
  if (!clip) {
    throw new NotFoundError("Training clip not found.");
  }
  await assertCanViewMemberTrend({
    staffUserId: input.staffUserId,
    staffRole: input.staffRole,
    memberUserId: clip.userId,
  });
  const planId = await getEffectivePlanId(clip.userId);
  if (!planHasCoachReview(planId)) {
    throw new AppError("CLIP", "Timestamped notes are for Fighter Development and higher.");
  }
  const correction = input.correction.trim().slice(0, 800);
  if (!correction) {
    throw new AppError("CLIP", "Write the correction in your own words.");
  }
  return prisma.clipTimestampNote.create({
    data: {
      clipId: clip.id,
      authorUserId: input.staffUserId,
      seconds: parseTimestamp(input.timestamp),
      correction,
      drill: input.drill.trim().slice(0, 400),
    },
  });
}

export async function markClipFeedbackSeen(userId: string, clipId: string) {
  const row = await prisma.trainingClip.findUnique({ where: { id: clipId } });
  if (!row || row.userId !== userId) {
    throw new ForbiddenError("You can only mark your own clip as seen.");
  }
  if (row.feedbackSeenAt) return row;
  return prisma.trainingClip.update({
    where: { id: clipId },
    data: { feedbackSeenAt: new Date() },
  });
}

export async function deleteTrainingClipForUser(userId: string, clipId: string) {
  const row = await prisma.trainingClip.findUnique({ where: { id: clipId } });
  if (!row || row.userId !== userId) {
    throw new ForbiddenError("You can only delete your own training clip.");
  }
  await unlink(path.join(userDir(userId), row.storedName)).catch(() => undefined);
  return prisma.trainingClip.delete({ where: { id: clipId } });
}

export async function readTrainingClipFileForActor(
  clipId: string,
  actor: { id: string; role: string },
) {
  const row = await prisma.trainingClip.findUnique({ where: { id: clipId } });
  await assertClipAccess(actor, row);
  const bytes = await readFile(path.join(userDir(row!.userId), row!.storedName));
  return { row: row!, bytes };
}

export function trainingClipSrc(clipId: string) {
  return `/api/training-clips/${clipId}`;
}
