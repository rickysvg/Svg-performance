import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";

export const LESSON_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const LESSON_TOPICS = [
  "stance",
  "striking",
  "wrestling",
  "jiu-jitsu",
  "conditioning",
  "recovery",
] as const;

export type LessonInput = {
  slug: string;
  title: string;
  summary: string;
  skillLevel: string;
  topic: string;
  coachName: string;
  equipment: string;
  notes: string;
  drills: string;
  needsSupervision: boolean;
  supervisedNote: string;
  isDemo: boolean;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function validateLessonInput(input: LessonInput): LessonInput {
  const title = input.title.trim().slice(0, 120);
  if (!title) {
    throw new AppError("LESSON", "A lesson needs a title.");
  }
  if (!LESSON_LEVELS.includes(input.skillLevel as (typeof LESSON_LEVELS)[number])) {
    throw new AppError("LESSON", "Pick a valid skill level.");
  }
  if (!LESSON_TOPICS.includes(input.topic as (typeof LESSON_TOPICS)[number])) {
    throw new AppError("LESSON", "Pick a valid topic.");
  }
  const slug = slugify(input.slug || title);
  if (!slug) {
    throw new AppError("LESSON", "A lesson needs a short URL slug.");
  }
  return {
    slug,
    title,
    summary: input.summary.trim().slice(0, 400),
    skillLevel: input.skillLevel,
    topic: input.topic,
    coachName: input.coachName.trim().slice(0, 80) || "SVG coaching staff",
    equipment: input.equipment.trim().slice(0, 200),
    notes: input.notes.trim().slice(0, 4000),
    drills: input.drills.trim().slice(0, 4000),
    needsSupervision: Boolean(input.needsSupervision),
    supervisedNote: input.supervisedNote.trim().slice(0, 500),
    isDemo: Boolean(input.isDemo),
  };
}

export async function listPublishedLessons(query?: {
  search?: string;
  topic?: string;
  skillLevel?: string;
}) {
  const search = query?.search?.trim();
  return prisma.lesson.findMany({
    where: {
      status: "published",
      ...(query?.topic ? { topic: query.topic } : {}),
      ...(query?.skillLevel ? { skillLevel: query.skillLevel } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { summary: { contains: search } },
              { topic: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
  });
}

export async function listAllLessonsForAdmin() {
  return prisma.lesson.findMany({ orderBy: [{ status: "asc" }, { title: "asc" }] });
}

export async function getPublishedLessonBySlug(slug: string) {
  const lesson = await prisma.lesson.findUnique({ where: { slug } });
  if (!lesson || lesson.status !== "published") {
    throw new NotFoundError("Lesson not found.");
  }
  return lesson;
}

export async function getLessonForAdmin(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    throw new NotFoundError("Lesson not found.");
  }
  return lesson;
}

export async function createLessonDraft(input: LessonInput) {
  const data = validateLessonInput(input);
  return prisma.lesson.create({
    data: { ...data, status: "draft" },
  });
}

export async function updateLessonForAdmin(lessonId: string, input: LessonInput) {
  await getLessonForAdmin(lessonId);
  const data = validateLessonInput(input);
  return prisma.lesson.update({ where: { id: lessonId }, data });
}

export async function setLessonStatus(lessonId: string, status: "draft" | "published") {
  await getLessonForAdmin(lessonId);
  return prisma.lesson.update({
    where: { id: lessonId },
    data: { status },
  });
}

export async function getLessonProgress(userId: string, lessonId: string) {
  return prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
}

export async function listLessonProgressForUser(userId: string) {
  return prisma.lessonProgress.findMany({ where: { userId } });
}

export async function toggleLessonBookmark(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.status !== "published") {
    throw new NotFoundError("Lesson not found.");
  }
  const existing = await getLessonProgress(userId, lessonId);
  if (!existing) {
    return prisma.lessonProgress.create({
      data: { userId, lessonId, bookmarked: true },
    });
  }
  return prisma.lessonProgress.update({
    where: { id: existing.id },
    data: { bookmarked: !existing.bookmarked },
  });
}

export async function toggleLessonComplete(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.status !== "published") {
    throw new NotFoundError("Lesson not found.");
  }
  const existing = await getLessonProgress(userId, lessonId);
  const completed = !existing?.completed;
  const row = !existing
    ? await prisma.lessonProgress.create({
        data: {
          userId,
          lessonId,
          completed,
          completedAt: completed ? new Date() : null,
        },
      })
    : await prisma.lessonProgress.update({
        where: { id: existing.id },
        data: {
          completed,
          completedAt: completed ? new Date() : null,
        },
      });
  if (completed) {
    await recordMetric(METRIC_NAMES.lessonCompleted, userId);
  }
  return row;
}

export async function tryReadLessonForUser(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, status: "published" },
  });
  if (!lesson) {
    return null;
  }
  // userId is accepted so callers cannot "read as admin" by omitting it later
  void userId;
  return lesson;
}

export function memberCannotSeeDraft(status: string) {
  return status !== "published";
}

export { ForbiddenError };
