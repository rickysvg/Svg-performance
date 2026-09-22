import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { startOfLocalDay } from "@/lib/nutrition";

export const CHALLENGE_TRACKS = ["beginner", "advanced"] as const;
export type ChallengeTrack = (typeof CHALLENGE_TRACKS)[number];

export function isChallengeTrack(value: string): value is ChallengeTrack {
  return (CHALLENGE_TRACKS as readonly string[]).includes(value);
}

export function monthKeyFrom(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, (month ?? 1) - 1, 1);
  const end = new Date(year, month ?? 1, 1);
  return { start: startOfLocalDay(start), end: startOfLocalDay(end) };
}

export async function listChallengesForAdmin() {
  return prisma.svgChallenge.findMany({
    include: { _count: { select: { enrollments: true } } },
    orderBy: { monthKey: "desc" },
  });
}

export async function createOrUpdateChallenge(input: {
  adminUserId: string;
  title: string;
  monthKey: string;
  summary: string;
  beginnerGoalDays: number;
  advancedGoalDays: number;
  active: boolean;
  isDemo?: boolean;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can manage monthly challenges.");
  }
  const monthKey = input.monthKey.trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new AppError("CHALLENGE", "Use a month like 2026-09.");
  }
  const title = input.title.trim().slice(0, 80);
  if (!title) {
    throw new AppError("CHALLENGE", "Give the challenge a title.");
  }
  const beginnerGoalDays = Math.min(31, Math.max(1, Math.round(input.beginnerGoalDays) || 8));
  const advancedGoalDays = Math.min(31, Math.max(beginnerGoalDays, Math.round(input.advancedGoalDays) || 16));
  if (input.active) {
    await prisma.svgChallenge.updateMany({ data: { active: false } });
  }
  return prisma.svgChallenge.upsert({
    where: { monthKey },
    create: {
      title,
      monthKey,
      summary: input.summary.trim().slice(0, 400),
      beginnerGoalDays,
      advancedGoalDays,
      active: input.active,
      isDemo: Boolean(input.isDemo),
    },
    update: {
      title,
      summary: input.summary.trim().slice(0, 400),
      beginnerGoalDays,
      advancedGoalDays,
      active: input.active,
      isDemo: Boolean(input.isDemo),
    },
  });
}

export async function getActiveChallenge() {
  return prisma.svgChallenge.findFirst({
    where: { active: true },
    orderBy: { monthKey: "desc" },
  });
}

export async function countActiveDaysInRange(userId: string, start: Date, end: Date) {
  const [workouts, foods] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "complete", performedAt: { gte: start, lt: end } },
      select: { performedAt: true },
    }),
    prisma.nutritionEntry.findMany({
      where: { userId, eatenAt: { gte: start, lt: end } },
      select: { eatenAt: true },
    }),
  ]);
  const days = new Set<string>();
  for (const row of workouts) {
    days.add(`${row.performedAt.getFullYear()}-${row.performedAt.getMonth()}-${row.performedAt.getDate()}`);
  }
  for (const row of foods) {
    days.add(`${row.eatenAt.getFullYear()}-${row.eatenAt.getMonth()}-${row.eatenAt.getDate()}`);
  }
  return days.size;
}

export function goalDaysForTrack(
  challenge: { beginnerGoalDays: number; advancedGoalDays: number },
  track: ChallengeTrack,
) {
  return track === "advanced" ? challenge.advancedGoalDays : challenge.beginnerGoalDays;
}

export async function enrollInChallenge(userId: string, track: string) {
  if (!isChallengeTrack(track)) {
    throw new AppError("CHALLENGE", "Pick the beginner or advanced track.");
  }
  const challenge = await getActiveChallenge();
  if (!challenge) {
    throw new AppError("CHALLENGE", "No monthly challenge is active yet.");
  }
  return prisma.challengeEnrollment.upsert({
    where: { challengeId_userId: { challengeId: challenge.id, userId } },
    create: { challengeId: challenge.id, userId, track },
    update: { track, completedAt: null },
  });
}

export async function getChallengeProgressForUser(userId: string) {
  const challenge = await getActiveChallenge();
  if (!challenge) {
    return null;
  }
  const enrollment = await prisma.challengeEnrollment.findUnique({
    where: { challengeId_userId: { challengeId: challenge.id, userId } },
  });
  const { start, end } = monthRange(challenge.monthKey);
  const daysActive = await countActiveDaysInRange(userId, start, end);
  const track = (enrollment?.track as ChallengeTrack | undefined) ?? "beginner";
  const goalDays = enrollment ? goalDaysForTrack(challenge, track) : challenge.beginnerGoalDays;
  const complete = Boolean(enrollment) && daysActive >= goalDays;
  if (enrollment && complete && !enrollment.completedAt) {
    await prisma.challengeEnrollment.update({
      where: { id: enrollment.id },
      data: { completedAt: new Date() },
    });
  }
  return {
    challenge,
    enrollment,
    daysActive,
    goalDays,
    track: enrollment ? track : null,
    complete,
    ratio: Math.min(1, daysActive / goalDays),
  };
}

export async function ensureDemoChallenge(now = new Date()) {
  const monthKey = monthKeyFrom(now);
  return prisma.svgChallenge.upsert({
    where: { monthKey },
    create: {
      title: "DEMO — Show up this month",
      monthKey,
      summary:
        "Consistency only: log a workout and/or a meal on enough days. Not a heaviest-lift contest. Labeled DEMO.",
      beginnerGoalDays: 8,
      advancedGoalDays: 16,
      active: true,
      isDemo: true,
    },
    update: {},
  });
}
