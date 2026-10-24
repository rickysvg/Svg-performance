"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { TrainWeekChangeContext, type WeekChange } from "@/components/training/WeekStrip";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import type { MoveDayChoice } from "@/lib/week-plan";
import { trainDayHref } from "@/lib/week-carousel";

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
  children,
}: {
  initialWeekStart: string;
  level: string | null;
  moves: Record<string, TrainMoveBundle>;
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

  function onWeekChange(week: WeekChange) {
    setWeekStart(week.weekStart);
    if (week.preserveUrl) return;
    replaceTrainSearch(pathname, week.dayParam, level);
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
        onCommitted={() => {
          router.refresh();
        }}
      >
        {panels}
      </WorkoutMoveProvider>
    </TrainWeekChangeContext.Provider>
  );
}
