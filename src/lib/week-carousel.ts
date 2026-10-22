import type { PlannerPrefs, WeekPlanSwap } from "@/lib/week-plan";
import { weekStrip } from "@/lib/week-plan";
import { addZonedDays, dayKey, mondayOfZoned, zonedParts } from "@/lib/timezone";

/** How far the day-chip carousel looks behind the current Monday. */
export const WEEK_CAROUSEL_PAST_WEEKS = 2;
/** How far the day-chip carousel looks ahead of the current Monday. */
export const WEEK_CAROUSEL_FUTURE_WEEKS = 2;

export type CarouselAnchor = {
  offset: number;
  date: Date;
  weekStart: string;
  label: string;
  rangeLabel: string;
};

export function weekCarouselLabel(offset: number) {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  if (offset === 1) return "Next week";
  if (offset === -2) return "2 weeks ago";
  if (offset === 2) return "In 2 weeks";
  if (offset < 0) return `${Math.abs(offset)} weeks ago`;
  return `In ${offset} weeks`;
}

/** Civil range for a Monday–Sunday week in the member's zone. */
export function weekRangeLabel(monday: Date, timeZone: string) {
  const sunday = addZonedDays(monday, 6, timeZone);
  const start = zonedParts(monday, timeZone);
  const end = zonedParts(sunday, timeZone);
  const startMonth = monday.toLocaleDateString("en-US", { month: "short", timeZone });
  const endMonth = sunday.toLocaleDateString("en-US", { month: "short", timeZone });
  if (start.month === end.month && start.year === end.year) {
    return `${startMonth} ${start.day} – ${end.day}`;
  }
  return `${startMonth} ${start.day} – ${endMonth} ${end.day}`;
}

/** Mondays from two weeks back through two weeks ahead, in the member's zone. */
export function carouselWeekAnchors(now: Date, timeZone: string): CarouselAnchor[] {
  const monday = mondayOfZoned(now, timeZone);
  const anchors: CarouselAnchor[] = [];
  for (
    let offset = -WEEK_CAROUSEL_PAST_WEEKS;
    offset <= WEEK_CAROUSEL_FUTURE_WEEKS;
    offset += 1
  ) {
    const date = addZonedDays(monday, offset * 7, timeZone);
    anchors.push({
      offset,
      date,
      weekStart: dayKey(date, timeZone),
      label: weekCarouselLabel(offset),
      rangeLabel: weekRangeLabel(date, timeZone),
    });
  }
  return anchors;
}

/**
 * Logged-day query window for the carousel. `completedLocalDayKeys` treats
 * `to` as exclusive, so this ends on the Monday after the last visible week.
 */
export function carouselLoggedRange(now: Date, timeZone: string) {
  const monday = mondayOfZoned(now, timeZone);
  return {
    from: addZonedDays(monday, -7 * WEEK_CAROUSEL_PAST_WEEKS, timeZone),
    to: addZonedDays(monday, 7 * (WEEK_CAROUSEL_FUTURE_WEEKS + 1), timeZone),
  };
}

export function carouselWeekStrips(
  prefs: PlannerPrefs,
  now: Date,
  timeZone: string,
  selected: Date | undefined,
  swaps: WeekPlanSwap[] = [],
) {
  const anchors = carouselWeekAnchors(now, timeZone);
  return {
    anchors,
    days: anchors.flatMap((anchor) =>
      weekStrip(prefs, now, timeZone, selected, swaps, anchor.date),
    ),
  };
}

export function packCarouselWeeks<T>(anchors: CarouselAnchor[], days: T[]) {
  return anchors.map((anchor, index) => ({
    offset: anchor.offset,
    weekStart: anchor.weekStart,
    label: anchor.label,
    rangeLabel: anchor.rangeLabel,
    days: days.slice(index * 7, index * 7 + 7),
  }));
}

/** Week offset to show first. Today lands on the current week. */
export function carouselFocusOffset(
  weeks: { offset: number; days: { isSelected: boolean }[] }[],
) {
  return weeks.find((week) => week.days.some((day) => day.isSelected))?.offset ?? 0;
}
