import { PrismaClient } from "@prisma/client";
import { formVideoFieldsFor } from "../src/lib/form-videos";
import { lessonVideoFieldsFor } from "../src/lib/lesson-videos";

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
                  loadText: "Bodyweight",
                  restSeconds: 45,
                  notes: "Brace like someone is about to tap your stomach. Stop if the low back sags.",
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
                  loadText: "Bodyweight",
                  restSeconds: 45,
                  notes: "Hips stacked. Drop to the knee if you need to.",
                  ...formVideoFieldsFor("Side plank"),
                },
              ],
            },
          },
        ],
      },
    },
  });

  const lessons = [
    {
      slug: "demo-stance-base",
      title: "DEMO — MMA stance and first step",
      summary: "A beginner MMA stance checklist plus a first sprawl step. Not paid SVG video.",
      skillLevel: "beginner",
      topic: "mma",
      coachName: "SVG coaching staff",
      equipment: "Open mat",
      notes:
        "Feet about shoulder width, hands up, chin down. This DEMO note is class homework, not a replacement for live coaching.",
      keyDetails:
        "Weight on the balls of the feet, not the heels.\nHands frame the face — elbows in.\nFirst defensive step: hips down, legs back, chest over their shot.\nReset the stance after every sprawl.",
      drills: "Shadow 3 rounds of 1 minute: step in, step out, reset. Then 8 easy sprawls.",
      needsSupervision: false,
      supervisedNote: "",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-stance-base"),
    },
    {
      slug: "demo-jab-cue",
      title: "DEMO — Boxing jab cue",
      summary: "A single jab reminder for adults new to boxing.",
      skillLevel: "beginner",
      topic: "boxing",
      coachName: "SVG coaching staff",
      equipment: "Open mat or bag",
      notes: "Turn the shoulder, do not reach with the chin. Ask a coach to watch one set.",
      keyDetails:
        "Drive off the rear foot — the jab is a full-body punch.\nFist finishes palm-down; lead shoulder covers the chin.\nSnap the hand home. Do not leave it hanging.\nChin stays down; do not chase range with the face.",
      drills: "10 jabs, walk back, reset. Three easy sets.",
      needsSupervision: true,
      supervisedNote: "Do this on the bag or with a coach. Do not spar this drill unsupervised.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-jab-cue"),
    },
    {
      slug: "demo-hip-escape",
      title: "DEMO — Jiu-Jitsu hip escape",
      summary: "A beginner shrimp / hip-escape note for class homework.",
      skillLevel: "beginner",
      topic: "jiu-jitsu",
      coachName: "SVG coaching staff",
      equipment: "Open mat",
      notes: "Shrimp to create space. Slow is fine. Stop if the neck feels wrong.",
      keyDetails:
        "Plant one foot, lift the hips, then push the hips away — not just kick the legs.\nLook over the far shoulder so the neck stays long.\nCreate a frame before you shrimp.\nStop if anything in the neck or shoulder feels wrong.",
      drills: "8 hip escapes each side, rest, repeat twice.",
      needsSupervision: true,
      supervisedNote: "Practice with a partner or coach so someone can watch your neck and shoulders.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-hip-escape"),
    },
    {
      slug: "demo-teep-cue",
      title: "DEMO — Muay Thai teep",
      summary: "A beginner push-kick reminder. YouTube reference is not SVG film.",
      skillLevel: "beginner",
      topic: "muay-thai",
      coachName: "SVG coaching staff",
      equipment: "Open mat or bag",
      notes:
        "The teep is a measuring tool first. Lift the knee, push the ball of the foot, sit back on the standing leg. Do not turn it into a wild front kick.",
      keyDetails:
        "Chamber the knee before the foot travels.\nPush through the ball of the foot, hips behind the kick.\nHands stay up while the kick goes.\nRecover the foot to stance — do not hop into the pocket.",
      drills: "8 easy teeps each side on air or a bag. Walk back, reset, two more sets.",
      needsSupervision: true,
      supervisedNote: "Bag or coach eyes. No live kicking of a partner without pads and a coach.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-teep-cue"),
    },
    {
      slug: "demo-double-leg",
      title: "DEMO — Wrestling double-leg entry",
      summary: "A beginner double-leg posture note for drilling, not live shooting.",
      skillLevel: "beginner",
      topic: "wrestling",
      coachName: "SVG coaching staff",
      equipment: "Open mat",
      notes:
        "Change level, step between their feet, cheek to their ribs, hands behind the knees. Head up. This is a drill cue, not a green light to shoot on a teammate.",
      keyDetails:
        "Level change first — hips drop under your shoulders.\nTrail the back knee; do not dive with a straight spine.\nHead stays up on the side of the body, not the middle of the chest.\nHands clasp behind the knees, then stand and turn the corner.",
      drills: "5 slow technical stand-up entries each side. No live blasting.",
      needsSupervision: true,
      supervisedNote: "Drill with a coach or a willing partner who knows you are going slow.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-double-leg"),
    },
    {
      slug: "demo-cage-clinch",
      title: "DEMO — Cagework clinch on the fence",
      summary: "A beginner cage-clinch reminder. YouTube reference is not SVG film.",
      skillLevel: "beginner",
      topic: "cagework",
      coachName: "SVG coaching staff",
      equipment: "Cage or wall + coach",
      notes:
        "Control posture on the fence before you try to lift. Shoulder pressure, inside position, then a level change. Do not yank someone off the wall.",
      keyDetails:
        "Shoulder pressure first — do not reach around empty air.\nInside hand position before the lift.\nLevel change under their hips; do not pull them down the fence.\nTurn them off the cage only when your feet are set.",
      drills: "3 slow positional starts on the wall. Reset after each.",
      needsSupervision: true,
      supervisedNote: "Cage or wall work needs a coach in the room. Do not invent this at home.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-cage-clinch"),
    },
    {
      slug: "demo-boxing-one-two",
      title: "DEMO — Boxing 101 details",
      summary: "Intermediate boxing map after the single jab — so the level filter clearly changes.",
      skillLevel: "intermediate",
      topic: "boxing",
      coachName: "SVG coaching staff",
      equipment: "Bag or coach",
      notes:
        "The 1-2 is still a jab that measures, then a cross that turns. If the jab is a reach, the cross has nowhere honest to land.",
      keyDetails:
        "Jab lands and the rear heel is already starting to turn.\nCross hip and shoulder travel together — no arm-only right hand.\nChin stays behind the punching shoulder on both shots.\nRecover both hands to guard before you admire the combo.",
      drills: "6 easy 1-2s, step out, reset. Three rounds of one minute.",
      needsSupervision: true,
      supervisedNote: "Bag or pads. No unsupervised sparring of this combo.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-boxing-one-two"),
    },
    {
      slug: "demo-shrimp-frames",
      title: "DEMO — Jiu-Jitsu shrimp under pressure",
      summary: "Intermediate hip-escape details once the basic shrimp is familiar.",
      skillLevel: "intermediate",
      topic: "jiu-jitsu",
      coachName: "SVG coaching staff",
      equipment: "Open mat + partner",
      notes:
        "Under pressure the shrimp is a frame-then-hip story. If you only kick the legs, a decent top player follows you.",
      keyDetails:
        "Frame first — elbow and forearm make the shelf.\nBridge to create the first inch, then shrimp into that space.\nTurn the hips, not just the feet.\nRe-guard or knee-in as soon as the space appears. Do not shrimp forever.",
      drills: "Partner side-control starts. Bridge, shrimp, recover guard. 6 each side.",
      needsSupervision: true,
      supervisedNote: "Partner or coach. Watch necks and shoulders.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-shrimp-frames"),
    },
    {
      slug: "demo-cage-exit",
      title: "DEMO — Cagework exit and circle off",
      summary: "Intermediate fence-exit notes. Video is pending coach review.",
      skillLevel: "intermediate",
      topic: "cagework",
      coachName: "SVG coaching staff",
      equipment: "Cage or wall + coach",
      notes:
        "Getting stuck on the fence is a posture problem first. Create a frame, drop your level, and circle toward the open side. Do not spin blindly into the underhook.",
      keyDetails:
        "Hands on hips or biceps — not around the waist with a broken posture.\nStep the trail foot out before you try to walk the circle.\nHead stays off the fence; do not grind your own face into the mesh.\nIf you cannot circle, pummel for the underhook and wait for the coach cue.",
      drills: "3 wall starts. Frame, step, circle off. Reset.",
      needsSupervision: true,
      supervisedNote: "Coach in the room. This is not a living-room drill.",
      status: "published",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-cage-exit"),
    },
    {
      slug: "demo-draft-only",
      title: "DEMO — Draft only (members should not see this)",
      summary: "Unpublished draft used to test admin publishing.",
      skillLevel: "intermediate",
      topic: "wrestling",
      coachName: "SVG coaching staff",
      equipment: "None",
      notes: "If you can read this as a member, publishing is broken.",
      keyDetails: "Drafts stay hidden.",
      drills: "None.",
      needsSupervision: false,
      supervisedNote: "",
      status: "draft",
      isDemo: true,
      ...lessonVideoFieldsFor("demo-draft-only"),
    },
  ];

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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
