/**
 * Local screenshot athlete only. Never shipped as production seed.
 * prisma/seed.ts does not create opted-in fake names or a leaderboard.
 * Run: npx tsx scripts/seed-companion-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { completeOnboardingForUser } from "../src/lib/onboarding";
import { continueWithFreePlan } from "../src/lib/trial";
import { addZonedDays, startOfZonedDay } from "../src/lib/timezone";
import { isScheduledTrainingDay } from "../src/lib/streaks";
import type { PlannerPrefs } from "../src/lib/week-plan";

const prisma = new PrismaClient();
const EMAIL = "streaks@example.com";
const PASSWORD = "password12";
const TZ = "America/Denver";
const PREFS: PlannerPrefs = {
  primaryFocus: "general-fitness",
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
  sessionsPerWeek: 5,
};

/** Leftover local screenshot accounts from the first pass — never recreate. */
const LOCAL_FAKE_BOARD = ["maya@example.com", "dani@example.com", "sam@example.com"];

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
          loadUnit: set.loadUnit ?? "lb",
          durationSeconds: set.durationSeconds ?? null,
          logMode: set.logMode ?? "load_reps",
          completed: true,
        })),
      },
    },
  });
}

async function deleteUserByEmail(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) return;
  await prisma.workoutSession.deleteMany({ where: { userId: existing.id } });
  await prisma.bodyMetric.deleteMany({ where: { userId: existing.id } });
  await prisma.user.delete({ where: { id: existing.id } });
}

function recentScheduledDays(now: Date, count: number) {
  const today = startOfZonedDay(now, TZ);
  const days: Date[] = [];
  let cursor = addZonedDays(today, -1, TZ);
  for (let i = 0; i < 400 && days.length < count; i += 1) {
    if (isScheduledTrainingDay(PREFS, cursor, TZ)) {
      days.push(cursor);
    }
    cursor = addZonedDays(cursor, -1, TZ);
  }
  return days.reverse();
}

async function main() {
  await deleteUserByEmail(EMAIL);
  for (const email of LOCAL_FAKE_BOARD) {
    await deleteUserByEmail(email);
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      profile: {
        create: {
          displayName: "You",
          isAdultConfirmed: true,
          preferredUnits: "lb",
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
    preferredUnits: "lb",
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
      preferredUnits: "lb",
    },
  });

  const now = new Date();
  const scheduled = recentScheduledDays(now, 12);
  for (const at of scheduled) {
    const index = scheduled.indexOf(at);
    const load = 295 + index * 10;
    const bikeRounds = index === scheduled.length - 1 ? 8 : 5;
    const sets: Array<{
      exerciseName: string;
      reps?: number | null;
      loadValue?: number | null;
      loadUnit?: string;
      durationSeconds?: number | null;
      logMode?: string;
    }> = [
      {
        exerciseName: "Trap bar deadlift",
        reps: 3,
        loadValue: load,
        loadUnit: "lb",
        logMode: "load_reps",
      },
    ];
    for (let i = 0; i < bikeRounds; i += 1) {
      sets.push({
        exerciseName: "Assault bike 15/15",
        durationSeconds: 15,
        logMode: "timed_round",
      });
    }
    for (let i = 0; i < 21; i += 1) {
      sets.push({
        exerciseName: "Pad rounds",
        durationSeconds: 180,
        logMode: "timed_round",
      });
    }
    sets.push({
      exerciseName: "Front plank hold",
      durationSeconds: index === scheduled.length - 1 ? 320 : 90,
      logMode: "timed",
    });
    await logDay(user.id, at, sets);
  }

  await prisma.bodyMetric.create({
    data: {
      userId: user.id,
      kind: "weight",
      value: 176,
      unit: "lb",
      recordedAt: now,
    },
  });

  console.log(`Seeded ${EMAIL} / ${PASSWORD} (lbs, no fake leaderboard)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
