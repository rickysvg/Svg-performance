"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { WeekStrip, type WeekCarouselWeek, type WeekChange } from "@/components/training/WeekStrip";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import type { MoveDayChoice } from "@/lib/week-plan";
import { calendarFocusMatches } from "@/lib/week-carousel";

const CalendarDayContext = createContext("");

/** One day's summary. Hidden unless it is the chip the member has selected. */
export function CalendarFocusGate({
  dayParam,
  children,
}: {
  dayParam: string;
  children: ReactNode;
}) {
  const selected = useContext(CalendarDayContext);
  const open = calendarFocusMatches(selected, dayParam);
  return (
    <div data-calendar-focus={dayParam} hidden={open ? undefined : true} inert={open ? undefined : true}>
      {children}
    </div>
  );
}

export type CalendarMoveBundle = {
  editable: boolean;
  days: MoveDayChoice[];
};

/**
 * The five weeks are already rendered. Snapping replaces the week and day
 * in the URL without asking the server for them again.
 */
export function replaceCalendarSearch(
  pathname: string,
  week: WeekChange,
  level: string | null,
) {
  const params = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  params.set("week", week.weekStart);
  params.set("day", week.dayParam);
  if (level) params.set("level", level);
  else params.delete("level");
  const href = `${pathname}?${params.toString()}`;
  window.history.replaceState(null, "", href);
  return href;
}

function panelWeek(child: ReactNode) {
  if (!isValidElement(child)) return null;
  const props = child.props as { "data-calendar-panel"?: string };
  return props["data-calendar-panel"] ?? null;
}

export function CalendarWeekFollow({
  weeks,
  completedDays,
  completedByDay,
  partialDays = [],
  focusOffset,
  todayHref,
  initialWeekStart,
  level,
  moves,
  intentSeqs = {},
  rearrange,
  logPastDayKeys = [],
  timeZone,
  initialDay,
  children,
}: {
  weeks: WeekCarouselWeek[];
  completedDays: string[];
  completedByDay: Record<string, string[]>;
  partialDays?: string[];
  focusOffset: number;
  todayHref: string;
  initialWeekStart: string;
  level: string | null;
  moves: Record<string, CalendarMoveBundle>;
  /** Highest accepted move/undo sequence per session. Later clicks outrank it. */
  intentSeqs?: Record<string, number>;
  /** Kept for the page that still decides whether the viewed week can be edited. */
  rearrange?: boolean;
  logPastDayKeys?: string[];
  timeZone?: string;
  /** Civil day the page was rendered for. Chip taps move the summary off this. */
  initialDay: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [seenWeek, setSeenWeek] = useState(initialWeekStart);
  const [dayParam, setDayParam] = useState(initialDay);
  const [seenDay, setSeenDay] = useState(initialDay);
  if (initialWeekStart !== seenWeek) {
    setSeenWeek(initialWeekStart);
    setWeekStart(initialWeekStart);
  }
  if (initialDay !== seenDay) {
    setSeenDay(initialDay);
    setDayParam(initialDay);
  }
  const move = moves[weekStart];

  function onWeekChange(week: WeekChange) {
    setWeekStart(week.weekStart);
    setDayParam(week.dayParam);
    if (week.preserveUrl) return;
    replaceCalendarSearch(pathname, week, level);
  }

  function onDayChange(nextDay: string) {
    setDayParam(nextDay);
    const week = weeks.find((item) => item.days.some((day) => day.dayParam === nextDay));
    if (!week) return;
    setWeekStart(week.weekStart);
    replaceCalendarSearch(
      pathname,
      {
        weekStart: week.weekStart,
        offset: week.offset,
        label: week.label,
        dayParam: nextDay,
      },
      level,
    );
  }

  const panels = Children.map(children, (child) => {
    const panel = panelWeek(child);
    if (!panel || !isValidElement(child)) return child;
    const visible = panel === weekStart;
    return cloneElement(child as ReactElement<{ hidden?: boolean; inert?: boolean }>, {
      hidden: visible ? undefined : true,
      inert: visible ? undefined : true,
    });
  });

  return (
    <CalendarDayContext.Provider value={dayParam}>
      <WorkoutMoveProvider
        editable={Boolean(move?.editable)}
        weekStart={weekStart}
        days={move?.days ?? []}
        intentFloor={intentSeqs}
        onCommitted={() => {
          router.refresh();
        }}
      >
        <WeekStrip
          days={weeks.find((week) => week.offset === 0)?.days ?? []}
          weeks={weeks}
          basePath="/training/calendar"
          rearrange={rearrange}
          weekStart={weekStart}
          completedDays={completedDays}
          completedByDay={completedByDay}
          partialDays={partialDays}
          focusOffset={focusOffset}
          todayHref={todayHref}
          swapWeekStart={weekStart}
          onWeekChange={onWeekChange}
          onDayChange={onDayChange}
          logPastDayKeys={logPastDayKeys}
          timeZone={timeZone}
        />
        {panels}
      </WorkoutMoveProvider>
    </CalendarDayContext.Provider>
  );
}
