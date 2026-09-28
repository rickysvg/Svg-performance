import { PrismaClient } from "@prisma/client";
import {
  BIKE_SESSIONS,
  bikeIntervalReps,
  isBikeIntervalName,
  scaleBikeSession,
} from "../src/lib/bike-sessions";
import { demoBagSkillDays, demoStrengthDays } from "../src/lib/demo-week-seed";
import { formVideoFieldsFor } from "../src/lib/form-videos";
import { LEARN_CATALOG, lessonSeedFromCatalog } from "../src/lib/learn-catalog";
import { fallbackLogMode } from "../src/lib/exercise-log-mode";

function bikeProgramDay(session: (typeof BIKE_SESSIONS)[number]) {
  const scaled = scaleBikeSession(session, "beginner");
  return {
    dayNumber: session.programDayNumber,
    title: session.title,
    focus: session.focus,
    exercises: {
      create: [
        {
          sortOrder: 1,
          name: scaled.name,
          sets: scaled.sets,
          reps: bikeIntervalReps(scaled),
          loadText: scaled.loadText,
          restSeconds: scaled.restBetweenSetsSeconds,
          notes: scaled.notes,
          ...formVideoFieldsFor(scaled.name),
        },
      ],
    },
  };
}

const prisma = new PrismaClient();

const DEMO_SLUG = "demo-strength-base";
const DEMO_SKILL_SLUG = "demo-combat-skills";

async function replaceProgram(
  slug: string,
  data: Parameters<typeof prisma.program.create>[0]["data"],
) {
  const existing = await prisma.program.findUnique({ where: { slug } });
  if (existing) {
    await prisma.program.delete({ where: { slug } });
  }
  await prisma.program.create({ data });
}

async function main() {
  await replaceProgram(DEMO_SLUG, {
      slug: DEMO_SLUG,
      title: "DEMO — Strength Base for Class",
      description:
        "A five-day strength / GPP skeleton plus Tuesday/Thursday assault-bike rotation for this private preview. Bag work lives in DEMO Combat Skills. Daru Strong and other-coach items are credited and are not an SVG program or a coach endorsement. It is labeled DEMO on purpose. It is not a personalized fight-camp plan and has not been assigned to you by a coach.",
      isDemo: true,
      days: {
        create: [
          ...demoStrengthDays(),
          ...BIKE_SESSIONS.map((session) => bikeProgramDay(session)),
        ],
      },
  });

  await replaceProgram(DEMO_SKILL_SLUG, {
    slug: DEMO_SKILL_SLUG,
    title: "DEMO — Combat Skills",
    description:
      "Bag rounds with a distinct Mon–Fri focus (boxing, kicks, body shots, clinch, defense). Scaled ~30 / 35–40 / 45 min by athlete level. External YouTube form references — not SVG-produced film, and not a custom fight camp Ricky wrote live.",
    isDemo: true,
    days: {
      create: demoBagSkillDays(),
    },
  });

  await tagSeededExerciseModes();

  const lessons = LEARN_CATALOG.map(lessonSeedFromCatalog);

  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      update: lesson,
      create: lesson,
    });
  }

  const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  if (bootstrap) {
    const admin = await prisma.user.findUnique({
      where: { email: bootstrap.toLowerCase() },
    });
    if (admin && admin.role !== "admin") {
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: "admin" },
      });
    }
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await prisma.svgChallenge.upsert({
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
    update: { active: true },
  });

  const anyAdmin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (anyAdmin) {
    const monday = new Date(now);
    const weekday = monday.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const existingFocus = await prisma.weeklyFocusVideo.findFirst({
      where: { weekStart: monday, isDemo: true },
    });
    if (!existingFocus) {
      await prisma.weeklyFocusVideo.create({
        data: {
          title: "DEMO — This week's 60–90s focus",
          weekStart: monday,
          videoUrl: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
          scriptNotes: "Labeled DEMO. External YouTube technique reference — not a live Ricky stream.",
          status: "published",
          isDemo: true,
          authorUserId: anyAdmin.id,
        },
      });
    }
  }
}

async function tagSeededExerciseModes() {
  const programs = await prisma.program.findMany({
    include: { days: { include: { exercises: true } } },
  });
  for (const program of programs) {
    for (const day of program.days) {
      for (const exercise of day.exercises) {
        let logMode = fallbackLogMode(exercise.name, exercise.reps);
        if (program.slug === DEMO_SKILL_SLUG && (logMode === "load_reps" || logMode === "load_timed")) {
          logMode = "timed_round";
        }
        const data: {
          logMode: string;
          reps?: string;
          restSeconds?: number;
          loadText?: string;
        } = { logMode };
        if (logMode === "timed") {
          if (/\b(plank|hold|wall sit|hollow|dead hang)\b/i.test(exercise.name)) {
            data.loadText = "Hold — no weight";
          }
          if (/\bplank\b/i.test(exercise.name) && exercise.restSeconds < 60) {
            data.restSeconds = 60;
          }
        }
        if (logMode === "load_timed") {
          if (/meter/i.test(exercise.reps) || !/\bsec\b|\d+\s*:/i.test(exercise.reps)) {
            data.reps = "30–40 sec";
          }
        }
        if (logMode === "reps_only" && /bodyweight/i.test(exercise.loadText)) {
          data.loadText = "Bodyweight — no lbs";
        }
        if (logMode === "timed_round" && !isBikeIntervalName(exercise.name)) {
          data.reps = "2:00";
          data.restSeconds = 90;
        }
        await prisma.programExercise.update({ where: { id: exercise.id }, data });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
