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
  bikeChipLogHref,
  planForDate,
  resolvePlanSessions,
  weekStrip,
  withBikeChipLogHrefs,
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
    const start = read("src/app/(member)/training/[dayId]/start/page.tsx");
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
  });
});
