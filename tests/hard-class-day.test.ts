import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { assignWeek, RICKY_EMAIL, resolveOutsideDays } from "@/lib/member-plan";
import { sparringNeedsEase } from "@/lib/outside-log";
import { easeWeekStripDays } from "@/lib/recovery-ease";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";
import { buildCoreWeekPlan, weekStrip, type PlannerPrefs } from "@/lib/week-plan";

const WEEK = zonedCivilToUtc(2026, 10, 20, APP_TIMEZONE);

function rickyPrefs(extra: Partial<PlannerPrefs> = {}): PlannerPrefs {
  return {
    trainingFocus: "martial_arts_sc",
    liftDaysPerWeek: 3,
    experienceLevel: "intermediate",
    email: RICKY_EMAIL,
    outsideTraining: [
      { weekday: "Wednesday", kind: "class", time: "18:00" },
      { weekday: "Saturday", kind: "sparring", time: "11:00" },
    ],
    weeklyAvailability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    ...extra,
  };
}

describe("hard class days and sparring-only ease", () => {
  it("requires a saved 1–5 rating before the next day can ease", () => {
    expect(sparringNeedsEase({ bodyRating: null, sessionRating: null, soreSpots: ["head"] })).toBe(false);
    expect(sparringNeedsEase({ bodyRating: null, sessionRating: null, soreSpots: [] })).toBe(false);
    expect(sparringNeedsEase({ bodyRating: 2, soreSpots: [] })).toBe(true);
    expect(sparringNeedsEase({ bodyRating: 5, sessionRating: 4, soreSpots: ["head"] })).toBe(true);
    expect(sparringNeedsEase({ bodyRating: 4, sessionRating: 5, soreSpots: [] })).toBe(false);
  });

  it("keeps Ricky's Wednesday as a hard class and leaves Thursday's lift in place", () => {
    const roles = assignWeek({ email: RICKY_EMAIL, trainingFocus: "martial_arts_sc" });
    expect(roles.Wednesday.outside).toMatchObject({ kind: "class", hard: true });
    expect(roles.Wednesday.lift).toBeNull();
    expect(roles.Wednesday.cardio).toBe("moderate");
    expect(roles.Saturday.outside?.kind).toBe("sparring");
    expect(roles.Thursday.lift).toBe("posterior");
    expect(Object.values(roles).filter((day) => day.outside?.kind === "sparring")).toHaveLength(1);

    const week = buildCoreWeekPlan(rickyPrefs());
    expect(week.Wednesday.summary).toBe("Cardio+Mobility");
    expect(week.Wednesday.sessions.some((session) => session.kind === "strength")).toBe(false);
    expect(week.Wednesday.sessions.every((session) => session.heavy !== true)).toBe(true);
    expect(week.Thursday.summary).toBe("Lift");
    expect(week.Thursday.easeNote).toBeUndefined();
  });

  it("honors an explicit hard-class off for Ricky and a hard-class on for anyone else", () => {
    const off = resolveOutsideDays({
      email: RICKY_EMAIL,
      outsideTraining: [{ weekday: "Wednesday", kind: "class", time: "18:00", hard: false }],
    });
    expect(off.find((day) => day.weekday === "Wednesday")?.hard).toBe(false);
    const roles = assignWeek({
      email: RICKY_EMAIL,
      outsideTraining: [{ weekday: "Wednesday", kind: "class", time: "18:00", hard: false }],
    });
    expect(roles.Wednesday.cardio).toBe("easy");

    const member = assignWeek({
      email: "member@example.com",
      outsideTraining: [{ weekday: "Wednesday", kind: "class", hard: true }],
    });
    expect(member.Wednesday.cardio).toBe("moderate");
    expect(member.Wednesday.lift).toBeNull();
    expect(member.Thursday.lift).toBe("posterior");
  });

  it("does not turn a scheduled sparring day into an eased next day", () => {
    const roles = assignWeek({
      outsideTraining: [{ weekday: "Wednesday", kind: "sparring", time: "18:00" }],
    });
    expect(roles.Wednesday.outside?.kind).toBe("sparring");
    expect(roles.Thursday.lift).toBe("posterior");
    expect(roles.Thursday.lift).not.toBe("moderate-upper");
  });
});

describe("week strip ease follows logged ratings only", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("leaves the week alone when Wednesday is a hard class and nothing is logged", async () => {
    const user = await makeUser("hard-class@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { trialEndsAt: new Date("2026-12-01T00:00:00.000Z") },
    });
    const prefs = rickyPrefs({
      email: user.email,
      outsideTraining: [
        { weekday: "Wednesday", kind: "class", time: "18:00", hard: true },
        { weekday: "Saturday", kind: "sparring", time: "11:00" },
      ],
    });
    const strip = weekStrip(prefs, WEEK, APP_TIMEZONE);
    const eased = await easeWeekStripDays(user.id, prefs, strip, APP_TIMEZONE);
    expect(eased.map((day) => `${day.weekday}:${day.summary}`)).toEqual(
      strip.map((day) => `${day.weekday}:${day.summary}`),
    );
    expect(eased.find((day) => day.weekday === "Thursday")?.summary).toBe("Lift");
    expect(eased.find((day) => day.weekday === "Wednesday")?.summary).toBe("Cardio+Mobility");
  });

  it("eases Thursday only after a rated Wednesday sparring log", async () => {
    const user = await makeUser("logged-spar@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        trialEndsAt: new Date("2026-12-01T00:00:00.000Z"),
        outsideTrainingJson: JSON.stringify([
          { weekday: "Wednesday", kind: "class", hard: true },
          { weekday: "Saturday", kind: "sparring" },
        ]),
      },
    });
    await prisma.outsideSessionLog.create({
      data: {
        userId: user.id,
        dateKey: "2026-10-21",
        weekday: "Wednesday",
        rounds: 5,
        minutesPerRound: 3,
        bodyRating: null,
        sessionRating: null,
        soreSpots: JSON.stringify(["head"]),
      },
    });
    const prefs: PlannerPrefs = {
      email: user.email,
      trainingFocus: "martial_arts_sc",
      outsideTraining: [
        { weekday: "Wednesday", kind: "class", hard: true },
        { weekday: "Saturday", kind: "sparring" },
      ],
    };
    const strip = weekStrip(prefs, WEEK, APP_TIMEZONE);
    const ignored = await easeWeekStripDays(user.id, prefs, strip, APP_TIMEZONE);
    expect(ignored.find((day) => day.weekday === "Thursday")?.summary).toBe("Lift");

    await prisma.outsideSessionLog.update({
      where: { userId_dateKey: { userId: user.id, dateKey: "2026-10-21" } },
      data: { bodyRating: 2, sessionRating: 3, soreSpots: "[]" },
    });
    const eased = await easeWeekStripDays(user.id, prefs, strip, APP_TIMEZONE);
    expect(eased.find((day) => day.weekday === "Thursday")?.summary).toBe("Mobility+Cardio");
    expect(eased.find((day) => day.weekday === "Friday")?.summary).not.toBe("Mobility+Cardio");
  });
});
