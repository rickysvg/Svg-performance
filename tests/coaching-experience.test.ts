import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  completeOnboardingForUser,
  saveDeepOnboardingForUser,
} from "@/lib/onboarding";
import { defaultPathSlug, enrollUserInPath, getPathProgress, todayLane } from "@/lib/paths";
import { getTodayGuide, todayPriorityCopy } from "@/lib/today";
import { getWeeklyProgressReport, upsertWeeklyCoachComment } from "@/lib/weekly-report";
import {
  addJournalFeedback,
  createJournalEntryForUser,
  listJournalEntriesForUser,
} from "@/lib/journal";
import { createBookingRequestForUser, setBookingNextSteps } from "@/lib/bookings";
import { assignMemberToCoach } from "@/lib/reports";
import { getDemoProgram } from "@/lib/programs";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { createNutritionEntryForUser } from "@/lib/nutrition";

function turnStripeOn() {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
}

function turnStripeOff() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_STANDALONE;
}

async function onboard(
  userId: string,
  input: { experienceLevel?: string; goalKey?: string; primaryFocus?: string } = {},
) {
  return completeOnboardingForUser(userId, {
    displayName: "Alex",
    goalKey: input.goalKey ?? "stronger-for-class",
    goalNote: "",
    experienceLevel: input.experienceLevel ?? "beginner",
    primaryFocus: input.primaryFocus ?? "mma",
    equipment: ["Bodyweight only"],
    weeklyAvailability: ["Monday"],
    sessionsPerWeek: 3,
    preferredUnits: "lb",
    trainingLimitations: "",
    foodPreferences: "",
    allergies: "",
  });
}

async function assignPlan(userId: string, plan: string) {
  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
  await prisma.subscription.create({
    data: {
      userId,
      plan,
      status: "active",
      currentPeriodEnd: periodEnd,
      source: "admin",
    },
  });
}

describe("coaching experience", () => {
  beforeEach(async () => {
    await resetDatabase();
    turnStripeOff();
  });

  afterAll(async () => {
    turnStripeOff();
    await prisma.$disconnect();
  });

  it("defaults beginner vs fighter paths and Today copy from onboarding", async () => {
    const beginner = await makeUser("beginner-today@example.com");
    const fighter = await makeUser("fighter-today@example.com");
    await onboard(beginner.id, { experienceLevel: "beginner", goalKey: "stronger-for-class" });
    await onboard(fighter.id, { experienceLevel: "advanced", primaryFocus: "mma" });
    await saveDeepOnboardingForUser(fighter.id, {
      currentWeight: null,
      goalWeight: null,
      sessionLengthMin: 45,
      trainingLocation: "gym",
      competitionStatus: "amateur",
      nextFightDate: null,
      coachingTone: "balanced",
      obstacles: [],
    });

    expect(defaultPathSlug(await prisma.profile.findUnique({ where: { userId: beginner.id } }).then((p) => ({
      experienceLevel: p!.experienceLevel,
      goalKey: p!.goalKey,
      primaryFocus: p!.primaryFocus,
      competitionStatus: p!.competitionStatus,
    })))).toBe("beginner-foundations");
    expect(todayLane({ experienceLevel: "beginner", competitionStatus: "" })).toBe("beginner");
    expect(todayLane({ experienceLevel: "advanced", competitionStatus: "amateur" })).toBe("fighter");
    expect(todayPriorityCopy("beginner").headline).toMatch(/Beginner/);
    expect(todayPriorityCopy("fighter").headline).toMatch(/Fighter/);
    expect(todayPriorityCopy("fighter").body).not.toMatch(/fight date is/);

    const beginnerGuide = await getTodayGuide(beginner.id);
    const fighterGuide = await getTodayGuide(fighter.id);
    expect(beginnerGuide.lane).toBe("beginner");
    expect(fighterGuide.lane).toBe("fighter");
    expect(beginnerGuide.path.path.slug).toBe("beginner-foundations");
    expect(fighterGuide.path.path.slug).toBe("strength-for-combat");
    expect(beginnerGuide.hasGoal).toBe(true);
    expect(fighterGuide.checkIn.body).not.toMatch(/Next fight on file: invent/i);
  });

  it("builds an automated weekly report without food names or a fake coach comment", async () => {
    const user = await makeUser("report@example.com");
    await onboard(user.id);
    const now = new Date("2026-09-22T15:00:00");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0]!.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 55,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    await createNutritionEntryForUser(user.id, {
      name: "Secret burrito",
      mealType: "lunch",
      servings: 1,
      servingLabel: "each",
      calories: 700,
      proteinG: 30,
      carbsG: 70,
      fatG: 25,
      eatenAt: now,
    });

    const quiet = await getWeeklyProgressReport((await makeUser("quiet-report@example.com")).id, now);
    expect(quiet.copy).toMatch(/okay/i);
    expect(quiet.copy).not.toMatch(/fail|lazy|shame|behind/i);
    expect(quiet.coachCommentEmpty).toBe(true);
    expect(quiet.labeled).toBe("Automated SVG summary");

    const report = await getWeeklyProgressReport(user.id, now);
    expect(report.wrap.workoutsLogged).toBe(1);
    expect(report.strengthNote).toMatch(/Goblet squat/i);
    expect(report.copy).toMatch(/Automated SVG summary/);
    expect(report.copy).toMatch(/Not a message from Ricky/);
    expect(JSON.stringify(report.wrap)).not.toMatch(/Secret burrito/i);
    expect(report.coachComment).toBe("");
  });

  it("lets an assigned coach write a weekly comment and keeps it empty until then", async () => {
    turnStripeOn();
    const member = await makeUser("comment-member@example.com");
    const coach = await makeUser("comment-coach@example.com", false, "coach");
    const other = await makeUser("other-coach@example.com", false, "coach");
    const admin = await makeUser("comment-admin@example.com", false, "admin");
    await onboard(member.id);
    await assignPlan(member.id, "fighter_development");

    await expect(
      upsertWeeklyCoachComment({
        staffUserId: coach.id,
        staffRole: "coach",
        memberUserId: member.id,
        body: "Work the jab this week.",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: coach.id,
      memberUserId: member.id,
    });
    const saved = await upsertWeeklyCoachComment({
      staffUserId: coach.id,
      staffRole: "coach",
      memberUserId: member.id,
      body: "Work the jab this week.",
    });
    expect(saved.body).toBe("Work the jab this week.");
    expect(saved.body).not.toMatch(/Ricky said/i);

    await expect(
      upsertWeeklyCoachComment({
        staffUserId: other.id,
        staffRole: "coach",
        memberUserId: member.id,
        body: "Fake Ricky note",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const report = await getWeeklyProgressReport(member.id);
    expect(report.showCoachSlot).toBe(true);
    expect(report.coachCommentEmpty).toBe(false);
    expect(report.coachComment).toBe("Work the jab this week.");
  });

  it("keeps the journal owner-only and stores coach feedback + action items on coaching tiers", async () => {
    turnStripeOn();
    const owner = await makeUser("journal-a@example.com");
    const other = await makeUser("journal-b@example.com");
    const coach = await makeUser("journal-coach@example.com", false, "coach");
    const admin = await makeUser("journal-admin@example.com", false, "admin");
    await onboard(owner.id);
    await assignPlan(owner.id, "elite");
    const entry = await createJournalEntryForUser(owner.id, {
      kind: "question",
      title: "Gas tank",
      body: "How should I pace rounds?",
    });
    expect((await listJournalEntriesForUser(other.id)).map((row) => row.id)).not.toContain(entry.id);

    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: coach.id,
      memberUserId: owner.id,
    });
    const note = await addJournalFeedback({
      staffUserId: coach.id,
      staffRole: "coach",
      entryId: entry.id,
      body: "Two hard rounds, then walk the last minute.",
      actionItems: "Time 3 rounds next session.",
    });
    expect(note.body).toMatch(/Two hard rounds/);
    expect(note.actionItems).toMatch(/Time 3 rounds/);
    const listed = await listJournalEntriesForUser(owner.id);
    expect(listed[0]?.feedback[0]?.actionItems).toMatch(/Time 3 rounds/);
  });

  it("recalculates path milestones from logged DEMO days and allows empty next steps on Book", async () => {
    const user = await makeUser("path-book@example.com");
    await onboard(user.id);
    await enrollUserInPath(user.id, "beginner-foundations");
    const program = await getDemoProgram();
    const day1 = program.days.find((day) => day.dayNumber === 1);
    expect(day1).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day1!.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date(),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const progress = await getPathProgress(user.id);
    expect(progress.path.slug).toBe("beginner-foundations");
    expect(progress.doneKeys).toContain("day-1");
    expect(progress.nextStep?.key).not.toBe("day-1");

    const booking = await createBookingRequestForUser(user.id, {
      kind: "mindset",
      preferredTimes: "Thu after 5pm El Paso",
      note: "Mindset extra",
    });
    expect(booking.nextSteps).toBe("");
    const admin = await makeUser("book-admin@example.com", false, "admin");
    const updated = await setBookingNextSteps({
      staffUserId: admin.id,
      staffRole: "admin",
      requestId: booking.id,
      nextSteps: "Film one round. Bring notes next time.",
    });
    expect(updated.nextSteps).toMatch(/Film one round/);
  });
});
