/**
 * Demo athlete for Streaks / Records screenshots.
 * Run: npx tsx scripts/seed-companion-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { completeOnboardingForUser } from "../src/lib/onboarding";
import { continueWithFreePlan } from "../src/lib/trial";
import { addZonedDays, startOfZonedDay } from "../src/lib/timezone";

const prisma = new PrismaClient();
const EMAIL = "streaks@example.com";
const PASSWORD = "password12";
const TZ = "America/Denver";

async function logDay(
  userId: string,
  performedAt: Date,
  sets: Array<{
    exerciseName: string;
    reps?: number | null;
    loadValue?: number | null;
    loadUnit?: string;
    durationSeconds?: number | null;
    logMode?: string;
  }>,
) {
  await prisma.workoutSession.create({
    data: {
      userId,
      title: "Logged session",
      performedAt,
      status: "complete",
      sets: {
        create: sets.map((set, index) => ({
          exerciseName: set.exerciseName,
          setNumber: index + 1,
          sortOrder: index,
          reps: set.reps ?? null,
          loadValue: set.loadValue ?? null,
          loadUnit: set.loadUnit ?? "kg",
          durationSeconds: set.durationSeconds ?? null,
          logMode: set.logMode ?? "load_reps",
          completed: true,
        })),
      },
    },
  });
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.workoutSession.deleteMany({ where: { userId: existing.id } });
    await prisma.bodyMetric.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      profile: {
        create: {
          displayName: "You",
          isAdultConfirmed: true,
          preferredUnits: "kg",
          timeZone: TZ,
          leaderboardOptIn: true,
        },
      },
    },
  });

  await completeOnboardingForUser(user.id, {
    displayName: "You",
    goalKey: "stronger-for-class",
    goalNote: "",
    experienceLevel: "intermediate",
    primaryFocus: "general-fitness",
    equipment: ["Dumbbells", "Barbell / rack", "Bike or assault bike"],
    weeklyAvailability: ["Monday", "Wednesday", "Friday"],
    sessionsPerWeek: 5,
    preferredUnits: "kg",
    trainingLimitations: "",
    foodPreferences: "",
    allergies: "",
  });
  await continueWithFreePlan(user.id);
  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      displayName: "You",
      leaderboardOptIn: true,
      timeZone: TZ,
      preferredUnits: "kg",
    },
  });

  const now = new Date("2026-09-25T18:00:00.000Z");
  const today = startOfZonedDay(now, TZ);

  // 12 scheduled days ending today so the streak hero has a real number.
  const completedOffsets = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15];
  for (const offset of completedOffsets) {
    const at = addZonedDays(today, -offset, TZ);
    const load = 150 + Math.min(30, completedOffsets.length - completedOffsets.indexOf(offset)) * 2.5;
    await logDay(user.id, at, [
      {
        exerciseName: "Trap bar deadlift",
        reps: 3,
        loadValue: load,
        loadUnit: "kg",
        logMode: "load_reps",
      },
      {
        exerciseName: "Assault bike 15/15",
        durationSeconds: 15,
        logMode: "timed_round",
      },
      {
        exerciseName: "Front plank hold",
        durationSeconds: offset === 0 ? 160 : 90,
        logMode: "timed",
      },
    ]);
  }

  await prisma.bodyMetric.create({
    data: {
      userId: user.id,
      kind: "weight",
      value: 79.8,
      unit: "kg",
      recordedAt: now,
    },
  });

  const others = [
    { email: "maya@example.com", name: "Maya J.", workouts: 9 },
    { email: "dani@example.com", name: "Dani K.", workouts: 11 },
    { email: "sam@example.com", name: "Sam L.", workouts: 8 },
  ];
  for (const other of others) {
    const prior = await prisma.user.findUnique({ where: { email: other.email } });
    if (prior) {
      await prisma.workoutSession.deleteMany({ where: { userId: prior.id } });
      await prisma.user.delete({ where: { id: prior.id } });
    }
    const row = await prisma.user.create({
      data: {
        email: other.email,
        passwordHash: await hashPassword(PASSWORD),
        profile: {
          create: {
            displayName: other.name,
            isAdultConfirmed: true,
            leaderboardOptIn: true,
            claimsGymMembership: true,
            gymMembershipVerified: true,
            timeZone: TZ,
          },
        },
      },
    });
    for (let i = 0; i < other.workouts; i += 1) {
      await logDay(row.id, addZonedDays(today, -i, TZ), [
        { exerciseName: "Goblet squat", reps: 8, loadValue: 24, loadUnit: "kg" },
      ]);
    }
  }

  console.log(`Seeded ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
