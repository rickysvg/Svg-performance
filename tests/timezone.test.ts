import { describe, expect, it } from "vitest";
import {
  addZonedDays,
  dayKey,
  getUserToday,
  mondayOfZoned,
  resolveTimeZone,
  sameZonedDay,
  startOfZonedDay,
  weekdayInZone,
} from "@/lib/timezone";
import { weekdayInAppZone } from "@/lib/week-plan";

const LONDON = "Europe/London";
const SYDNEY = "Australia/Sydney";
const LA = "America/Los_Angeles";
const DENVER = "America/Denver";

describe("resolveTimeZone", () => {
  it("falls back saved → cookie → APP_TIMEZONE → UTC", () => {
    expect(resolveTimeZone("Australia/Sydney", "Europe/London")).toBe("Australia/Sydney");
    expect(resolveTimeZone("", "Europe/London")).toBe("Europe/London");
    expect(resolveTimeZone(undefined, "not-a-zone", "America/Denver")).toBe("America/Denver");
    expect(resolveTimeZone("", "bogus")).toBe("UTC");
  });
});

describe("civil day keys around midnight UTC", () => {
  it("keeps Sep 25 23:30 UTC on the previous day in the US and the next day in London/Sydney", () => {
    const instant = new Date("2026-09-25T23:30:00.000Z");
    expect(dayKey(instant, LONDON)).toBe("2026-09-26");
    expect(dayKey(instant, SYDNEY)).toBe("2026-09-26");
    expect(dayKey(instant, LA)).toBe("2026-09-25");
    expect(dayKey(instant, DENVER)).toBe("2026-09-25");
    expect(getUserToday(instant, SYDNEY).weekday).toBe("Saturday");
    expect(getUserToday(instant, DENVER).weekday).toBe("Friday");
  });

  it("flips Sydney to the next local day at 14:00 UTC in September", () => {
    const before = new Date("2026-09-25T13:59:00.000Z");
    const after = new Date("2026-09-25T14:00:00.000Z");
    expect(dayKey(before, SYDNEY)).toBe("2026-09-25");
    expect(weekdayInZone(before, SYDNEY)).toBe("Friday");
    expect(dayKey(after, SYDNEY)).toBe("2026-09-26");
    expect(weekdayInZone(after, SYDNEY)).toBe("Saturday");
    expect(dayKey(after, DENVER)).toBe("2026-09-25");
    expect(dayKey(after, LONDON)).toBe("2026-09-25");
    expect(dayKey(after, LA)).toBe("2026-09-25");
  });

  it("starts a zoned Monday at Sunday afternoon UTC in Sydney", () => {
    const mondaySydney = startOfZonedDay(new Date("2026-09-21T02:00:00.000Z"), SYDNEY);
    expect(mondaySydney.toISOString()).toBe("2026-09-20T14:00:00.000Z");
    expect(weekdayInZone(mondaySydney, SYDNEY)).toBe("Monday");
    expect(addZonedDays(mondaySydney, 1, SYDNEY).toISOString()).toBe(
      "2026-09-21T14:00:00.000Z",
    );
    expect(weekdayInZone(addZonedDays(mondaySydney, 1, SYDNEY), SYDNEY)).toBe("Tuesday");
  });
});

describe("DST boundaries", () => {
  it("handles US spring-forward in Denver and Los Angeles", () => {
    const denverBefore = new Date("2026-03-08T08:30:00.000Z");
    const denverAfter = new Date("2026-03-08T09:30:00.000Z");
    const laBefore = new Date("2026-03-08T09:30:00.000Z");
    const laAfter = new Date("2026-03-08T10:30:00.000Z");
    expect(dayKey(denverBefore, DENVER)).toBe("2026-03-08");
    expect(dayKey(denverAfter, DENVER)).toBe("2026-03-08");
    expect(getUserToday(denverBefore, DENVER).hour).toBe(1);
    expect(getUserToday(denverAfter, DENVER).hour).toBe(3);
    expect(getUserToday(laBefore, LA).hour).toBe(1);
    expect(getUserToday(laAfter, LA).hour).toBe(3);
    expect(startOfZonedDay(denverAfter, DENVER).toISOString()).toBe(
      "2026-03-08T07:00:00.000Z",
    );
  });

  it("handles UK spring-forward in London", () => {
    const before = new Date("2026-03-29T00:30:00.000Z");
    const after = new Date("2026-03-29T01:30:00.000Z");
    expect(dayKey(before, LONDON)).toBe("2026-03-29");
    expect(dayKey(after, LONDON)).toBe("2026-03-29");
    expect(getUserToday(before, LONDON).hour).toBe(0);
    expect(getUserToday(after, LONDON).hour).toBe(2);
  });

  it("handles Sydney spring-forward in October", () => {
    const before = new Date("2026-10-03T15:30:00.000Z");
    const after = new Date("2026-10-03T16:30:00.000Z");
    expect(dayKey(before, SYDNEY)).toBe("2026-10-04");
    expect(dayKey(after, SYDNEY)).toBe("2026-10-04");
    expect(getUserToday(before, SYDNEY).hour).toBe(1);
    expect(getUserToday(after, SYDNEY).hour).toBe(3);
    expect(startOfZonedDay(after, SYDNEY).toISOString()).toBe("2026-10-03T14:00:00.000Z");
  });
});

describe("planner weekdays use the athlete zone", () => {
  it("does not use the host clock for a Friday evening UTC instant", () => {
    const fridayUtc = new Date("2026-09-25T16:00:00.000Z");
    expect(weekdayInAppZone(fridayUtc, SYDNEY)).toBe("Saturday");
    expect(weekdayInAppZone(fridayUtc, DENVER)).toBe("Friday");
    expect(weekdayInAppZone(fridayUtc, LONDON)).toBe("Friday");
    expect(weekdayInAppZone(fridayUtc, LA)).toBe("Friday");
  });

  it("keeps Monday-of-week in the athlete zone", () => {
    const sydneySaturday = new Date("2026-09-25T16:00:00.000Z");
    const monday = mondayOfZoned(sydneySaturday, SYDNEY);
    expect(dayKey(monday, SYDNEY)).toBe("2026-09-21");
    expect(sameZonedDay(monday, new Date("2026-09-20T14:00:00.000Z"), SYDNEY)).toBe(true);
  });
});
