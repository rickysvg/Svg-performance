import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { mondayOf } from "@/lib/home";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasFeature } from "@/lib/plans";
import { detectTrainingClipMime, TRAINING_CLIP_MAX_BYTES } from "@/lib/clips";

const FOCUS_VIDEO_DIR = path.join(process.cwd(), "uploads", "focus-videos");

export function focusVideoRoot() {
  const fromEnv = process.env.FOCUS_VIDEO_DIR?.trim();
  if (fromEnv) return fromEnv;
  return FOCUS_VIDEO_DIR;
}

export function parseExternalVideoUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      return value;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      return value;
    }
  } catch {
    throw new AppError("FOCUS", "Paste a YouTube or Vimeo URL, or upload a short clip.");
  }
  throw new AppError("FOCUS", "Only YouTube or Vimeo URLs are accepted for the weekly focus video.");
}

export function embedUrlFor(videoUrl: string) {
  if (!videoUrl) return "";
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${url.pathname.replace("/", "")}`;
    }
    if (host.endsWith("youtube.com")) {
      const id = url.searchParams.get("v") || url.pathname.split("/").pop();
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
  } catch {
    return "";
  }
  return "";
}

export async function listFocusVideosForAdmin() {
  return prisma.weeklyFocusVideo.findMany({
    orderBy: { weekStart: "desc" },
  });
}

export async function upsertFocusVideo(input: {
  adminUserId: string;
  id?: string;
  title: string;
  weekStart: string;
  videoUrl: string;
  scriptNotes: string;
  status: string;
  isDemo: boolean;
  bytes?: Uint8Array;
  claimedType?: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can schedule weekly focus videos.");
  }
  const title = input.title.trim().slice(0, 80);
  if (!title) {
    throw new AppError("FOCUS", "Give the video a title.");
  }
  const weekStart = mondayOf(new Date(input.weekStart));
  if (Number.isNaN(weekStart.getTime())) {
    throw new AppError("FOCUS", "Pick a week start date.");
  }
  const status = input.status === "published" ? "published" : "draft";
  let storedName = "";
  let mimeType = "";
  let byteSize = 0;
  const videoUrl = input.videoUrl ? parseExternalVideoUrl(input.videoUrl) : "";
  if (input.bytes && input.bytes.byteLength > 0) {
    if (input.bytes.byteLength > TRAINING_CLIP_MAX_BYTES) {
      throw new AppError("FOCUS", "Keep the focus clip under 25 MB (about 60–90 seconds).");
    }
    const mime = detectTrainingClipMime(input.bytes);
    if (!mime) {
      throw new AppError("FOCUS", "Upload an mp4 or webm, or paste a YouTube/Vimeo URL.");
    }
    storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${mime === "video/webm" ? "webm" : "mp4"}`;
    mimeType = mime;
    byteSize = input.bytes.byteLength;
    await mkdir(focusVideoRoot(), { recursive: true });
    await writeFile(path.join(focusVideoRoot(), storedName), input.bytes);
  }
  if (!videoUrl && !storedName && !input.id) {
    throw new AppError("FOCUS", "Paste a YouTube/Vimeo URL or upload a short clip.");
  }
  const data = {
    title,
    weekStart,
    videoUrl,
    scriptNotes: input.scriptNotes.trim().slice(0, 2000),
    status,
    isDemo: input.isDemo,
    authorUserId: admin.id,
    ...(storedName ? { storedName, mimeType, byteSize } : {}),
  };
  if (input.id) {
    const existing = await prisma.weeklyFocusVideo.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError("Focus video not found.");
    if (storedName && existing.storedName) {
      await unlink(path.join(focusVideoRoot(), existing.storedName)).catch(() => undefined);
    }
    return prisma.weeklyFocusVideo.update({ where: { id: input.id }, data });
  }
  return prisma.weeklyFocusVideo.create({ data });
}

export async function getPublishedFocusForWeek(now = new Date()) {
  const weekStart = mondayOf(now);
  const next = new Date(weekStart);
  next.setDate(weekStart.getDate() + 7);
  return prisma.weeklyFocusVideo.findFirst({
    where: {
      status: "published",
      weekStart: { gte: weekStart, lt: next },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFocusVideoForMember(userId: string, now = new Date()) {
  const planId = await getEffectivePlanId(userId);
  const unlocked = planHasFeature(planId, "daily_quote");
  const video = await getPublishedFocusForWeek(now);
  return { unlocked, video, planId };
}

export async function readFocusVideoFile(videoId: string) {
  const row = await prisma.weeklyFocusVideo.findUnique({ where: { id: videoId } });
  if (!row || !row.storedName || row.status !== "published") {
    throw new NotFoundError("Focus video not found.");
  }
  const bytes = await readFile(path.join(focusVideoRoot(), row.storedName));
  return { row, bytes };
}

export function focusVideoSrc(videoId: string) {
  return `/api/focus-videos/${videoId}`;
}

export async function ensureDemoFocusVideo(adminUserId: string, now = new Date()) {
  const weekStart = mondayOf(now);
  const existing = await prisma.weeklyFocusVideo.findFirst({
    where: { weekStart, isDemo: true },
  });
  if (existing) return existing;
  return prisma.weeklyFocusVideo.create({
    data: {
      title: "DEMO — This week's 60–90s focus",
      weekStart,
      videoUrl: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
      scriptNotes: "Labeled DEMO. External YouTube technique reference — not a live Ricky stream.",
      status: "published",
      isDemo: true,
      authorUserId: adminUserId,
    },
  });
}
