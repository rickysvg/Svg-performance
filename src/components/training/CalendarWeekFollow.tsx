"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { WeekStrip, type WeekCarouselWeek, type WeekChange } from "@/components/training/WeekStrip";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import type { MoveDayChoice } from "@/lib/week-plan";

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
  focusOffset,
  todayHref,
  initialWeekStart,
  level,
  moves,
  rearrange,
  children,
}: {
  weeks: WeekCarouselWeek[];
  completedDays: string[];
  completedByDay: Record<string, string[]>;
  focusOffset: number;
  todayHref: string;
  initialWeekStart: string;
  level: string | null;
  moves: Record<string, CalendarMoveBundle>;
  /** Kept for the page that still decides whether the viewed week can be edited. */
  rearrange?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const move = moves[weekStart];

  function onWeekChange(week: WeekChange) {
    setWeekStart(week.weekStart);
    replaceCalendarSearch(pathname, week, level);
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
    <WorkoutMoveProvider
      editable={Boolean(move?.editable)}
      weekStart={weekStart}
      days={move?.days ?? []}
    >
      <WeekStrip
        days={weeks.find((week) => week.offset === 0)?.days ?? []}
        weeks={weeks}
        basePath="/training/calendar"
        rearrange={rearrange}
        weekStart={weekStart}
        completedDays={completedDays}
        completedByDay={completedByDay}
        focusOffset={focusOffset}
        todayHref={todayHref}
        swapWeekStart={weekStart}
        onWeekChange={onWeekChange}
      />
      {panels}
    </WorkoutMoveProvider>
  );
}
