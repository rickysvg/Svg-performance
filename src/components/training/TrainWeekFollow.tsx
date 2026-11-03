"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { TrainWeekChangeContext, type WeekChange } from "@/components/training/WeekStrip";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import type { MoveDayChoice } from "@/lib/week-plan";
import { neighborWeekDayParams, sameWeekdayDayParam, trainDayHref, type CarouselChipDay } from "@/lib/week-carousel";

export type TrainMoveBundle = {
  editable: boolean;
  days: MoveDayChoice[];
};

/**
 * The swiped week's plan is already rendered. Snapping updates ?day=
 * without asking the server for that day again.
 */
export function replaceTrainSearch(
  pathname: string,
  dayParam: string,
  level: string | null,
) {
  const href = trainDayHref(
    pathname,
    typeof window === "undefined" ? "" : window.location.search,
    dayParam,
    level,
  );
  window.history.replaceState(null, "", href);
  return href;
}

function panelWeek(child: ReactNode) {
  if (!isValidElement(child)) return null;
  const props = child.props as { "data-train-panel"?: string };
  return props["data-train-panel"] ?? null;
}

export function TrainWeekFollow({
  initialWeekStart,
  level,
  moves,
  intentSeqs = {},
  weeks = [],
  selectedDay = "",
  children,
}: {
  initialWeekStart: string;
  level: string | null;
  moves: Record<string, TrainMoveBundle>;
  /** Highest accepted move/undo sequence per session. Later clicks outrank it. */
  intentSeqs?: Record<string, number>;
  weeks?: readonly { weekStart: string; days: readonly CarouselChipDay[] }[];
  /** Civil day the page opened on. Prefetch follows a later chip tap via the URL. */
  selectedDay?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [trackedWeek, setTrackedWeek] = useState(initialWeekStart);
  if (initialWeekStart !== trackedWeek) {
    setTrackedWeek(initialWeekStart);
    setWeekStart(initialWeekStart);
  }
  const move = moves[weekStart];
  const [isPending, startTransition] = useTransition();

  const prefetchAround = useCallback((dayParam: string) => {
    if (!dayParam) return;
    const targets = new Set(neighborWeekDayParams(dayParam));
    const index = weeks.findIndex((week) => week.weekStart === weekStart);
    const around =
      index >= 0
        ? index
        : weeks.findIndex((week) => week.days.some((day) => day.dayParam === dayParam));
    for (const neighbor of [weeks[around - 1], weeks[around + 1]]) {
      if (!neighbor) continue;
      targets.add(sameWeekdayDayParam(weeks, neighbor, dayParam));
    }
    const search = typeof window === "undefined" ? "" : window.location.search;
    for (const day of targets) {
      if (!day || day === dayParam) continue;
      router.prefetch(trainDayHref(pathname, search, day, level), { kind: PrefetchKind.FULL });
    }
  }, [level, pathname, router, weekStart, weeks]);

  useEffect(() => {
    const selected =
      (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("day") : null) ||
      selectedDay;
    prefetchAround(selected);
  }, [prefetchAround, selectedDay]);

  function onWeekChange(week: WeekChange) {
    prefetchAround(week.dayParam);
    const rendered =
      typeof document !== "undefined" &&
      document.querySelector(`[data-train-panel="${week.weekStart}"]`);
    if (rendered || week.preserveUrl) setWeekStart(week.weekStart);
    if (week.preserveUrl) return;
    const href = replaceTrainSearch(pathname, week.dayParam, level);
    if (rendered) return;
    startTransition(() => {
      router.replace(href);
    });
  }

  const panels = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const panel = panelWeek(child);
    if (!panel) return child;
    const visible = panel === weekStart;
    return cloneElement(child as ReactElement<{ hidden?: boolean; inert?: boolean }>, {
      hidden: visible ? undefined : true,
      inert: visible ? undefined : true,
    });
  });

  return (
    <TrainWeekChangeContext.Provider value={onWeekChange}>
      <WorkoutMoveProvider
        editable={Boolean(move?.editable)}
        weekStart={weekStart}
        days={move?.days ?? []}
        intentFloor={intentSeqs}
        onCommitted={() => {
          router.refresh();
        }}
      >
        <div className="relative">
          {panels}
          {isPending ? (
            <div
              data-train-week-loading
              aria-busy="true"
              className="absolute inset-0 z-10 bg-background/80 p-1"
            >
              <p className="font-display text-xs uppercase tracking-wide text-accent">Loading week</p>
              <div className="mt-3 h-40 animate-pulse rounded-[1.75rem] bg-line" />
            </div>
          ) : null}
        </div>
      </WorkoutMoveProvider>
    </TrainWeekChangeContext.Provider>
  );
}
