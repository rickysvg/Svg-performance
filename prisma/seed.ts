import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SLUG = "demo-strength-base";

async function main() {
  const existing = await prisma.program.findUnique({
    where: { slug: DEMO_SLUG },
  });

  if (existing) {
    await prisma.program.delete({ where: { slug: DEMO_SLUG } });
  }

  await prisma.program.create({
    data: {
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
                },
                {
                  sortOrder: 2,
                  name: "Romanian deadlift",
                  sets: 3,
                  reps: "8",
                  loadText: "Moderate — keep the back flat",
                  restSeconds: 90,
                  notes: "Hinge at the hips. Dumbbells, kettlebell, or a light barbell all work.",
                },
                {
                  sortOrder: 3,
                  name: "Reverse lunge",
                  sets: 3,
                  reps: "8 / leg",
                  loadText: "Bodyweight or light dumbbells",
                  restSeconds: 75,
                  notes: "Step back, keep the front knee tracking over the toes.",
                },
                {
                  sortOrder: 4,
                  name: "Squat jump or box step-up",
                  sets: 3,
                  reps: "5",
                  loadText: "Bodyweight",
                  restSeconds: 90,
                  notes: "Choose step-ups if jumps bother your knees or you are new to plyometrics.",
                },
                {
                  sortOrder: 5,
                  name: "Front plank",
                  sets: 3,
                  reps: "30–45 sec",
                  loadText: "Bodyweight",
                  restSeconds: 45,
                  notes: "Brace like someone is about to tap your stomach. Stop if the low back sags.",
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
                },
                {
                  sortOrder: 2,
                  name: "One-arm row",
                  sets: 3,
                  reps: "8 / side",
                  loadText: "Moderate dumbbell or band",
                  restSeconds: 75,
                  notes: "Support the free hand on a bench or box. Pull the elbow toward the hip.",
                },
                {
                  sortOrder: 3,
                  name: "Overhead press",
                  sets: 3,
                  reps: "8",
                  loadText: "Moderate",
                  restSeconds: 90,
                  notes: "Dumbbells or a light bar. If overhead is painful, do a landmine or half-kneeling press instead.",
                },
                {
                  sortOrder: 4,
                  name: "Band pull-apart or face pull",
                  sets: 3,
                  reps: "12",
                  loadText: "Light band",
                  restSeconds: 60,
                  notes: "Squeeze the shoulder blades. This is for shoulders that stay healthy in class.",
                },
                {
                  sortOrder: 5,
                  name: "Farmer carry",
                  sets: 3,
                  reps: "30–40 meters",
                  loadText: "Heavy for you, walk tall",
                  restSeconds: 90,
                  notes: "Two dumbbells, kettlebells, or even loaded bags. Short, hard steps.",
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
                },
                {
                  sortOrder: 2,
                  name: "Chin-up, band-assist, or lat pulldown",
                  sets: 3,
                  reps: "5–8",
                  loadText: "Full hang to control",
                  restSeconds: 90,
                  notes: "No bar? Do a slow inverted row under a sturdy table or a heavy band pulldown.",
                },
                {
                  sortOrder: 3,
                  name: "Lateral bound or side step-over",
                  sets: 3,
                  reps: "6 / side",
                  loadText: "Bodyweight",
                  restSeconds: 60,
                  notes: "Land quietly. Use step-overs if bounding feels too advanced.",
                },
                {
                  sortOrder: 4,
                  name: "Jump rope or easy bike intervals",
                  sets: 8,
                  reps: "20 sec on / 40 sec easy",
                  loadText: "Hard but repeatable",
                  restSeconds: 0,
                  notes: "You should be able to talk in a short sentence after each bout. Stop for dizziness or chest pain.",
                },
                {
                  sortOrder: 5,
                  name: "Side plank",
                  sets: 3,
                  reps: "20–30 sec / side",
                  loadText: "Bodyweight",
                  restSeconds: 45,
                  notes: "Hips stacked. Drop to the knee if you need to.",
                },
              ],
            },
          },
        ],
      },
    },
  });
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
