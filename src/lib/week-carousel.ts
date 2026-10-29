import { BACKFILL_MAX_DAYS } from "@/lib/backfill-rules";
import type { PlannerPrefs, WeekPlanSwap } from "@/lib/week-plan";
import { weekStrip } from "@/lib/week-plan";
import { addZonedDays, dayKey, mondayOfZoned, startOfZonedDay, zonedParts } from "@/lib/timezone";

/** How far the day-chip carousel looks behind the current Monday. Train stays on this. */
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

/**
 * Past Mondays the calendar strip needs so a day inside the 30-day
 * backfill window is a chip, and `?day=` for that day stays selected.
 */
export function carouselBackfillPastWeeks(now: Date, timeZone: string) {
  const monday = mondayOfZoned(now, timeZone);
  const earliestMonday = mondayOfZoned(
    addZonedDays(startOfZonedDay(now, timeZone), -BACKFILL_MAX_DAYS, timeZone),
    timeZone,
  );
  const earliestKey = dayKey(earliestMonday, timeZone);
  let weeks = 0;
  let cursor = monday;
  while (dayKey(cursor, timeZone) > earliestKey && weeks < 12) {
    weeks += 1;
    cursor = addZonedDays(monday, -7 * weeks, timeZone);
  }
  return Math.max(WEEK_CAROUSEL_PAST_WEEKS, weeks);
}

/** Mondays from `pastWeeks` back through two weeks ahead, in the member's zone. */
export function carouselWeekAnchors(
  now: Date,
  timeZone: string,
  pastWeeks = WEEK_CAROUSEL_PAST_WEEKS,
): CarouselAnchor[] {
  const monday = mondayOfZoned(now, timeZone);
  const anchors: CarouselAnchor[] = [];
  for (let offset = -pastWeeks; offset <= WEEK_CAROUSEL_FUTURE_WEEKS; offset += 1) {
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
export function carouselLoggedRange(
  now: Date,
  timeZone: string,
  pastWeeks = WEEK_CAROUSEL_PAST_WEEKS,
) {
  const monday = mondayOfZoned(now, timeZone);
  return {
    from: addZonedDays(monday, -7 * pastWeeks, timeZone),
    to: addZonedDays(monday, 7 * (WEEK_CAROUSEL_FUTURE_WEEKS + 1), timeZone),
  };
}

export function carouselWeekStrips(
  prefs: PlannerPrefs,
  now: Date,
  timeZone: string,
  selected: Date | undefined,
  swaps: WeekPlanSwap[] = [],
  pastWeeks = WEEK_CAROUSEL_PAST_WEEKS,
) {
  const anchors = carouselWeekAnchors(now, timeZone, pastWeeks);
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

/**
 * Horizontal offset of a week panel. Each panel is one scroller width.
 * A zero width means the strip is not laid out yet, so the caller must not
 * treat the first week as the one on screen.
 */
export function weekScrollLeft(index: number, panelWidth: number) {
  if (!Number.isFinite(panelWidth) || panelWidth <= 0) return 0;
  const safe = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return safe * panelWidth;
}

/**
 * Which week a scroll position means.
 * A refresh can leave the scroller at 0 before layout catches up. That is the
 * oldest week in the strip, so a non-gesture scroll must stay on the week the
 * member was looking at and put the panel back. A real swipe, wheel, or fling
 * still changes the week, including back to the first one.
 */
/**
 * How long a coast can sit still before it stops counting as the member's gesture.
 * The finger itself has no timer. Momentum ends on scrollend or this idle gap.
 */
export const SCROLL_GESTURE_IDLE_MS = 150;

export type ScrollGesturePhase = "idle" | "contact" | "momentum";

export type ScrollGestureState = {
  phase: ScrollGesturePhase;
  /** Moment the coast closes if no further scroll arrives. Null while the finger is down. */
  idleAt: number | null;
};

export type ScrollGestureEvent = {
  type: "pointerdown" | "pointerup" | "wheel" | "scroll" | "scrollend";
  at: number;
};

export function scrollGestureOpen(state: ScrollGestureState, at: number) {
  if (state.phase === "contact") return true;
  if (state.phase !== "momentum") return false;
  if (state.idleAt == null) return true;
  return at < state.idleAt;
}

/** Finger down through release, then the coast, with no fixed window from the first touch. */
export function reduceScrollGesture(
  state: ScrollGestureState,
  event: ScrollGestureEvent,
  idleMs = SCROLL_GESTURE_IDLE_MS,
): ScrollGestureState {
  const current: ScrollGestureState = scrollGestureOpen(state, event.at)
    ? state
    : { phase: "idle", idleAt: null };
  if (event.type === "pointerdown") return { phase: "contact", idleAt: null };
  if (event.type === "pointerup") {
    if (current.phase !== "contact") return current;
    return { phase: "momentum", idleAt: event.at + idleMs };
  }
  if (event.type === "wheel") {
    if (current.phase === "contact") return current;
    return { phase: "momentum", idleAt: event.at + idleMs };
  }
  if (event.type === "scroll") {
    if (current.phase === "contact") return current;
    if (current.phase === "momentum") return { phase: "momentum", idleAt: event.at + idleMs };
    return current;
  }
  if (current.phase === "contact") return current;
  return { phase: "idle", idleAt: null };
}

/** Whether a scroll at `at` still belongs to the gesture described by `events`. */
export function scrollGestureAt(
  events: readonly ScrollGestureEvent[],
  at: number,
  idleMs = SCROLL_GESTURE_IDLE_MS,
) {
  let state: ScrollGestureState = { phase: "idle", idleAt: null };
  for (const event of events) {
    if (event.at > at) break;
    state = reduceScrollGesture(state, event, idleMs);
  }
  return scrollGestureOpen(state, at);
}

export function carouselIndexFromScroll(input: {
  scrollLeft: number;
  panelWidth: number;
  weekCount: number;
  intendedIndex: number;
  userGesture: boolean;
}): { index: number; restore: boolean } {
  const count = Number.isFinite(input.weekCount) ? Math.max(0, Math.floor(input.weekCount)) : 0;
  const last = Math.max(0, count - 1);
  const intended = Number.isFinite(input.intendedIndex)
    ? Math.max(0, Math.min(last, Math.floor(input.intendedIndex)))
    : 0;
  if (count === 0 || !Number.isFinite(input.panelWidth) || input.panelWidth <= 0) {
    return { index: intended, restore: false };
  }
  const raw = Number.isFinite(input.scrollLeft) ? Math.round(input.scrollLeft / input.panelWidth) : intended;
  const index = Math.max(0, Math.min(last, raw));
  if (!input.userGesture && index !== intended) return { index: intended, restore: true };
  return { index, restore: false };
}

/** The day summary that matches the chip the member tapped. */
export function calendarFocusMatches(selectedDay: string, dayParam: string) {
  return selectedDay.length > 0 && selectedDay === dayParam;
}

/** Week offset to show first. Today lands on the current week. */
export function carouselFocusOffset(
  weeks: { offset: number; days: { isSelected: boolean }[] }[],
) {
  return weeks.find((week) => week.days.some((day) => day.isSelected))?.offset ?? 0;
}

/**
 * A day chip only selects that date. Start and Resume are the buttons
 * that create a session and run the timer.
 */
export function weekChipHref(
  day: { isToday?: boolean; dayParam: string; logHref?: string },
  basePath: string,
) {
  return `${basePath}?day=${day.dayParam}`;
}

export type CarouselChipDay = { weekday: string; dayParam: string };

/**
 * The day the strip should highlight.
 * A jump to today must stay on today's key. Copying the previous weekday
 * into the new week lands on yesterday (the same weekday as the old pick).
 */
export function nextSelectedDay(
  event:
    | { type: "prop"; dayParam: string }
    | { type: "url"; dayParam: string | null; known: readonly string[]; fallback: string }
    | { type: "chip"; dayParam: string }
    | { type: "today"; todayParam: string }
    | {
        type: "snap";
        weekDays: readonly CarouselChipDay[];
        previousDayParam: string;
        allDays: readonly CarouselChipDay[];
        todayParam: string;
        jumpingToToday: boolean;
      },
): string {
  if (event.type === "chip") return event.dayParam;
  if (event.type === "today") return event.todayParam;
  if (event.type === "prop") return event.dayParam;
  if (event.type === "url") {
    if (event.dayParam && event.known.includes(event.dayParam)) return event.dayParam;
    return event.fallback;
  }
  if (event.jumpingToToday && event.todayParam) return event.todayParam;
  const previous = event.allDays.find((day) => day.dayParam === event.previousDayParam);
  const next =
    event.weekDays.find((day) => day.weekday === previous?.weekday) ?? event.weekDays[0];
  return next?.dayParam ?? event.previousDayParam;
}

/** The same weekday in another week, matching a week-swipe's day param. */
export function sameWeekdayDayParam(
  weeks: readonly { days: readonly CarouselChipDay[] }[],
  week: { days: readonly CarouselChipDay[] },
  selectedDayParam: string,
) {
  const selected = weeks.flatMap((item) => item.days).find((day) => day.dayParam === selectedDayParam);
  return (
    week.days.find((day) => day.weekday === selected?.weekday)?.dayParam ??
    week.days[0]?.dayParam ??
    selectedDayParam
  );
}

/** Shallow Train URL. The plan for this day is already on the page. */
export function trainDayHref(
  pathname: string,
  search: string,
  dayParam: string,
  level: string | null,
) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("day", dayParam);
  if (level) params.set("level", level);
  else params.delete("level");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
