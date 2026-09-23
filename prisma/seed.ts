import { PrismaClient } from "@prisma/client";
import { formVideoFieldsFor } from "../src/lib/form-videos";
import { LEARN_CATALOG, lessonSeedFromCatalog } from "../src/lib/learn-catalog";
import { fallbackLogMode } from "../src/lib/exercise-log-mode";

const prisma = new PrismaClient();

const DEMO_SLUG = "demo-strength-base";
const DEMO_SKILL_SLUG = "demo-combat-skills";

const BAG_OR_SHADOW =
  "Heavy bag or pads if you have them. Bodyweight only: shadow the same work at technical speed — no full power.";
const MAT_OR_TECHNICAL =
  "Open mat if you have one. No partner: technical reps on the floor, no slamming and no full-power shots.";

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
        "A three-day strength and conditioning template for this private preview. It is labeled DEMO on purpose. It is not a personalized fight-camp plan and has not been assigned to you by a coach.",
      isDemo: true,
      days: {
        create: [
          {
            dayNumber: 1,
            title: "Day 1 — Lower body + power",
            focus: "Legs, hips, and simple power",
            exercises: {
              create: [
                {
                  sortOrder: 1,
                  name: "Goblet squat",
                  sets: 3,
                  reps: "8",
                  loadText: "Moderate — last 2 reps should feel honest",
                  restSeconds: 90,
                  notes: "Hold a dumbbell or kettlebell at your chest. If you only have bodyweight, slow the lowering portion.",
                  ...formVideoFieldsFor("Goblet squat"),
                },
                {
                  sortOrder: 2,
                  name: "Romanian deadlift",
                  sets: 3,
                  reps: "8",
                  loadText: "Moderate — keep the back flat",
                  restSeconds: 90,
                  notes: "Hinge at the hips. Dumbbells, kettlebell, or a light barbell all work.",
                  ...formVideoFieldsFor("Romanian deadlift"),
                },
                {
                  sortOrder: 3,
                  name: "Reverse lunge",
                  sets: 3,
                  reps: "8 / leg",
                  loadText: "Bodyweight or light dumbbells",
                  restSeconds: 75,
                  notes: "Step back, keep the front knee tracking over the toes.",
                  ...formVideoFieldsFor("Reverse lunge"),
                },
                {
                  sortOrder: 4,
                  name: "Squat jump or box step-up",
                  sets: 3,
                  reps: "5",
                  loadText: "Bodyweight",
                  restSeconds: 90,
                  notes: "Choose step-ups if jumps bother your knees or you are new to plyometrics.",
                  ...formVideoFieldsFor("Squat jump or box step-up"),
                },
                {
                  sortOrder: 5,
                  name: "Front plank",
                  sets: 3,
                  reps: "30–45 sec",
                  loadText: "Hold — no weight",
                  restSeconds: 60,
                  notes: "Brace like someone is about to tap your stomach. Log the hold time, not pounds.",
                  ...formVideoFieldsFor("Front plank"),
                },
              ],
            },
          },
          {
            dayNumber: 2,
            title: "Day 2 — Upper body + grip",
            focus: "Push, pull, and carry",
            exercises: {
              create: [
                {
                  sortOrder: 1,
                  name: "Push-up or dumbbell bench press",
                  sets: 3,
                  reps: "8–12",
                  loadText: "Challenging but clean",
                  restSeconds: 75,
                  notes: "Elevate the hands if a full push-up is too hard. Do not bounce the chest.",
                  ...formVideoFieldsFor("Push-up or dumbbell bench press"),
                },
                {
                  sortOrder: 2,
                  name: "One-arm row",
                  sets: 3,
                  reps: "8 / side",
                  loadText: "Moderate dumbbell or band",
                  restSeconds: 75,
                  notes: "Support the free hand on a bench or box. Pull the elbow toward the hip.",
                  ...formVideoFieldsFor("One-arm row"),
                },
                {
                  sortOrder: 3,
                  name: "Overhead press",
                  sets: 3,
                  reps: "8",
                  loadText: "Moderate",
                  restSeconds: 90,
                  notes: "Dumbbells or a light bar. If overhead is painful, do a landmine or half-kneeling press instead.",
                  ...formVideoFieldsFor("Overhead press"),
                },
                {
                  sortOrder: 4,
                  name: "Band pull-apart or face pull",
                  sets: 3,
                  reps: "12",
                  loadText: "Light band",
                  restSeconds: 60,
                  notes: "Squeeze the shoulder blades. This is for shoulders that stay healthy in class.",
                  ...formVideoFieldsFor("Band pull-apart or face pull"),
                },
                {
                  sortOrder: 5,
                  name: "Farmer carry",
                  sets: 3,
                  reps: "30–40 meters",
                  loadText: "Heavy for you, walk tall",
                  restSeconds: 90,
                  notes: "Two dumbbells, kettlebells, or even loaded bags. Short, hard steps.",
                  ...formVideoFieldsFor("Farmer carry"),
                },
              ],
            },
          },
          {
            dayNumber: 3,
            title: "Day 3 — Hinge, pull, and conditioning",
            focus: "Posterior chain and work capacity",
            exercises: {
              create: [
                {
                  sortOrder: 1,
                  name: "Kettlebell swing or hip hinge",
                  sets: 4,
                  reps: "10",
                  loadText: "Crisp, not sloppy",
                  restSeconds: 60,
                  notes: "If you do not know the swing, do a hinge with a pause. Snap the hips; do not squat the bell.",
                  ...formVideoFieldsFor("Kettlebell swing or hip hinge"),
                },
                {
                  sortOrder: 2,
                  name: "Chin-up, band-assist, or lat pulldown",
                  sets: 3,
                  reps: "5–8",
                  loadText: "Full hang to control",
                  restSeconds: 90,
                  notes: "No bar? Do a slow inverted row under a sturdy table or a heavy band pulldown.",
                  ...formVideoFieldsFor("Chin-up, band-assist, or lat pulldown"),
                },
                {
                  sortOrder: 3,
                  name: "Lateral bound or side step-over",
                  sets: 3,
                  reps: "6 / side",
                  loadText: "Bodyweight",
                  restSeconds: 60,
                  notes: "Land quietly. Use step-overs if bounding feels too advanced.",
                  ...formVideoFieldsFor("Lateral bound or side step-over"),
                },
                {
                  sortOrder: 4,
                  name: "Jump rope or easy bike intervals",
                  sets: 8,
                  reps: "20 sec on / 40 sec easy",
                  loadText: "Hard but repeatable",
                  restSeconds: 0,
                  notes: "You should be able to talk in a short sentence after each bout. Stop for dizziness or chest pain.",
                  ...formVideoFieldsFor("Jump rope or easy bike intervals"),
                },
                {
                  sortOrder: 5,
                  name: "Side plank",
                  sets: 3,
                  reps: "20–30 sec / side",
                  loadText: "Hold — no weight",
                  restSeconds: 60,
                  notes: "Hips stacked. Log the hold time, not pounds. Drop to the knee if you need to.",
                  ...formVideoFieldsFor("Side plank"),
                },
              ],
            },
          },
        ],
      },
  });

  await replaceProgram(DEMO_SKILL_SLUG, {
    slug: DEMO_SKILL_SLUG,
    title: "DEMO — Combat Skills",
    description:
      "Technique-style DEMO sessions matched to intake focus. External YouTube form references — not SVG-produced film, and not a custom fight camp Ricky wrote live.",
    isDemo: true,
    days: {
      create: [
        {
          dayNumber: 1,
          title: "Heavy bag — hands to low kicks",
          focus: "Hands first, then low-kick combinations",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Jab–cross (1–2)",
                sets: 3,
                reps: "8",
                loadText: "Technical, snap the hands home",
                restSeconds: 60,
                notes: `Measure with the jab, turn the rear heel on the cross. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Jab–cross (1–2)"),
              },
              {
                sortOrder: 2,
                name: "Low kick (roundhouse)",
                sets: 3,
                reps: "6 / side",
                loadText: "Shin, not a floppy foot",
                restSeconds: 75,
                notes: `45° lead step, hip through, hands up. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Low kick (roundhouse)"),
              },
              {
                sortOrder: 3,
                name: "Hands to low-kick combo",
                sets: 4,
                reps: "6",
                loadText: "1-2 then the low kick",
                restSeconds: 75,
                notes: `Jab-cross, then the same-side or opposite low kick. Reset the guard before you admire it. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Hands to low-kick combo"),
              },
              {
                sortOrder: 4,
                name: "Teep (push kick)",
                sets: 3,
                reps: "6 / side",
                loadText: "Push, do not punt",
                restSeconds: 60,
                notes: `Chamber the knee, hips behind the kick, recover to stance. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Teep (push kick)"),
              },
              {
                sortOrder: 5,
                name: "Jump rope or easy bike intervals",
                sets: 6,
                reps: "20 sec on / 40 sec easy",
                loadText: "Hard but repeatable",
                restSeconds: 0,
                notes: "Easy gas-tank closer. Talk in a short sentence after each bout.",
                ...formVideoFieldsFor("Jump rope or easy bike intervals"),
              },
            ],
          },
        },
        {
          dayNumber: 2,
          title: "Clinch knees on the bag",
          focus: "Posture, then straight knees",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Double-collar clinch posture",
                sets: 3,
                reps: "30–40 sec",
                loadText: "Chest close, elbows in",
                restSeconds: 45,
                notes: `Hands behind the neck or on the bag collar, posture tall. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Double-collar clinch posture"),
              },
              {
                sortOrder: 2,
                name: "Straight knee (clinch)",
                sets: 4,
                reps: "8 / side",
                loadText: "Hip through, heel to glute",
                restSeconds: 60,
                notes: `Pull the bag down as the hip comes forward. No jumping knees. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Straight knee (clinch)"),
              },
              {
                sortOrder: 3,
                name: "Alternate knee rhythm",
                sets: 3,
                reps: "45 sec",
                loadText: "Steady, not sloppy",
                restSeconds: 60,
                notes: `Left-right knees without losing the clinch. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Alternate knee rhythm"),
              },
              {
                sortOrder: 4,
                name: "Exit the clinch / frame",
                sets: 3,
                reps: "6",
                loadText: "Frame, step off, hands up",
                restSeconds: 45,
                notes: "Create a frame, step off the bag, reset stance. Technical — not a shove contest.",
                ...formVideoFieldsFor("Exit the clinch / frame"),
              },
              {
                sortOrder: 5,
                name: "Front plank",
                sets: 3,
                reps: "30–45 sec",
                loadText: "Bodyweight",
                restSeconds: 45,
                notes: "Brace. Stop if the low back sags.",
                ...formVideoFieldsFor("Front plank"),
              },
            ],
          },
        },
        {
          dayNumber: 3,
          title: "Jab-cross-hook bag rounds",
          focus: "Boxing bag combinations",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Boxing jab",
                sets: 3,
                reps: "10",
                loadText: "Snap and recover",
                restSeconds: 45,
                notes: `Lead shoulder covers the chin. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Boxing jab"),
              },
              {
                sortOrder: 2,
                name: "Jab–cross (1–2)",
                sets: 4,
                reps: "8",
                loadText: "Step and punch together",
                restSeconds: 60,
                notes: `Do not leave the cross hanging. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Jab–cross (1–2)"),
              },
              {
                sortOrder: 3,
                name: "Lead hook",
                sets: 3,
                reps: "8",
                loadText: "90° elbow, thumb up",
                restSeconds: 60,
                notes: `Throw it after a 1-2 so the weight is already transferred. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("Lead hook"),
              },
              {
                sortOrder: 4,
                name: "1-2-3 bag rounds",
                sets: 4,
                reps: "60 sec",
                loadText: "Jab-cross-hook, then reset",
                restSeconds: 60,
                notes: `Easy rounds. Hands home after the hook. ${BAG_OR_SHADOW}`,
                ...formVideoFieldsFor("1-2-3 bag rounds"),
              },
              {
                sortOrder: 5,
                name: "Jump rope or easy bike intervals",
                sets: 6,
                reps: "20 sec on / 40 sec easy",
                loadText: "Hard but repeatable",
                restSeconds: 0,
                notes: "Easy closer. Stop for dizziness or chest pain.",
                ...formVideoFieldsFor("Jump rope or easy bike intervals"),
              },
            ],
          },
        },
        {
          dayNumber: 4,
          title: "Ground-and-pound drill",
          focus: "Top control, then short strikes",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Mount / high-posture hold",
                sets: 3,
                reps: "30 sec",
                loadText: "Wide base, hips heavy",
                restSeconds: 45,
                notes: `Posture first. Bag on the floor or a dummy if you have one. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Mount / high-posture hold"),
              },
              {
                sortOrder: 2,
                name: "Short punch from mount",
                sets: 4,
                reps: "8",
                loadText: "Post, then punch",
                restSeconds: 45,
                notes: `One hand posts, the other punches short. No wild elbows. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Short punch from mount"),
              },
              {
                sortOrder: 3,
                name: "Hip drive + post",
                sets: 3,
                reps: "6 / side",
                loadText: "Stay balanced",
                restSeconds: 45,
                notes: `Drive the hip, post the far hand, do not get rolled. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Hip drive + post"),
              },
              {
                sortOrder: 4,
                name: "Ground-and-pound burst",
                sets: 5,
                reps: "15 sec",
                loadText: "Control, then 4–6 honest shots",
                restSeconds: 45,
                notes: `Short bursts. Reset posture between bouts. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Ground-and-pound burst"),
              },
              {
                sortOrder: 5,
                name: "Front plank",
                sets: 3,
                reps: "30–45 sec",
                loadText: "Bodyweight",
                restSeconds: 45,
                notes: "Brace. Stop if the low back sags.",
                ...formVideoFieldsFor("Front plank"),
              },
            ],
          },
        },
        {
          dayNumber: 5,
          title: "Shot + sprawl",
          focus: "Wrestling entry and defensive hips",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Level change (penetration step)",
                sets: 3,
                reps: "8",
                loadText: "Hips under the shoulders",
                restSeconds: 45,
                notes: `Drop the level before the trail knee moves. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Level change (penetration step)"),
              },
              {
                sortOrder: 2,
                name: "Double-leg entry",
                sets: 4,
                reps: "5 / side",
                loadText: "Technical — no blasting",
                restSeconds: 60,
                notes: `Cheek to the ribs, hands behind the knees, stand and turn. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Double-leg entry"),
              },
              {
                sortOrder: 3,
                name: "Sprawl",
                sets: 4,
                reps: "6",
                loadText: "Hips down and back",
                restSeconds: 45,
                notes: `Chest covers the shot, then reset the stance. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Sprawl"),
              },
              {
                sortOrder: 4,
                name: "Shot–sprawl reset",
                sets: 3,
                reps: "45 sec",
                loadText: "Easy pace",
                restSeconds: 60,
                notes: `One technical shot, one sprawl, stand up. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Shot–sprawl reset"),
              },
              {
                sortOrder: 5,
                name: "Side plank",
                sets: 3,
                reps: "20–30 sec / side",
                loadText: "Bodyweight",
                restSeconds: 45,
                notes: "Hips stacked. Drop to the knee if you need to.",
                ...formVideoFieldsFor("Side plank"),
              },
            ],
          },
        },
        {
          dayNumber: 6,
          title: "Closed guard positional drill",
          focus: "BJJ posture, hips, and frames",
          exercises: {
            create: [
              {
                sortOrder: 1,
                name: "Closed guard posture break",
                sets: 3,
                reps: "6",
                loadText: "Legs + one honest grip",
                restSeconds: 45,
                notes: `Break posture before you hunt a sweep. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Closed guard posture break"),
              },
              {
                sortOrder: 2,
                name: "Hip escape (shrimp)",
                sets: 3,
                reps: "8 / side",
                loadText: "Hips, not a bicycle kick",
                restSeconds: 45,
                notes: `Plant, lift, push the hips away. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Hip escape (shrimp)"),
              },
              {
                sortOrder: 3,
                name: "Closed guard hip tilt",
                sets: 3,
                reps: "8",
                loadText: "Angle, not a flat back",
                restSeconds: 45,
                notes: `Tilt the hips and recover. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Closed guard hip tilt"),
              },
              {
                sortOrder: 4,
                name: "Frame and recover",
                sets: 3,
                reps: "6",
                loadText: "Elbow to knee",
                restSeconds: 45,
                notes: `Frame, shrimp, insert the knee. ${MAT_OR_TECHNICAL}`,
                ...formVideoFieldsFor("Frame and recover"),
              },
              {
                sortOrder: 5,
                name: "Front plank",
                sets: 3,
                reps: "30–45 sec",
                loadText: "Bodyweight",
                restSeconds: 45,
                notes: "Brace. Stop if the low back sags.",
                ...formVideoFieldsFor("Front plank"),
              },
            ],
          },
        },
      ],
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
        if (program.slug === DEMO_SKILL_SLUG && logMode !== "timed") {
          logMode = "timed_round";
        }
        const data: {
          logMode: string;
          reps?: string;
          restSeconds?: number;
          loadText?: string;
        } = { logMode };
        if (logMode === "timed") {
          data.loadText = /jump rope|bike|interval/i.test(exercise.name)
            ? exercise.loadText
            : "Hold — no weight";
          if (/\bplank\b/i.test(exercise.name) && exercise.restSeconds < 60) {
            data.restSeconds = 60;
          }
        }
        if (logMode === "timed_round") {
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
