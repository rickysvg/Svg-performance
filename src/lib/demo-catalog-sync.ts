import { libraryReviewQueue } from "@/lib/combat-library";
import { prisma } from "@/lib/prisma";
import {
  BIKE_SESSIONS,
  bikeIntervalReps,
  isBikeIntervalName,
  scaleBikeSession,
} from "@/lib/bike-sessions";
import { demoBagSkillDays, demoStrengthDays } from "@/lib/demo-week-seed";
import { formatStoredTags, tagsForExercise } from "@/lib/exercise-tags";
import { fallbackLogMode, isWeightedShadowName } from "@/lib/exercise-log-mode";
import { formVideoFieldsFor } from "@/lib/form-videos";

const SKILL_SLUG = "demo-combat-skills";
const STRENGTH_SLUG = "demo-strength-base";

type CatalogExercise = {
  sortOrder: number;
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  notes: string;
  tags: string;
  formVideoUrl: string;
  formVideoPending: boolean;
  logMode: string;
};

type CatalogDay = {
  dayNumber: number;
  title: string;
  focus: string;
  exercises: CatalogExercise[];
};

type CatalogProgram = {
  slug: string;
  title: string;
  description: string;
  days: CatalogDay[];
};

export type DemoCatalogSyncResult = {
  ok: true;
  /** Workout rows and open drafts are never rewritten. */
  sessionsUntouched: true;
  library: {
    total: number;
    live: number;
    held: number;
    needsReview: number;
    needsTrim: number;
  };
  programs: Array<{
    slug: string;
    created: boolean;
    daysCreated: number;
    daysUpdated: number;
    daysUnchanged: number;
    /** Old day numbers that still have logged sessions. Left in place. */
    daysKeptForHistory: number;
    orphanDaysRemoved: number;
  }>;
};

function bikeProgramDay(session: (typeof BIKE_SESSIONS)[number]): CatalogDay {
  const scaled = scaleBikeSession(session, "beginner");
  return {
    dayNumber: session.programDayNumber,
    title: session.title,
    focus: session.focus,
    exercises: [
      normalizeCatalogExercise(STRENGTH_SLUG, {
        sortOrder: 1,
        name: scaled.name,
        sets: scaled.sets,
        reps: bikeIntervalReps(scaled),
        loadText: scaled.loadText,
        restSeconds: scaled.restBetweenSetsSeconds,
        notes: scaled.notes,
        tags: formatStoredTags(tagsForExercise(scaled.name)),
        ...formVideoFieldsFor(scaled.name),
      }),
    ],
  };
}

/** Same log-mode pass the seed uses, so a reseed matches a fresh `db:seed`. */
export function normalizeCatalogExercise(
  programSlug: string,
  exercise: {
    sortOrder: number;
    name: string;
    sets: number;
    reps: string;
    loadText: string;
    restSeconds: number;
    notes?: string;
    tags?: string;
    formVideoUrl?: string;
    formVideoPending?: boolean;
    logMode?: string;
  },
): CatalogExercise {
  let logMode = fallbackLogMode(exercise.name, exercise.reps);
  if (
    programSlug === SKILL_SLUG &&
    (logMode === "load_reps" || logMode === "load_timed") &&
    !isWeightedShadowName(exercise.name)
  ) {
    logMode = "timed_round";
  }
  let reps = exercise.reps;
  let restSeconds = exercise.restSeconds;
  let loadText = exercise.loadText;
  if (logMode === "timed") {
    if (
      /\b(plank|hold|wall sit|hollow|dead hang)\b/i.test(exercise.name) &&
      !/\bRIR\b/i.test(loadText)
    ) {
      loadText = "Hold — no weight";
    }
    if (/\bplank\b/i.test(exercise.name) && restSeconds < 60) restSeconds = 60;
  }
  if (logMode === "load_timed") {
    const hasMeter = /meter|\b\d+\s*m\b/i.test(reps);
    const hasTime = /\bsec\b|\d+\s*:/i.test(reps);
    if (!hasMeter && !hasTime) reps = "30–40 sec";
  }
  if (logMode === "reps_only" && /bodyweight/i.test(loadText) && !/\bRIR\b/i.test(loadText)) {
    loadText = "Bodyweight — no lbs";
  }
  if (logMode === "timed_round" && !isBikeIntervalName(exercise.name) && programSlug !== SKILL_SLUG) {
    reps = "2:00";
    restSeconds = 90;
  }
  return {
    sortOrder: exercise.sortOrder,
    name: exercise.name,
    sets: exercise.sets,
    reps,
    loadText,
    restSeconds,
    notes: exercise.notes ?? "",
    tags: formatStoredTags(tagsForExercise(exercise.name)),
    formVideoUrl: exercise.formVideoUrl ?? "",
    formVideoPending: Boolean(exercise.formVideoPending),
    logMode,
  };
}

function daysFromSeed(
  programSlug: string,
  days: Array<{
    dayNumber: number;
    title: string;
    focus: string;
    exercises: {
      create: Array<{
        sortOrder: number;
        name: string;
        sets: number;
        reps: string;
        loadText: string;
        restSeconds: number;
        notes?: string;
        tags?: string;
        formVideoUrl?: string;
        formVideoPending?: boolean;
        logMode?: string;
      }>;
    };
  }>,
): CatalogDay[] {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    title: day.title,
    focus: day.focus,
    exercises: day.exercises.create.map((exercise) => normalizeCatalogExercise(programSlug, exercise)),
  }));
}

export function desiredDemoPrograms(): CatalogProgram[] {
  return [
    {
      slug: STRENGTH_SLUG,
      title: "DEMO — Strength Base for Class",
      description:
        "Three full-body lift days (Monday, Tuesday, Thursday), a Friday circuit, Wednesday alactic bike, and Sunday aerobic bike. Bag work lives in Combat Skills. Daru Strong and other-coach items are credited and are not an SVG program or a coach endorsement. It is not a personalized fight-camp plan and has not been assigned to you by a coach.",
      days: [
        ...daysFromSeed(STRENGTH_SLUG, demoStrengthDays()),
        ...BIKE_SESSIONS.map((session) => bikeProgramDay(session)),
      ],
    },
    {
      slug: SKILL_SLUG,
      title: "DEMO — Combat Skills",
      description:
        "Three-week bag blocks (A jab IQ, B level changes, C traps and exits) with a distinct Mon–Fri focus. Every bag day starts with an empty-hand shadow round and a hand-weight shadow round (log lbs). Themed focus rounds, scaled ~30 / 35–40 / 45 min by athlete level. External YouTube form references — not SVG-produced film, and not a custom fight camp Ricky wrote live.",
      days: daysFromSeed(SKILL_SLUG, demoBagSkillDays()),
    },
  ];
}

function sameExercise(left: CatalogExercise, right: CatalogExercise) {
  return (
    left.sortOrder === right.sortOrder &&
    left.name === right.name &&
    left.sets === right.sets &&
    left.reps === right.reps &&
    left.loadText === right.loadText &&
    left.restSeconds === right.restSeconds &&
    left.notes === right.notes &&
    left.tags === right.tags &&
    left.formVideoUrl === right.formVideoUrl &&
    left.formVideoPending === right.formVideoPending &&
    left.logMode === right.logMode
  );
}

function sameDay(
  stored: { title: string; focus: string; exercises: CatalogExercise[] },
  desired: CatalogDay,
) {
  if (stored.title !== desired.title || stored.focus !== desired.focus) return false;
  if (stored.exercises.length !== desired.exercises.length) return false;
  const storedSorted = [...stored.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  const desiredSorted = [...desired.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  return desiredSorted.every((exercise, index) => sameExercise(exercise, storedSorted[index]!));
}

/**
 * Refresh the shared strength and bag catalogs in place.
 * Program and day ids stay when the day already exists. Logged sessions and
 * draft sets are not read or written. Safe to run more than once.
 */
export async function syncDemoCatalog(): Promise<DemoCatalogSyncResult> {
  const programs: DemoCatalogSyncResult["programs"] = [];
  for (const desired of desiredDemoPrograms()) {
    const existing = await prisma.program.findUnique({
      where: { slug: desired.slug },
      include: {
        days: {
          include: {
            exercises: true,
            _count: { select: { workoutSessions: true } },
          },
        },
      },
    });
    let created = false;
    let programId = existing?.id;
    if (!existing) {
      const program = await prisma.program.create({
        data: {
          slug: desired.slug,
          title: desired.title,
          description: desired.description,
          isDemo: true,
        },
      });
      programId = program.id;
      created = true;
    } else if (existing.title !== desired.title || existing.description !== desired.description) {
      await prisma.program.update({
        where: { id: existing.id },
        data: { title: desired.title, description: desired.description, isDemo: true },
      });
    }
    if (!programId) throw new Error("Catalog program id missing.");

    const byNumber = new Map((existing?.days ?? []).map((day) => [day.dayNumber, day]));
    const wanted = new Set(desired.days.map((day) => day.dayNumber));
    let daysCreated = 0;
    let daysUpdated = 0;
    let daysUnchanged = 0;
    let daysKeptForHistory = 0;
    let orphanDaysRemoved = 0;

    for (const day of desired.days) {
      const stored = byNumber.get(day.dayNumber);
      if (!stored) {
        await prisma.programDay.create({
          data: {
            programId,
            dayNumber: day.dayNumber,
            title: day.title,
            focus: day.focus,
            exercises: { create: day.exercises },
          },
        });
        daysCreated += 1;
        continue;
      }
      const normalized = stored.exercises.map((exercise) =>
        normalizeCatalogExercise(desired.slug, {
          sortOrder: exercise.sortOrder,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          loadText: exercise.loadText,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
          tags: exercise.tags,
          formVideoUrl: exercise.formVideoUrl,
          formVideoPending: exercise.formVideoPending,
          logMode: exercise.logMode,
        }),
      );
      if (
        sameDay(
          { title: stored.title, focus: stored.focus, exercises: normalized },
          day,
        )
      ) {
        daysUnchanged += 1;
        continue;
      }
      await prisma.$transaction([
        prisma.programDay.update({
          where: { id: stored.id },
          data: { title: day.title, focus: day.focus },
        }),
        prisma.programExercise.deleteMany({ where: { programDayId: stored.id } }),
        prisma.programExercise.createMany({
          data: day.exercises.map((exercise) => ({ ...exercise, programDayId: stored.id })),
        }),
      ]);
      daysUpdated += 1;
    }

    for (const stored of existing?.days ?? []) {
      if (wanted.has(stored.dayNumber)) continue;
      if (stored._count.workoutSessions > 0) {
        daysKeptForHistory += 1;
        continue;
      }
      await prisma.programDay.delete({ where: { id: stored.id } });
      orphanDaysRemoved += 1;
    }

    programs.push({
      slug: desired.slug,
      created,
      daysCreated,
      daysUpdated,
      daysUnchanged,
      daysKeptForHistory,
      orphanDaysRemoved,
    });
  }
  const queue = libraryReviewQueue();
  return {
    ok: true,
    sessionsUntouched: true,
    library: {
      total: queue.total,
      live: queue.live,
      held: queue.held,
      needsReview: queue.needsReview.length,
      needsTrim: queue.needsTrim.length,
    },
    programs,
  };
}

let inflight: Promise<DemoCatalogSyncResult> | null = null;

/** One catalog sync per server process. A failure clears the lock so the next read retries. */
export function ensureDemoCatalog() {
  if (!inflight) {
    inflight = syncDemoCatalog().catch((error) => {
      inflight = null;
      throw error;
    });
  }
  return inflight;
}
