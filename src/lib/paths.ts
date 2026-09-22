import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { findDemoProgram } from "@/lib/programs";
import { listPublishedLessons, listLessonProgressForUser } from "@/lib/lessons";
import { getProfileForUser } from "@/lib/profile";
import { preferredLearnLevel, preferredLearnTopic } from "@/lib/onboarding";
import type { ProfileRecord } from "@/lib/profile";

export const PATH_SLUGS = [
  "beginner-foundations",
  "build-your-gas-tank",
  "strength-for-combat",
] as const;

export type PathSlug = (typeof PATH_SLUGS)[number];

export type PathStep = {
  key: string;
  title: string;
  summary: string;
  href: string;
  programDayNumber?: number;
  lessonHint?: boolean;
  journalHint?: boolean;
  checkinHint?: boolean;
  minWorkouts?: number;
};

export type TrainingPath = {
  slug: PathSlug;
  title: string;
  summary: string;
  audience: "beginner" | "conditioning" | "combat";
  isDemo: true;
  steps: PathStep[];
};

export const TRAINING_PATHS: TrainingPath[] = [
  {
    slug: "beginner-foundations",
    title: "Beginner Foundations",
    summary:
      "DEMO starting point: one strength day, one tutorial, a logged week, then a written goal. Not a custom Elite plan.",
    audience: "beginner",
    isDemo: true,
    steps: [
      {
        key: "day-1",
        title: "Log DEMO Day 1",
        summary: "Lower-body power template. Stop when the work is honest.",
        href: "/training",
        programDayNumber: 1,
      },
      {
        key: "learn-basics",
        title: "Finish one beginner tutorial",
        summary: "Filtered to your level and martial art when we have a match.",
        href: "/learn",
        lessonHint: true,
      },
      {
        key: "two-sessions",
        title: "Log two completed sessions",
        summary: "Consistency first. Two saved workouts is the milestone.",
        href: "/training",
        minWorkouts: 2,
      },
      {
        key: "journal-goal",
        title: "Write a training goal",
        summary: "Your words. A coach does not invent this for you.",
        href: "/journal",
        journalHint: true,
      },
    ],
  },
  {
    slug: "build-your-gas-tank",
    title: "Build Your Gas Tank",
    summary:
      "DEMO conditioning path: engine work, a second session, a feel rating, then a tutorial. Still labeled DEMO.",
    audience: "conditioning",
    isDemo: true,
    steps: [
      {
        key: "day-3",
        title: "Log DEMO Day 3",
        summary: "Conditioning template. This is not a fight-camp weight cut.",
        href: "/training",
        programDayNumber: 3,
      },
      {
        key: "second-session",
        title: "Log a second completed session",
        summary: "Any DEMO day counts. Two sessions on the books.",
        href: "/training",
        minWorkouts: 2,
      },
      {
        key: "rate-feel",
        title: "Rate how a session felt",
        summary: "Too easy through extremely difficult. Used for hints, not auto-load.",
        href: "/training/history",
      },
      {
        key: "learn-engine",
        title: "Finish one tutorial",
        summary: "Prefer your art when the library has one.",
        href: "/learn",
        lessonHint: true,
      },
    ],
  },
  {
    slug: "strength-for-combat",
    title: "Strength for Combat",
    summary:
      "DEMO strength path for people who compete or want combat strength. Not a live fight camp.",
    audience: "combat",
    isDemo: true,
    steps: [
      {
        key: "day-1",
        title: "Log DEMO Day 1 (strength)",
        summary: "Lower-body power. Loads you type are yours.",
        href: "/training",
        programDayNumber: 1,
      },
      {
        key: "day-2",
        title: "Log DEMO Day 2",
        summary: "Upper / pull template from the same DEMO program.",
        href: "/training",
        programDayNumber: 2,
      },
      {
        key: "two-sessions",
        title: "Two completed sessions",
        summary: "Show up twice. We do not invent a camp calendar.",
        href: "/training",
        minWorkouts: 2,
      },
      {
        key: "check-in",
        title: "Request a human check-in or write a question",
        summary: "Book with Ricky if you have credits, or journal a question. Coach Savage is not Ricky.",
        href: "/book",
        checkinHint: true,
      },
    ],
  },
];

export function isPathSlug(value: string): value is PathSlug {
  return (PATH_SLUGS as readonly string[]).includes(value);
}

export function getPathBySlug(slug: string) {
  return TRAINING_PATHS.find((path) => path.slug === slug) ?? null;
}

export function defaultPathSlug(profile: Pick<
  ProfileRecord,
  "experienceLevel" | "goalKey" | "primaryFocus" | "competitionStatus"
> | null): PathSlug {
  if (profile?.competitionStatus === "amateur" || profile?.competitionStatus === "pro") {
    return "strength-for-combat";
  }
  if (profile?.goalKey === "conditioning") {
    return "build-your-gas-tank";
  }
  if (profile?.experienceLevel === "advanced") {
    return "strength-for-combat";
  }
  if (profile?.experienceLevel === "intermediate" && profile.goalKey === "more-athletic") {
    return "build-your-gas-tank";
  }
  return "beginner-foundations";
}

export function todayLane(profile: Pick<
  ProfileRecord,
  "experienceLevel" | "competitionStatus"
> | null): "beginner" | "fighter" {
  if (profile?.competitionStatus === "amateur" || profile?.competitionStatus === "pro") {
    return "fighter";
  }
  if (profile?.experienceLevel === "advanced") {
    return "fighter";
  }
  return "beginner";
}

export async function listPaths() {
  return TRAINING_PATHS;
}

export async function getActiveEnrollment(userId: string) {
  return prisma.pathEnrollment.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function enrollUserInPath(userId: string, pathSlug: string) {
  if (!isPathSlug(pathSlug)) {
    throw new AppError("PATH", "Pick a real training path.");
  }
  await prisma.pathEnrollment.deleteMany({ where: { userId } });
  return prisma.pathEnrollment.create({
    data: { userId, pathSlug },
  });
}

export async function ensureDefaultPath(userId: string) {
  const existing = await getActiveEnrollment(userId);
  if (existing && isPathSlug(existing.pathSlug)) {
    return existing;
  }
  const profile = await getProfileForUser(userId);
  return enrollUserInPath(userId, defaultPathSlug(profile));
}

export async function listCompletions(userId: string, pathSlug: string) {
  return prisma.pathStepCompletion.findMany({
    where: { userId, pathSlug },
  });
}

export async function markPathStepComplete(userId: string, pathSlug: string, stepKey: string) {
  const path = getPathBySlug(pathSlug);
  if (!path) {
    throw new NotFoundError("Path not found.");
  }
  if (!path.steps.some((step) => step.key === stepKey)) {
    throw new AppError("PATH", "That milestone is not on this path.");
  }
  const existing = await prisma.pathStepCompletion.findUnique({
    where: { userId_pathSlug_stepKey: { userId, pathSlug, stepKey } },
  });
  if (existing) {
    return { completion: existing, newlyCompleted: false };
  }
  const completion = await prisma.pathStepCompletion.create({
    data: { userId, pathSlug, stepKey },
  });
  return { completion, newlyCompleted: true };
}

async function autoCompleteHints(userId: string, path: TrainingPath) {
  const [program, sessions, lessons, progress, journalCount, bookings] = await Promise.all([
    findDemoProgram(),
    prisma.workoutSession.findMany({
      where: { userId, status: "complete" },
      select: { programDayId: true, difficultyRating: true },
    }),
    listPublishedLessons(),
    listLessonProgressForUser(userId),
    prisma.journalEntry.count({ where: { userId } }),
    prisma.bookingRequest.count({ where: { userId } }),
  ]);
  const completedDayNumbers = new Set(
    sessions
      .map((row) => program?.days.find((day) => day.id === row.programDayId)?.dayNumber)
      .filter((n): n is number => n != null),
  );
  const completedLessons = progress.filter((row) => row.completed).length;
  const rated = sessions.some((row) => row.difficultyRating);
  const newly: string[] = [];
  for (const step of path.steps) {
    let done = false;
    if (step.programDayNumber && completedDayNumbers.has(step.programDayNumber)) {
      done = true;
    }
    if (step.minWorkouts && sessions.length >= step.minWorkouts) {
      done = true;
    }
    if (step.lessonHint && completedLessons > 0) {
      done = true;
    }
    if (step.journalHint && journalCount > 0) {
      done = true;
    }
    if (step.checkinHint && (journalCount > 0 || bookings > 0)) {
      done = true;
    }
    if (step.key === "rate-feel" && rated) {
      done = true;
    }
    if (done) {
      const result = await markPathStepComplete(userId, path.slug, step.key);
      if (result.newlyCompleted) {
        newly.push(step.key);
      }
    }
  }
  return newly;
}

export async function getPathProgress(userId: string, pathSlug?: string) {
  const active = await ensureDefaultPath(userId);
  const viewedSlug = pathSlug && isPathSlug(pathSlug) ? pathSlug : active.pathSlug;
  const path = getPathBySlug(viewedSlug);
  if (!path) {
    throw new NotFoundError("Path not found.");
  }
  if (viewedSlug === active.pathSlug) {
    await autoCompleteHints(userId, path);
  }
  const completions = await listCompletions(userId, path.slug);
  const done = new Set(completions.map((row) => row.stepKey));
  const nextStep = path.steps.find((step) => !done.has(step.key)) ?? null;
  const completedCount = path.steps.filter((step) => done.has(step.key)).length;
  return {
    path,
    enrollmentSlug: active.pathSlug,
    doneKeys: [...done],
    nextStep,
    completedCount,
    totalSteps: path.steps.length,
    complete: completedCount === path.steps.length,
  };
}

export async function recommendedLessonForUser(userId: string) {
  const [profile, lessons, progress] = await Promise.all([
    getProfileForUser(userId),
    listPublishedLessons(),
    listLessonProgressForUser(userId),
  ]);
  const completed = new Set(progress.filter((row) => row.completed).map((row) => row.lessonId));
  const level = preferredLearnLevel(profile);
  const topic = preferredLearnTopic(profile);
  const matched = lessons.filter((lesson) => {
    const levelOk = lesson.skillLevel === level;
    const topicOk = !topic || lesson.topic === topic;
    return levelOk && topicOk;
  });
  const pool = matched.length > 0 ? matched : lessons.filter((lesson) => lesson.skillLevel === "beginner");
  return (
    pool.find((lesson) => !completed.has(lesson.id)) ??
    lessons.find((lesson) => !completed.has(lesson.id)) ??
    null
  );
}
