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
    // Wednesday 16 Sep + Friday 18 Sep. Thursday is off this Mon/Wed/Fri plan.
    // Saturday mobility is a real session, so a Friday-to-Monday gap is a miss.
    const wednesday = new Date("2026-09-16T18:00:00.000Z");
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(wednesday, tz), dayKey(friday, tz)];
    expect(currentTrainingStreak(keys, prefs, friday, tz)).toBe(2);
    expect(longestTrainingStreak(keys, prefs, friday, tz)).toBe(2);
  });

  it("breaks when a scheduled training day is missed", () => {
    const friday = new Date("2026-09-18T18:00:00.000Z");
    const tuesday = new Date("2026-09-22T18:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(friday, tz), dayKey(tuesday, tz)];
    // Monday 21 Sep is on this Mon/Wed/Fri plan and was missed.
    // Tuesday is not a scheduled day, so a Tuesday log does not keep the streak.
    expect(currentTrainingStreak(keys, prefs, tuesday, tz)).toBe(0);
  });

  it("keeps the streak alive when today is scheduled and not logged yet", () => {
    const wednesday = new Date("2026-09-16T18:00:00.000Z");
    const fridayMorning = new Date("2026-09-18T14:00:00.000Z");
    const tz = "America/Denver";
    const keys = [dayKey(wednesday, tz)];
    expect(currentTrainingStreak(keys, prefs, fridayMorning, tz)).toBe(1);
  });

  it("uses the athlete time zone around UTC midnight", () => {
    // Saturday 16:00 UTC = Saturday in Denver, Sunday in Sydney.
    // Sunday is off this plan. Saturday mobility is a scheduled session.
    const instant = new Date("2026-09-26T16:00:00.000Z");
    const denver = "America/Denver";
    const sydney = "Australia/Sydney";
    const denverKeys = [dayKey(instant, denver)];
    const sydneyKeys = [dayKey(instant, sydney)];

    expect(dayKey(instant, denver)).toBe("2026-09-26");
    expect(dayKey(instant, sydney)).toBe("2026-09-27");
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
    expect(dots[5]?.scheduled).toBe(true);
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
