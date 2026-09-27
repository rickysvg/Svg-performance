import { describe, expect, it } from "vitest";
import { dayKey } from "@/lib/timezone";
import {
  buildTrainingStreak,
  currentTrainingStreak,
  longestTrainingStreak,
  streakStatusLine,
  weekStreakDots,
} from "@/lib/streaks";
import type { PlannerPrefs } from "@/lib/week-plan";

const prefs: PlannerPrefs = {
  primaryFocus: "general-fitness",
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
  sessionsPerWeek: 3,
};

describe("training streak (scheduled days)", () => {
  it("does not break across scheduled rest days", () => {
    // Friday 18 Sep 2026 + Monday 21 Sep. Sat/Sun are rest.
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const monday = new Date("2026-09-21T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(friday, tz), dayKey(monday, tz)];
    expect(currentTrainingStreak(keys, prefs, monday, tz)).toBe(2);
    expect(longestTrainingStreak(keys, prefs, monday, tz)).toBe(2);
  });

  it("breaks when a scheduled training day is missed", () => {
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const tuesday = new Date("2026-09-22T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(friday, tz), dayKey(tuesday, tz)];
    // Monday 21 Sep is scheduled and was missed. Tuesday is not a chosen training day.
    expect(currentTrainingStreak(keys, prefs, tuesday, tz)).toBe(0);
  });

  it("keeps the streak alive when today is scheduled and not logged yet", () => {
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const mondayMorning = new Date("2026-09-21T14:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(friday, tz)];
    expect(currentTrainingStreak(keys, prefs, mondayMorning, tz)).toBe(1);
  });

  it("uses the athlete time zone around UTC midnight", () => {
    // Friday 16:00 UTC = Friday in Denver, Saturday in Sydney.
    const instant = new Date("2026-09-25T16:00:00.000Z");
    const denver = "America/Denver";
    const sydney = "Australia/Sydney";
    const denverKeys = [dayKey(instant, denver)];
    const sydneyKeys = [dayKey(instant, sydney)];

    expect(dayKey(instant, denver)).toBe("2026-09-25");
    expect(dayKey(instant, sydney)).toBe("2026-09-26");
    expect(currentTrainingStreak(denverKeys, prefs, instant, denver)).toBe(1);
    expect(currentTrainingStreak(sydneyKeys, prefs, instant, sydney)).toBe(0);
  });

  it("marks the week strip from Monday with rest days unchecked", () => {
    const monday = new Date("2026-09-21T18:00:00.000Z");
    const tz = "America/Denver";
    const dots = weekStreakDots([dayKey(monday, tz)], prefs, monday, tz);
    expect(dots).toHaveLength(7);
    expect(dots[0]?.label).toBe("M");
    expect(dots[0]?.completed).toBe(true);
    expect(dots[5]?.scheduled).toBe(false);
    expect(dots[6]?.scheduled).toBe(false);
  });

  it("says the streak is safe on a scheduled rest day", () => {
    const sunday = new Date("2026-09-27T18:00:00.000Z");
    const friday = new Date("2026-09-25T18:00:00.000Z");
    const tz = "America/Denver";
    const streak = buildTrainingStreak({
      completedDates: [friday],
      prefs,
      now: sunday,
      timeZone: tz,
    });
    expect(streak.todayScheduled).toBe(false);
    expect(streakStatusLine(streak)).toBe("Rest day. Streak safe.");
    expect(streakStatusLine(streak).toLowerCase()).not.toContain("train today");
  });
});
