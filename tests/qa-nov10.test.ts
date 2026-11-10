import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getEffectivePlanId } from "@/lib/entitlements";
import { creditsForCurrentPlan, creditsForPlan, startOfUtcMonth } from "@/lib/credits";
import { getVipPricingPhase } from "@/lib/vip-store";
import { liveCoachingSub } from "@/lib/vip-coaching";
import { subscriptionStatusIsCurrent } from "@/lib/subscription-status";
import { startTrialForUser } from "@/lib/trial";
import { assignPlanForPilot } from "@/lib/billing";
import { sessionVolume } from "@/lib/share-card";
import { loggedExerciseNamesInOrder } from "@/lib/logger-insert";
import { dayCanBeMissed, obligationStart, weekStrip } from "@/lib/week-plan";
import { sparringLogDetail } from "@/lib/outside-log";
import { removeSessionExercise } from "@/lib/exercise-removal-store";
import { updateWorkoutSessionForUser } from "@/lib/workouts";
import { getCalendarSchedule, subtitleShowsMissed } from "@/lib/calendar";

const DAY = 24 * 60 * 60 * 1000;

describe("Nov 10 QA — entitlement is the only VIP source", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("does not treat canceled, incomplete, or expired subscriptions as active VIP", () => {
    const now = new Date("2026-11-10T18:00:00.000Z");
    const future = new Date(now.getTime() + 10 * DAY);
    const past = new Date(now.getTime() - DAY);
    for (const status of ["canceled", "cancelled", "incomplete", "incomplete_expired", "expired", "unpaid"]) {
      expect(subscriptionStatusIsCurrent(status)).toBe(false);
      expect(
        liveCoachingSub(
          { userId: "u", plan: "coaching", status, currentPeriodEnd: future, createdAt: now },
          now,
        ),
      ).toBe(false);
    }
    expect(
      liveCoachingSub(
        { userId: "u", plan: "coaching", status: "active", currentPeriodEnd: past, createdAt: now },
        now,
      ),
    ).toBe(false);
    expect(
      liveCoachingSub(
        { userId: "u", plan: "coaching", status: "active", currentPeriodEnd: future, createdAt: now },
        now,
      ),
    ).toBe(true);
  });

  it("keeps a Pro trial off VIP when a cancelled sandbox row is still marked active", async () => {
    const user = await makeUser("trial-stale-vip@example.com");
    await startTrialForUser(user.id);
    const future = new Date(Date.now() + 20 * DAY);
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "coaching",
        status: "active",
        currentPeriodEnd: future,
        source: "webhook",
      },
    });
    const canceled = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "coaching",
        status: "canceled",
        currentPeriodEnd: future,
        source: "webhook",
      },
    });
    await prisma.subscription.update({
      where: { id: canceled.id },
      data: { status: "canceled" },
    });
    const periodStart = startOfUtcMonth();
    await prisma.coachingCredit.createMany({
      data: [
        { userId: user.id, kind: "checkin_30", periodStart, allotted: 4, used: 0 },
        { userId: user.id, kind: "video_review", periodStart, allotted: 4, used: 0 },
      ],
    });

    expect(await getEffectivePlanId(user.id)).toBe("performance");
    expect(await getVipPricingPhase(user.id)).not.toBe("member");
    expect((await creditsForCurrentPlan(user.id)).credits).toEqual([]);
    expect(
      creditsForPlan("performance", [
        { kind: "checkin_30" },
        { kind: "video_review" },
      ]),
    ).toEqual([]);
  });

  it("ignores an incomplete or expired coaching row even when it is the only subscription", async () => {
    const incomplete = await makeUser("incomplete-vip@example.com");
    const expired = await makeUser("expired-vip@example.com");
    const future = new Date(Date.now() + 20 * DAY);
    const past = new Date(Date.now() - DAY);
    await prisma.subscription.create({
      data: { userId: incomplete.id, plan: "coaching", status: "incomplete", currentPeriodEnd: future },
    });
    await prisma.subscription.create({
      data: { userId: expired.id, plan: "coaching", status: "active", currentPeriodEnd: past },
    });
    expect(await getEffectivePlanId(incomplete.id)).not.toBe("coaching");
    expect(await getEffectivePlanId(expired.id)).not.toBe("coaching");
    expect(await getVipPricingPhase(incomplete.id)).not.toBe("member");
    expect(await getVipPricingPhase(expired.id)).not.toBe("member");
    expect((await creditsForCurrentPlan(incomplete.id)).credits).toEqual([]);
    expect((await creditsForCurrentPlan(expired.id)).credits).toEqual([]);
  });

  it("shows VIP credits only while VIP Coaching is the effective plan", async () => {
    const admin = await makeUser("admin-nov10@example.com", false, "admin");
    const vip = await makeUser("active-vip@example.com");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: vip.id,
      plan: "coaching",
    });
    expect(await getEffectivePlanId(vip.id)).toBe("coaching");
    expect(await getVipPricingPhase(vip.id)).toBe("member");
    const credits = await creditsForCurrentPlan(vip.id);
    const byKind = Object.fromEntries(credits.credits.map((row) => [row.kind, row.allotted]));
    expect(byKind.checkin_30).toBe(4);
    expect(byKind.video_review).toBe(4);
    expect(creditsForPlan("coaching", credits.credits).map((row) => row.kind).sort()).toEqual([
      "checkin_30",
      "video_review",
    ]);
  });
});

describe("Nov 10 QA — logger, sparring, and calendar rules", () => {
  it("counts total pounds from ticked sets only", () => {
    expect(
      sessionVolume(
        [
          { exerciseName: "Shoulder circles", reps: 6, loadValue: null, loadUnit: "lb", completed: true },
          { exerciseName: "Goblet squat", reps: 8, loadValue: 40, loadUnit: "lb", completed: true },
          { exerciseName: "Landmine press", reps: 5, loadValue: 45, loadUnit: "lb", completed: false },
        ],
        "lb",
      ),
    ).toBe(320);
  });

  it("lists only ticked exercises on a history row", () => {
    expect(
      loggedExerciseNamesInOrder([
        { exerciseName: "Shoulder circles", completed: true },
        { exerciseName: "Neck isometric — flexion", completed: false, durationSeconds: 120 },
        { exerciseName: "Landmine press", completed: false, reps: 5, loadValue: 45 },
        { exerciseName: "Goblet squat", completed: true },
        { exerciseName: "Cable Pallof press", completed: false, durationSeconds: 20 },
      ]),
    ).toEqual(["Shoulder circles", "Goblet squat"]);
  });

  it("puts ratings and notes on the saved sparring row", () => {
    expect(
      sparringLogDetail({
        rounds: 3,
        minutesPerRound: 3,
        partner: "QA 1110",
        sessionRating: 4,
        bodyRating: 3,
        notes: "QA only test note 1110",
      }),
    ).toEqual({
      summary: "3 × 3 min (9 min) · QA 1110 · Session 4/5 · Body 3/5",
      notes: "QA only test note 1110",
    });
  });

  it("does not mark days before signup or onboarding as missed", () => {
    const signup = new Date("2026-11-05T18:00:00.000Z");
    const onboarding = new Date("2026-11-07T18:00:00.000Z");
    const start = obligationStart({ onboardingCompletedAt: onboarding, createdAt: signup });
    expect(start?.toISOString()).toBe(onboarding.toISOString());
    const tz = "America/Denver";
    expect(dayCanBeMissed("2026-11-06", start, tz)).toBe(false);
    expect(dayCanBeMissed("2026-11-07", start, tz)).toBe(true);
    const days = weekStrip(
      { obligationAnchor: start },
      new Date("2026-11-10T18:00:00.000Z"),
      tz,
      undefined,
      [],
      new Date("2026-11-04T18:00:00.000Z"),
    );
    const missedDays = days.filter((day) => day.isPast && day.active && day.canBeMissed).map((day) => day.dayParam);
    expect(missedDays.every((day) => day >= "2026-11-07")).toBe(true);
    expect(days.some((day) => day.dayParam < "2026-11-07" && day.canBeMissed)).toBe(false);
  });
});

describe("Nov 10 QA — calendar before onboarding", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("does not mark the week before onboarding as missed", async () => {
    const user = await makeUser("before-onboarding@example.com");
    await prisma.user.update({
      where: { id: user.id },
      data: { createdAt: new Date("2026-11-07T15:00:00.000Z") },
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: new Date("2026-11-07T18:00:00.000Z"),
        planChoiceAt: new Date("2026-11-07T18:00:00.000Z"),
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
        primaryFocus: "mma",
        timeZone: "America/Denver",
      },
    });
    const monday = new Date("2026-11-02T18:00:00.000Z");
    const now = new Date("2026-11-10T18:00:00.000Z");
    const schedule = await getCalendarSchedule(user.id, now, monday);
    const missed = schedule.days.flatMap((day) =>
      day.activities.filter((item) => item.kind === "workout" && subtitleShowsMissed(item.subtitle)),
    );
    // Mon Nov 2 through Fri Nov 6 are before the Nov 7 join. Sunday Nov 8 is after it.
    expect(missed.every((item) => item.weekday === "Sunday")).toBe(true);
    expect(missed.length).toBeGreaterThan(0);
  });
});

describe("Nov 10 QA — duration checks stay on the exercise being saved", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lets Remove drop a different exercise when one hold is over 4 hours", async () => {
    const user = await makeUser("remove-sec@example.com");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lift",
        performedAt: new Date(),
        status: "draft",
        plannedSetCount: 2,
        sets: {
          create: [
            { exerciseName: "Neck isometric — flexion", setNumber: 1, durationSeconds: 30, logMode: "timed", completed: false },
            { exerciseName: "Rotational med-ball throw", setNumber: 1, reps: 5, logMode: "load_reps", completed: false },
          ],
        },
      },
    });
    const sets = [
      {
        exerciseName: "Neck isometric — flexion",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        logMode: "timed" as const,
        durationSeconds: 120120,
        completed: false,
      },
      {
        exerciseName: "Rotational med-ball throw",
        setNumber: 1,
        reps: 5,
        loadValue: null,
        loadUnit: "lb" as const,
        logMode: "load_reps" as const,
        durationSeconds: null,
        completed: false,
      },
    ];
    await expect(
      updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: session.id,
        title: "Lift",
        performedAt: new Date(),
        notes: "",
        status: "draft",
        sets,
      }),
    ).rejects.toThrow(/Neck isometric — flexion: hold \/ round time should be under 4 hours/);

    await removeSessionExercise({
      userId: user.id,
      programSlug: "",
      dayNumber: 0,
      originalName: "Rotational med-ball throw",
      exerciseName: "Rotational med-ball throw",
      workoutSessionId: session.id,
      blockKey: "2026-11",
      currentSets: sets,
    });
    const left = await prisma.workoutSet.findMany({
      where: { workoutSessionId: session.id },
      orderBy: { exerciseName: "asc" },
    });
    expect(left.map((set) => set.exerciseName)).toEqual(["Neck isometric — flexion"]);
  });
});
