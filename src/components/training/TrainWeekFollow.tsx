"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  useTransition,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { TrainWeekChangeContext, type WeekChange } from "@/components/training/WeekStrip";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import type { MoveDayChoice } from "@/lib/week-plan";
import { sameWeekdayDayParam, trainDayHref, type CarouselChipDay } from "@/lib/week-carousel";

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

  useEffect(() => {
    if (weeks.length === 0) return;
    const selected =
      (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("day") : null) ||
      selectedDay;
    const index = weeks.findIndex((week) => week.weekStart === weekStart);
    for (const neighbor of [weeks[index - 1], weeks[index + 1]]) {
      if (!neighbor) continue;
      const day = sameWeekdayDayParam(weeks, neighbor, selected);
      router.prefetch(trainDayHref(pathname, window.location.search, day, level));
    }
  }, [level, pathname, router, selectedDay, weekStart, weeks]);

  function onWeekChange(week: WeekChange) {
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
