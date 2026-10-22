import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeOnboardingForUser } from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { getCalendarSchedule } from "@/lib/calendar";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { RICKY_EMAIL } from "@/lib/member-plan";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";
import {
  easyBikeProgramDayNumber,
  isBikeIntervalName,
  moderateBikeProgramDayNumber,
} from "@/lib/bike-sessions";
import { easeDayPlan, halvedSetCount } from "@/lib/recovery-ease";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { bikeChoiceById } from "@/lib/bike-chooser";
import {
  logBikeRoundsForUser,
  matchingDraftId,
  sessionMatchesPlannedDay,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import {
  bikeChipLogHref,
  moderateCardioSlot,
  planForDate,
  resolvePlanSessions,
  weekStrip,
  withBikeChipLogHrefs,
  type DayPlan,
} from "@/lib/week-plan";
import {
  bikeLoggerHref,
  isBikeLoggerHref,
  sessionOpenHref,
} from "@/lib/timer-session";
import { makeUser, resetDatabase } from "./helpers";

const wednesday = zonedCivilToUtc(2026, 10, 21, APP_TIMEZONE);

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const intake = {
  displayName: "Ricky",
  goalKey: "stronger-for-class",
  goalNote: "",
  experienceLevel: "intermediate",
  primaryFocus: "mma",
  equipment: ["Heavy bag"],
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
  sessionsPerWeek: 4,
  preferredUnits: "lb" as const,
  trainingLimitations: "",
  foodPreferences: "",
  allergies: "",
  trainingFocus: "martial_arts_sc" as const,
  outsideTraining: [] as [],
};

describe("bike log entry points", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("opens the logger from Home, Train, the week chip, and Calendar", async () => {
    const user = await makeUser("bike-log@example.com");
    await completeOnboardingForUser(user.id, intake);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
        timeZone: APP_TIMEZONE,
      },
    });

    const catalog = await findDemoTrainingCatalog();
    const prefs = {
      primaryFocus: "mma" as const,
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      trainingFocus: "martial_arts_sc" as const,
      planAnchor: new Date("2026-01-05T12:00:00.000Z"),
      email: user.email,
    };
    const plan = planForDate(prefs, wednesday, APP_TIMEZONE);
    const train = resolvePlanSessions(plan, catalog);
    const bike = train.find((session) => session.logHref);
    expect(bike?.dayId).toBeTruthy();
    expect(bike?.logHref).toBe(bikeLoggerHref(bike!.dayId!));
    expect(bike?.href).toBe(`/training/${bike!.dayId}`);
    expect(bike?.href).not.toMatch(/\/timer/);
    expect(isBikeLoggerHref(bike?.logHref)).toBe(true);

    const home = await getHomeToday(user.id, wednesday, APP_TIMEZONE);
    const homeBike = home.plannedSessions.find((session) => session.logHref);
    expect(homeBike?.logHref).toBe(bikeLoggerHref(homeBike!.dayId!));
    expect(homeBike?.href).not.toMatch(/\/timer/);
    const chip = home.weekStrip.find((day) => day.weekday === "Wednesday");
    expect(chip?.logHref).toBe(homeBike?.logHref);

    const strip = withBikeChipLogHrefs(
      weekStrip(prefs, wednesday, APP_TIMEZONE, wednesday),
      prefs,
      catalog,
      APP_TIMEZONE,
    );
    expect(strip.find((day) => day.weekday === "Wednesday")?.logHref).toBe(bike?.logHref);
    expect(bikeChipLogHref(plan, catalog)).toBe(bike?.logHref);

    const bikeWork = plan.sessions.filter((session) => session.kind !== "mobility");
    expect(
      bikeChipLogHref({ ...plan, sessions: [...plan.sessions, ...bikeWork] }, catalog),
    ).toBeNull();

    const hard = resolvePlanSessions(
      planForDate(
        {
          email: RICKY_EMAIL,
          trainingFocus: "martial_arts_sc",
          weeklyAvailability: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          outsideTraining: [{ weekday: "Wednesday", kind: "class", time: "18:00", hard: true }],
        },
        wednesday,
        APP_TIMEZONE,
      ),
      catalog,
    );
    const classBike = hard.find((session) => session.logHref);
    expect(classBike?.dayId).toBeTruthy();
    expect(classBike?.logHref).toBe(bikeLoggerHref(classBike!.dayId!));
    expect(classBike?.href).not.toMatch(/\/timer/);

    const schedule = await getCalendarSchedule(user.id, wednesday, wednesday);
    const day = schedule.days.find((row) =>
      row.activities.some((activity) => activity.href === bike?.logHref),
    );
    const activity = day?.activities.find((row) => row.href === bike?.logHref);
    expect(activity?.status).toBe("scheduled");
    expect(activity?.href).toBe(bikeLoggerHref(bike!.dayId!));
    expect(sessionOpenHref({ href: bike?.href, logHref: bike?.logHref }, true)).toBe(bike?.href);
  });

  it("keeps every bike tap off the standalone timer", () => {
    const home = read("src/components/home/HomeToday.tsx");
    const train = read("src/components/training/PlanSessionCard.tsx");
    const today = read("src/components/training/StartTodayButton.tsx");
    const chips = read("src/components/training/WeekStrip.tsx");
    const calendar = read("src/components/training/CalendarList.tsx");
    const start = read("src/app/(member)/training/[dayId]/start/route.ts");
    for (const source of [home, train, today, chips, calendar]) {
      expect(source).not.toContain("isBikeTimerHref");
      expect(source).not.toContain("data-open-bike-clock");
      expect(source).not.toContain("/timer?mode=bike");
    }
    expect(home).toContain('data-open-bike-logger={first.logHref ? "home"');
    expect(train).toContain('data-open-bike-logger={session.logHref ? "train"');
    expect(today).toContain('data-open-bike-logger={action.logHref ? "today"');
    expect(chips).toContain("day.logHref");
    expect(chips).toContain('data-open-bike-logger={day.logHref ? "chip"');
    expect(calendar).toContain('data-open-bike-logger={isBikeLoggerHref(activity.href) ? "calendar"');
    expect(start).toContain("redirect(`/training/log/${session.id}`)");
    expect(read("src/app/(member)/training/page.tsx")).toContain("logHref: session.logHref");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("withBikeChipLogHrefs");
    expect(read("src/app/(member)/training/history/bike/page.tsx")).toContain("formatMemberDate");
    expect(read("src/app/(member)/training/history/bike/page.tsx")).toContain("timeZoneForUser");
    expect(read("src/lib/week-plan.ts")).not.toContain('href: "/timer"');
  });

  it("starts a new bike draft when a saved strength log already sits on that day", async () => {
    const user = await makeUser("bike-vs-strength@example.com");
    await completeOnboardingForUser(user.id, intake);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
        timeZone: APP_TIMEZONE,
      },
    });
    const catalog = await findDemoTrainingCatalog();
    const prefs = {
      primaryFocus: "mma" as const,
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      trainingFocus: "martial_arts_sc" as const,
      planAnchor: new Date("2026-01-05T12:00:00.000Z"),
      email: user.email,
    };
    const plan = planForDate(prefs, wednesday, APP_TIMEZONE);
    const train = resolvePlanSessions(plan, catalog);
    const bike = train.find((session) => session.logHref);
    expect(bike?.dayId).toBeTruthy();

    const saved = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: bike!.dayId!,
        title: "Daru Alactic Power",
        performedAt: wednesday,
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Weighted push-up",
              setNumber: 1,
              reps: 8,
              loadValue: 25,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    const wrongDraft = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: bike!.dayId!,
        title: "Daru Alactic Power",
        performedAt: wednesday,
        status: "draft",
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 8,
              loadValue: 40,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });

    expect(bike?.logHref).toBe(bikeLoggerHref(bike!.dayId!));
    expect(
      matchingDraftId(
        [
          {
            id: wrongDraft.id,
            programDayId: bike!.dayId!,
            title: wrongDraft.title,
            sets: [{ exerciseName: "Goblet squat" }],
          },
        ],
        { dayId: bike!.dayId, day: bike?.day ?? null },
      ),
    ).toBeUndefined();

    const home = await getHomeToday(user.id, wednesday, APP_TIMEZONE);
    const homeBike = home.plannedSessions.find((session) => session.dayId === bike!.dayId);
    expect(homeBike?.logHref).toBe(bikeLoggerHref(bike!.dayId!));
    expect(home.completedDayIds ?? []).not.toContain(bike!.dayId);

    const chip = home.weekStrip.find((day) => day.weekday === "Wednesday");
    expect(chip?.logHref).toBe(bikeLoggerHref(bike!.dayId!));

    const schedule = await getCalendarSchedule(user.id, wednesday, wednesday);
    const activity = schedule.days
      .flatMap((day) => day.activities)
      .find((row) => row.href === bikeLoggerHref(bike!.dayId!));
    expect(activity?.status).toBe("scheduled");
    expect(activity?.href).not.toMatch(/\/timer/);

    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: bike!.dayId!,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      planAnchor: prefs.planAnchor,
      now: wednesday,
    });
    expect(started.id).not.toBe(saved.id);
    expect(started.id).not.toBe(wrongDraft.id);
    expect(started.status).toBe("draft");
    expect(started.sets.some((set) => isBikeIntervalName(set.exerciseName))).toBe(true);
    expect(started.sets.some((set) => /push-up|squat/i.test(set.exerciseName))).toBe(false);

    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: bike!.dayId!,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      planAnchor: prefs.planAnchor,
      now: wednesday,
    });
    expect(again.id).toBe(started.id);
    const stillSaved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: saved.id } });
    expect(stillSaved.status).toBe("complete");

    const finished = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: wednesday,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: started.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        durationSeconds: 20,
        completed: true,
      })),
    });
    expect(finished.id).toBe(started.id);
    expect(finished.status).toBe("complete");
    expect(await prisma.workoutSession.count({ where: { userId: user.id, status: "complete" } })).toBe(2);
  });

  it("opens easy and moderate cardio in the bike logger, and keeps a programmed day there when eased", async () => {
    const catalog = await findDemoTrainingCatalog();
    const tuesday = zonedCivilToUtc(2026, 10, 20, APP_TIMEZONE);
    const prefs = {
      primaryFocus: "mma" as const,
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      trainingFocus: "martial_arts_sc" as const,
      planAnchor: new Date("2026-01-05T12:00:00.000Z"),
    };
    const easyPlan = planForDate(
      {
        ...prefs,
        outsideTraining: [{ weekday: "Tuesday", kind: "class", time: "18:00", hard: false }],
      },
      tuesday,
      APP_TIMEZONE,
    );
    const easy = resolvePlanSessions(easyPlan, catalog).find((session) => session.title === "Easy cardio");
    expect(easy?.dayNumber).toBe(easyBikeProgramDayNumber());
    expect(isBikeLoggerHref(easy?.logHref)).toBe(true);
    expect(easy?.href ?? "").not.toMatch(/^\/timer/);

    const moderatePlan: DayPlan = {
      weekday: "Tuesday",
      active: true,
      optionalDay: false,
      summary: "Cardio",
      sessions: [moderateCardioSlot()],
      deload: false,
      testingWeek: false,
      mesoBlock: "A",
      mesoLabel: "Block A",
      outside: null,
    };
    const moderate = resolvePlanSessions(moderatePlan, catalog)[0];
    expect(moderate?.title).toBe("Cardio — moderate");
    expect(moderate?.dayNumber).toBe(moderateBikeProgramDayNumber());
    expect(isBikeLoggerHref(moderate?.logHref)).toBe(true);
    expect(moderate?.href ?? "").not.toMatch(/^\/timer/);

    const shell: Omit<DayPlan, "sessions" | "summary"> = {
      weekday: "Tuesday",
      active: true,
      optionalDay: false,
      deload: false,
      testingWeek: false,
      mesoBlock: "A",
      mesoLabel: "Block A",
      outside: null,
    };
    const kept = easeDayPlan(
      {
        ...shell,
        summary: "Cardio",
        sessions: [
          {
            kind: "conditioning",
            label: "Cardio — bike",
            title: "Cardio — bike",
            programSlug: DEMO_PROGRAM_SLUG,
            dayNumber: 5,
            heavy: false,
          },
        ],
      },
      "sore",
    );
    expect(kept.easedTo).toBe("lighter");
    expect(kept.plan.sessions[0]).toMatchObject({
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: 5,
      halved: true,
    });
    expect(kept.plan.sessions[0]?.href).toBeUndefined();
    const keptResolved = resolvePlanSessions(kept.plan, catalog)[0];
    expect(isBikeLoggerHref(keptResolved?.logHref)).toBe(true);
    expect(keptResolved?.startHref).toMatch(/\?half=1$/);

    const plain = easeDayPlan(
      {
        ...shell,
        summary: "Cardio",
        sessions: [{ kind: "conditioning", label: "Jump rope", title: "Jump rope" }],
      },
      "sore",
    );
    expect(plain.easedTo).toBe("lighter");
    expect(plain.plan.sessions[0]?.href).toBe("/timer");
    expect(plain.plan.sessions[0]?.programSlug).toBeUndefined();
  });

  it("opens an eased lift or bag day with half the sets", async () => {
    const lightUser = await makeUser("half-open@example.com");
    const fullUser = await makeUser("full-open@example.com");
    const catalog = await findDemoTrainingCatalog();
    const shell: Omit<DayPlan, "sessions" | "summary"> = {
      weekday: "Tuesday",
      active: true,
      optionalDay: false,
      deload: false,
      testingWeek: false,
      mesoBlock: "A",
      mesoLabel: "Block A",
      outside: null,
    };
    const bag = easeDayPlan(
      {
        ...shell,
        summary: "Bag",
        sessions: [
          {
            kind: "skill",
            label: "Bag",
            title: "Bag",
            heavy: false,
            programSlug: DEMO_SKILL_PROGRAM_SLUG,
            dayNumber: 1,
          },
        ],
      },
      "sore",
    );
    expect(bag.easedTo).toBe("lighter");
    expect(bag.plan.sessions[0]).toMatchObject({
      title: "Light · Bag",
      halved: true,
      detail: "Cut the work in half. Easy pace. No max efforts.",
    });
    const lift = easeDayPlan(
      {
        ...shell,
        summary: "Lift",
        sessions: [
          {
            kind: "conditioning",
            label: "Lift 2",
            title: "Lift 2",
            heavy: false,
            programSlug: DEMO_PROGRAM_SLUG,
            dayNumber: 2,
          },
        ],
      },
      "sore",
    );
    expect(lift.plan.sessions[0]).toMatchObject({
      title: "Light · Lift 2",
      halved: true,
    });
    const resolved = resolvePlanSessions(lift.plan, catalog)[0];
    expect(resolved?.startHref).toMatch(/\/start\?half=1$/);
    const dayId = resolved?.dayId;
    expect(dayId).toBeTruthy();
    const full = await startWorkoutFromDay({
      userId: fullUser.id,
      programDayId: dayId!,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: wednesday,
    });
    const light = await startWorkoutFromDay({
      userId: lightUser.id,
      programDayId: dayId!,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: wednesday,
      half: true,
    });
    expect(light.title).toContain("Light");
    const counts = new Map<string, number>();
    for (const set of full.sets) {
      counts.set(set.exerciseName, (counts.get(set.exerciseName) ?? 0) + 1);
    }
    let expected = 0;
    for (const count of counts.values()) expected += halvedSetCount(count);
    expect(light.sets.length).toBe(expected);
    expect(light.sets.length).toBeLessThan(full.sets.length);
  });

  it("reuses a matching bike draft, skips an empty draft, and still logs over a newer strength save", async () => {
    const user = await makeUser("draft-match@example.com");
    await completeOnboardingForUser(user.id, intake);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
        timeZone: APP_TIMEZONE,
      },
    });
    const catalog = await findDemoTrainingCatalog();
    const prefs = {
      primaryFocus: "mma" as const,
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      trainingFocus: "martial_arts_sc" as const,
      planAnchor: new Date("2026-01-05T12:00:00.000Z"),
      email: user.email,
    };
    const bike = resolvePlanSessions(planForDate(prefs, wednesday, APP_TIMEZONE), catalog).find(
      (session) => session.logHref,
    );
    expect(bike?.dayId).toBeTruthy();
    const dayId = bike!.dayId!;

    expect(
      sessionMatchesPlannedDay(
        { title: "Wrong title", sets: [] },
        { title: "Bike", exercises: [{ name: "Assault bike intervals" }] },
      ),
    ).toBe(false);
    expect(
      sessionMatchesPlannedDay(
        { title: "Lift", sets: [{ exerciseName: "Assault bike intervals" }] },
        { title: "Lift 2", exercises: [{ name: "Goblet squat" }] },
      ),
    ).toBe(true);

    const empty = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: dayId,
        title: "Not this workout",
        performedAt: wednesday,
        status: "draft",
      },
    });
    const opened = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: wednesday,
    });
    expect(opened.id).not.toBe(empty.id);
    expect(opened.sets.some((set) => isBikeIntervalName(set.exerciseName))).toBe(true);
    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: wednesday,
    });
    expect(again.id).toBe(opened.id);

    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: dayId,
        title: "Daru Alactic Power",
        performedAt: new Date(wednesday.getTime() + 60_000),
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Weighted push-up",
              setNumber: 1,
              reps: 8,
              loadValue: 25,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    const logged = await logBikeRoundsForUser({
      userId: user.id,
      choice: bikeChoiceById("tabata")!,
      now: wednesday,
      roundsCompleted: 8,
    });
    expect(logged.id).toBe(opened.id);
    expect(logged.status).toBe("complete");
    expect(logged.sets.every((set) => isBikeIntervalName(set.exerciseName))).toBe(true);
  });
});
