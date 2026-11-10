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
import { loggedSetVolume } from "@/lib/home-telemetry";
import { buildProgressSummary } from "@/lib/progress";
import { summarizePeriod } from "@/lib/report-history";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import { prepareSetsForPersist, setCountsForTotals, withEntryTick, withFinishTick } from "@/lib/logged-work";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { detectNewPrs } from "@/lib/personal-bests";
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
    const sets = [
      { exerciseName: "Rotational med-ball throw", reps: 5, loadValue: 20, loadUnit: "lb" as const, completed: true },
      { exerciseName: "Rotational med-ball throw", reps: 6, loadValue: 30, loadUnit: "lb" as const, completed: false },
      { exerciseName: "Med-ball chest pass", reps: 7, loadValue: 15, loadUnit: "lb" as const, completed: false },
    ];
    expect(sessionVolume(sets, "lb", "partial")).toBe(100);
    expect(loggedSetVolume(sets, "lb", "partial")).toBe(100);
    const counted = sets.map((set, index) => ({
      ...set,
      id: String(index),
      workoutSessionId: "s",
      setNumber: index + 1,
      sortOrder: index,
      logMode: "load_reps",
      durationSeconds: null,
      notes: "",
      prescriptionKey: "",
      rir: "",
      skipped: index === 0 ? false : true,
    }));
    const summary = buildProgressSummary(
      [
        {
          id: "s",
          title: "Lift",
          status: "complete",
          performedAt: new Date("2026-11-10T18:00:00.000Z"),
          sets: counted,
        } as never,
      ],
      "lb",
    );
    expect(summary.points[0]?.volume).toBe(100);
    expect(loggedSetVolume(sets, "lb", "complete")).toBe(385);
  });

  it("counts filled sets on a finished session unless they were unticked on purpose", () => {
    const sets = [
      { reps: 5, loadValue: 20, loadUnit: "lb", completed: false, logMode: "load_reps" },
      { reps: 6, loadValue: 30, loadUnit: "lb", completed: false, skipped: true, logMode: "load_reps" },
    ];
    expect(loggedSetVolume(sets, "lb", "complete")).toBe(100);
    expect(loggedSetVolume(sets, "lb", "partial")).toBe(0);
    expect(withEntryTick({ reps: 8, loadValue: 40, completed: false, skipped: false }).completed).toBe(true);
    expect(withEntryTick({ reps: 8, loadValue: 40, completed: false, skipped: true }).completed).toBe(false);
    expect(
      withEntryTick({
        reps: null,
        loadValue: null,
        durationSeconds: null,
        completed: true,
        skipped: false,
      }).completed,
    ).toBe(false);
    expect(withFinishTick({ reps: 5, loadValue: 20, completed: false, skipped: false }).completed).toBe(true);
    expect(withFinishTick({ reps: 6, loadValue: 30, completed: false, skipped: true }).completed).toBe(false);
    expect(withFinishTick({ reps: null, loadValue: null, durationSeconds: null, completed: false }).completed).toBe(
      false,
    );
  });

  it("unticks a cleared hold and does not restore the template or mint a PR", () => {
    const neckKey = prescriptionSlotKey({
      exerciseName: "Neck isometric — flexion",
      reps: "10 sec",
      programSlug: "demo",
      dayNumber: 1,
    });
    const cleared = withEntryTick({
      exerciseName: "Neck isometric — flexion",
      reps: null,
      loadValue: null,
      durationSeconds: null,
      logMode: "timed",
      completed: true,
      skipped: false,
      prescriptionKey: neckKey,
    });
    expect(cleared.completed).toBe(false);
    const saved = prepareSetsForPersist(
      [
        {
          exerciseName: "Neck isometric — flexion",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "timed",
          durationSeconds: null,
          completed: false,
          skipped: false,
          prescriptionKey: neckKey,
        },
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: true,
          skipped: false,
          prescriptionKey: "",
        },
      ],
      "complete",
    );
    expect(saved.map((set) => set.exerciseName)).toEqual(["Goblet squat"]);
    const prs = detectNewPrs(
      [],
      saved.map((set) => ({ ...set, sessionStatus: "complete", performedAt: new Date("2026-11-10T18:00:00.000Z") })),
      "lb",
    );
    expect(prs.some((row) => row.exerciseName.startsWith("Neck"))).toBe(false);
  });

  it("does not finish-tick template seconds the member never edited or ticked", () => {
    const pallofKey = prescriptionSlotKey({
      exerciseName: "Cable Pallof press",
      reps: "10 sec / side",
      programSlug: "demo",
      dayNumber: 2,
    });
    const untouched = {
      exerciseName: "Cable Pallof press",
      setNumber: 1,
      reps: null as number | null,
      loadValue: null as number | null,
      loadUnit: "lb",
      logMode: "timed",
      durationSeconds: 10,
      completed: false,
      skipped: false,
      prescriptionKey: pallofKey,
    };
    const finished = withFinishTick(untouched);
    expect(finished.completed).toBe(false);
    expect(finished.durationSeconds).toBeNull();
    expect(setCountsForTotals(finished, "complete")).toBe(false);
    const confirmed = withFinishTick({ ...untouched, completed: true });
    expect(confirmed.completed).toBe(true);
    expect(confirmed.durationSeconds).toBe(10);
    const edited = withFinishTick({ ...untouched, durationSeconds: 15 });
    expect(edited.completed).toBe(true);
    expect(edited.durationSeconds).toBe(15);
    const rows = prepareSetsForPersist(
      [1, 2, 3, 4].map((setNumber) => ({ ...untouched, setNumber })),
      "complete",
    );
    expect(rows).toHaveLength(0);
  });

  it("counts finish, progress, and report sets without untouched Pallof template seconds", () => {
    const pallofKey = prescriptionSlotKey({
      exerciseName: "Cable Pallof press",
      reps: "10 sec / side",
      programSlug: "demo",
      dayNumber: 2,
    });
    const when = new Date("2026-11-10T18:00:00.000Z");
    const later = new Date("2026-11-10T19:00:00.000Z");
    type CountedRow = {
      exerciseName: string;
      setNumber: number;
      reps: number | null;
      loadValue: number | null;
      loadUnit: string;
      logMode: string;
      durationSeconds: number | null;
      completed: boolean;
      skipped: boolean;
      prescriptionKey: string;
    };
    const lift = (name: string, setNumber: number): CountedRow => ({
      exerciseName: name,
      setNumber,
      reps: 8,
      loadValue: 40,
      loadUnit: "lb",
      logMode: "load_reps",
      durationSeconds: null,
      completed: true,
      skipped: false,
      prescriptionKey: "",
    });
    const pallof = (setNumber: number): CountedRow => ({
      exerciseName: "Cable Pallof press",
      setNumber,
      reps: null,
      loadValue: null,
      loadUnit: "lb",
      logMode: "timed",
      durationSeconds: 10,
      completed: false,
      skipped: false,
      prescriptionKey: pallofKey,
    });
    const sessionA: CountedRow[] = [
      ...[1, 2, 3].map((setNumber) => lift("Goblet squat", setNumber)),
      ...[1, 2, 3, 4].map(pallof),
    ];
    const sessionB: CountedRow[] = [lift("Bench press", 1), ...[1, 2, 3].map(pallof)];
    const tiles = workoutCompleteTiles({
      session: { title: "Lift", performedAt: when, status: "complete", sets: sessionA },
      displayUnit: "lb",
      newPrCount: 0,
    });
    expect(tiles.find((tile) => tile.label === "Sets")?.value).toBe("3");
    const asReport = (id: string, title: string, sets: typeof sessionA) => ({
      id,
      title,
      performedAt: when,
      createdAt: when,
      updatedAt: when,
      status: "complete",
      difficultyRating: "",
      sessionRpe: null,
      elapsedSeconds: null,
      backfilled: false,
      sets: sets.map((set) => ({
        exerciseName: set.exerciseName,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: set.loadUnit,
        logMode: set.logMode,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        skipped: set.skipped,
        prescriptionKey: set.prescriptionKey,
      })),
    });
    const report = summarizePeriod({
      sessions: [asReport("a", "Lift", sessionA), asReport("b", "Lift 2", sessionB)],
      outside: [],
      focus: "all",
      displayUnit: "lb",
    });
    expect(report.sets).toBe(4);
    const progress = buildProgressSummary(
      [
        { id: "a", title: "Lift", status: "complete", performedAt: when, sets: sessionA },
        { id: "b", title: "Lift 2", status: "complete", performedAt: later, sets: sessionB },
      ] as never,
      "lb",
    );
    expect(progress.points.map((point) => point.setCount)).toEqual([3, 1]);
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

describe("Nov 10 QA — cleared holds stay empty", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("saves a cleared timed set without refilling the template or creating a PR", async () => {
    const user = await makeUser("cleared-hold@example.com");
    const neckKey = prescriptionSlotKey({
      exerciseName: "Neck isometric — flexion",
      reps: "10 sec",
      programSlug: "demo",
      dayNumber: 1,
    });
    const created = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lift",
        performedAt: new Date("2026-11-10T18:00:00.000Z"),
        status: "draft",
        sets: {
          create: [1, 2, 3, 4].map((setNumber) => ({
            exerciseName: "Neck isometric — flexion",
            setNumber,
            sortOrder: setNumber,
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            logMode: "timed",
            durationSeconds: 10,
            completed: false,
            prescriptionKey: neckKey,
          })),
        },
      },
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: created.id,
      title: "Lift",
      performedAt: created.performedAt,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: true,
          skipped: false,
          prescriptionKey: "",
        },
        ...[1, 2, 3, 4].map((setNumber) => ({
          exerciseName: "Neck isometric — flexion",
          setNumber,
          reps: null,
          loadValue: null,
          loadUnit: "lb" as const,
          logMode: "timed" as const,
          durationSeconds: setNumber === 1 ? null : 10,
          completed: false,
          skipped: false,
          prescriptionKey: neckKey,
        })),
      ],
    });
    const reloaded = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: created.id },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    const neck = reloaded.sets.filter((set) => set.exerciseName.startsWith("Neck"));
    expect(neck.map((set) => set.durationSeconds)).toEqual([null, null, null, null]);
    expect(neck.every((set) => set.completed === false)).toBe(true);
    const prs = detectNewPrs(
      [],
      reloaded.sets.map((set) => ({
        ...set,
        sessionStatus: reloaded.status,
        performedAt: reloaded.performedAt,
      })),
      "lb",
    );
    expect(prs.some((row) => row.exerciseName.startsWith("Neck"))).toBe(false);
    expect(workoutCompleteTiles({
      session: reloaded,
      displayUnit: "lb",
      newPrCount: prs.length,
    }).find((tile) => tile.label === "Sets")?.value).toBe("1");
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
