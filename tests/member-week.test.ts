import { describe, expect, it } from "vitest";
import { bagFocusFor, bagMinutesForBand } from "@/lib/bag-sessions";
import { BAG_CREDIT_SUFFIX } from "@/lib/bag-themes";
import { assignWeek, RICKY_EMAIL } from "@/lib/member-plan";
import { buildCoreWeekPlan, coreSkeletonSessions } from "@/lib/week-plan";
import { memberCopy } from "@/lib/member-copy";

const ALL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const RICKY = {
  trainingFocus: "martial_arts_sc",
  liftDaysPerWeek: 3,
  experienceLevel: "intermediate",
  email: RICKY_EMAIL,
  outsideTraining: [
    { weekday: "Wednesday" as const, kind: "class" as const, time: "18:00" },
    { weekday: "Saturday" as const, kind: "sparring" as const, time: "11:00" },
  ],
};

describe("member week", () => {
  it("fits Ricky around Wednesday class and Saturday sparring", () => {
    const roles = assignWeek(RICKY);
    const lifts = ALL_DAYS.filter((day) => roles[day].lift);
    const bags = ALL_DAYS.filter((day) => roles[day].bag);
    const mobility = ALL_DAYS.filter((day) => roles[day].mobility);
    expect(lifts).toHaveLength(3);
    expect(bags.length).toBeGreaterThanOrEqual(2);
    expect(bags.length).toBeLessThanOrEqual(3);
    expect(mobility).toEqual(["Wednesday", "Friday", "Sunday"]);
    expect(roles.Wednesday.lift).toBeNull();
    expect(roles.Wednesday.bag).toBeNull();
    expect(roles.Wednesday.outside?.hard).toBe(true);
    expect(roles.Wednesday.cardio).toBe("moderate");
    expect(roles.Wednesday.mobility).toBeTruthy();
    expect(roles.Thursday.lift).toBe("posterior");
    expect(roles.Thursday.lift).not.toBe("moderate-upper");
    expect(roles.Saturday.lift).toBeNull();
    expect(roles.Saturday.bag).toBeNull();
    expect(roles.Saturday.mobility).toBeNull();
    expect(roles.Saturday.cardio).toBeNull();
    expect(roles.Tuesday.lift).toBe("pull");
    expect(roles.Tuesday.bag).toBeNull();
    expect(roles.Friday.lift).not.toBe("lower");
    expect(roles.Friday.bag).toBeNull();
    expect(roles.Friday.gpp).toBe(true);
    expect(roles.Monday.lift).toBe("lower");

    const week = buildCoreWeekPlan({
      ...RICKY,
      weeklyAvailability: [...ALL_DAYS],
    });
    expect(week.Saturday.outside?.kind).toBe("sparring");
    expect(week.Saturday.summary).toBe("Sparring");
    expect(week.Saturday.sessions).toEqual([]);
    expect(week.Saturday.dayNote).toMatch(/log rounds/);
    expect(week.Wednesday.outside?.kind).toBe("class");
    expect(week.Wednesday.outside?.hard).toBe(true);
    expect(week.Wednesday.summary).toBe("Cardio+Mobility");
    expect(week.Wednesday.sessions.length).toBeGreaterThan(0);
    expect(week.Wednesday.dayNote).toMatch(/no heavy lifting/);
    expect(week.Wednesday.dayNote).toMatch(/log sparring/);
    expect(week.Wednesday.sessions.some((session) => session.kind === "skill")).toBe(false);
    expect(week.Wednesday.sessions.some((session) => session.kind === "strength")).toBe(false);
    expect(week.Wednesday.sessions.every((session) => session.heavy !== true)).toBe(true);
    expect(week.Wednesday.sessions.some((session) => /bike/i.test(session.title ?? session.label))).toBe(true);
    expect(week.Thursday.summary).toMatch(/Lift/);
    expect(week.Thursday.easeNote).toBeUndefined();
    expect(week.Thursday.sessions.some((session) => session.kind === "strength")).toBe(true);
    expect(ALL_DAYS.filter((day) => week[day].summary.includes("Lift"))).toHaveLength(3);
  });

  it("drops bag, shadow, and martial sessions for strength-only members", () => {
    const week = buildCoreWeekPlan({
      trainingFocus: "sc_only",
      experienceLevel: "intermediate",
      liftDaysPerWeek: 3,
      weeklyAvailability: [...ALL_DAYS],
    });
    for (const day of ALL_DAYS) {
      expect(week[day].sessions.some((session) => session.kind === "skill")).toBe(false);
      expect(week[day].summary).not.toMatch(/Bag|GPP/);
    }
    expect(ALL_DAYS.filter((day) => week[day].summary === "Mobility" || week[day].summary.includes("Mobility"))).toHaveLength(2);
  });

  it("credits bag themes without an endorsement and stays inside 30–45 minutes", () => {
    for (const block of ["A", "B", "C"] as const) {
      for (const day of ["Monday", "Wednesday", "Friday"] as const) {
        const plan = bagFocusFor(day, block);
        expect(plan.credit).toMatch(/Inspired by/);
        expect(plan.credit).toContain(BAG_CREDIT_SUFFIX);
        expect(plan.credit.toLowerCase()).not.toMatch(/endorsed by|official program/);
        expect(plan.rounds.length).toBeGreaterThanOrEqual(8);
      }
    }
    for (const band of ["beginner", "intermediate", "advanced"] as const) {
      expect(bagMinutesForBand(band)).toBeGreaterThanOrEqual(30);
      expect(bagMinutesForBand(band)).toBeLessThanOrEqual(45);
    }
  });

  it("hides the GPP acronym from member copy and never lifts seven days", () => {
    expect(memberCopy("Day 10 — Friday GPP")).toBe("Day 10 — Friday Cardio");
    const sessions = ALL_DAYS.flatMap((day) => coreSkeletonSessions(day, "mma"));
    expect(sessions.map((session) => session.label).join(" ")).not.toMatch(/\bGPP\b/);
    const lifts = ALL_DAYS.filter((day) =>
      coreSkeletonSessions(day, "mma").some((session) => session.kind === "strength"),
    );
    expect(lifts.length).toBeLessThanOrEqual(4);
  });
});
