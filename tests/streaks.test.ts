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
  trainingFocus: "sc_only",
};

describe("training streak (scheduled days)", () => {
  it("does not break across scheduled rest days", () => {
    // Strength-only week: Thursday lift and Sunday bike, Friday and Saturday off.
    const thursday = new Date("2026-09-17T18:00:00.000Z");
    const sunday = new Date("2026-09-20T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(thursday, tz), dayKey(sunday, tz)];
    expect(currentTrainingStreak(keys, prefs, sunday, tz)).toBe(2);
    expect(longestTrainingStreak(keys, prefs, sunday, tz)).toBe(2);
  });

  it("breaks when a scheduled training day is missed", () => {
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const tuesday = new Date("2026-09-22T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(friday, tz), dayKey(tuesday, tz)];
    // Monday 21 Sep is a lift day and was missed. Tuesday's log does not skip it.
    expect(currentTrainingStreak(keys, prefs, tuesday, tz)).toBe(1);
  });

  it("keeps the streak alive when today is scheduled and not logged yet", () => {
    const tuesday = new Date("2026-09-15T18:00:00.000Z");
    const wednesdayMorning = new Date("2026-09-16T14:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(tuesday, tz)];
    expect(currentTrainingStreak(keys, prefs, wednesdayMorning, tz)).toBe(1);
  });

  it("uses the athlete time zone around UTC midnight", () => {
    // Saturday 16:00 UTC = Saturday in Denver, Sunday in Sydney.
    // Sunday is a bike on the strength-only week. Saturday is off.
    const instant = new Date("2026-09-26T16:00:00.000Z");
    const denver = "America/Denver";
    const sydney = "Australia/Sydney";
    const denverKeys = [dayKey(instant, denver)];
    const sydneyKeys = [dayKey(instant, sydney)];

    expect(dayKey(instant, denver)).toBe("2026-09-26");
    expect(dayKey(instant, sydney)).toBe("2026-09-27");
    expect(currentTrainingStreak(denverKeys, prefs, instant, denver)).toBe(0);
    expect(currentTrainingStreak(sydneyKeys, prefs, instant, sydney)).toBe(1);
  });

  it("marks the week strip from Monday with rest days unchecked", () => {
    const monday = new Date("2026-09-21T18:00:00.000Z");
    const tz = "America/Denver";
    const dots = weekStreakDots([dayKey(monday, tz)], prefs, monday, tz);
    expect(dots).toHaveLength(7);
    expect(dots[0]?.label).toBe("M");
    expect(dots[0]?.completed).toBe(true);
    expect(dots[4]?.scheduled).toBe(false);
    expect(dots[5]?.scheduled).toBe(false);
    expect(dots[6]?.scheduled).toBe(true);
  });

  it("says the streak is safe on a scheduled rest day", () => {
    const saturday = new Date("2026-09-26T18:00:00.000Z");
    const thursday = new Date("2026-09-24T18:00:00.000Z");
    const tz = "America/Denver";
    const streak = buildTrainingStreak({
      completedDates: [thursday],
      prefs,
      now: saturday,
      timeZone: tz,
    });
    expect(streak.todayScheduled).toBe(false);
    expect(streakStatusLine(streak)).toBe("Rest day. Streak safe.");
    expect(streakStatusLine(streak).toLowerCase()).not.toContain("train today");
  });
});
