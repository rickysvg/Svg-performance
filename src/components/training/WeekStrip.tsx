"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  resetCalendarWeekAction,
  swapCalendarDaysAction,
} from "@/app/actions/week-plan";
import { useWorkoutMove } from "@/components/training/WorkoutMove";
import { chipMarkForDay, type ChipMark } from "@/lib/chip-mark";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { dayKey } from "@/lib/timezone";
import { FRIDAY_CONDITIONING_CHIP_WORD, FRIDAY_CONDITIONING_LABEL } from "@/lib/mesocycle";
import { nextSelectedDay, weekChipHref, weekScrollLeft } from "@/lib/week-carousel";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number] & {
  logHref?: string;
  sessionIds?: string[];
};

export type WeekChange = {
  weekStart: string;
  offset: number;
  label: string;
  dayParam: string;
  /** Today already wrote ?day= with router.push. Move the panel without replaceState. */
  preserveUrl?: boolean;
};

/** Train passes the snap callback through context. The strip is a server child, so a prop added later does not arrive. */
export const TrainWeekChangeContext = createContext<((week: WeekChange) => void) | null>(null);

export type WeekCarouselWeek = {
  offset: number;
  weekStart: string;
  label: string;
  rangeLabel: string;
  days: Item[];
  rearrange?: boolean;
};

export type WeekChipActivity = {
  id: string;
  label: string;
};

const WORD_LABELS = new Set(["Off", "Rest", "Recover"]);
const ICON_ACTIVITIES = new Set([
  "Bag",
  "Lift",
  "Cardio",
  "Mobility",
  "Sparring",
  "Bike",
  "GPP",
  FRIDAY_CONDITIONING_LABEL,
]);

const ACTIVITY_NAME: Record<string, string> = {
  GPP: "Cardio",
  Bike: "Cardio",
  Recover: "Mobility",
  Cardio: "Cardio",
  Mobility: "Mobility",
  Sparring: "Sparring",
  Circuit: FRIDAY_CONDITIONING_LABEL,
  [FRIDAY_CONDITIONING_CHIP_WORD]: FRIDAY_CONDITIONING_LABEL,
  [FRIDAY_CONDITIONING_LABEL]: FRIDAY_CONDITIONING_LABEL,
};

function chipId(part: string) {
  if (part === "Bike" || part === "GPP") return "Cardio";
  if (part === "Recover") return "Mobility";
  if (
    part === "Circuit" ||
    part === FRIDAY_CONDITIONING_CHIP_WORD ||
    part === FRIDAY_CONDITIONING_LABEL
  ) {
    return FRIDAY_CONDITIONING_LABEL;
  }
  return part;
}

function iconTileClass(id: string, selected: boolean) {
  if (id === "Bag") return "rounded-full bg-accent text-black";
  // Lime bolt on carbon. Same tile on a selected day so it does not flip to white.
  if (id === FRIDAY_CONDITIONING_LABEL) return "rounded-[3px] bg-carbon text-accent";
  return selected ? "text-white" : "text-foreground";
}

export function activityChipName(id: string) {
  return ACTIVITY_NAME[id] ?? id;
}

function spokenSummary(summary: string) {
  return summary
    .split("+")
    .filter((part) => part.length > 0)
    .map((part) => activityChipName(part))
    .join("+");
}

/** Split a plan summary into chip activities. Rendering is icons, not letters. */
export function weekChipActivities(summary: string): WeekChipActivity[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];
  return trimmed
    .split("+")
    .filter((part) => part.length > 0)
    .map((part) => ({
      id: chipId(part),
      label: activityChipName(chipId(part)),
    }));
}

function ActivityIcon({ id }: { id: string }) {
  const common = {
    viewBox: "0 0 16 16",
    className: "block h-full w-full",
    "aria-hidden": true as const,
  };

  switch (id) {
    case "Bag":
      return (
        <svg {...common} fill="currentColor">
          <path
            fillRule="evenodd"
            d="M6.15.35h3.7v1.45h1.15v1.4H4.99V1.8h1.16V.35zM4.05 4.15h7.9c.5 0 .85.42.85 1V11.2c0 1.9-1.8 3.45-4.8 3.45s-4.8-1.55-4.8-3.45V5.15c0-.58.35-1 .85-1zM5.55 6.45h4.9v1.2h-4.9zM5.55 8.9h4.9v1.2h-4.9z"
          />
        </svg>
      );
    case "Lift":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M1.4 4.8v6.4M3.4 3.4v9.2M12.6 3.4v9.2M14.6 4.8v6.4M3.4 8h9.2" />
        </svg>
      );
    case "Bike":
    case "GPP":
    case "Cardio":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M.7 8.2h3.2L5.4 4.2l2.8 7.6 1.6-3.6H15.3" />
        </svg>
      );
    case FRIDAY_CONDITIONING_LABEL:
      return (
        <svg {...common} fill="currentColor">
          <path d="M9.15.9 3.2 8.7h3.7l-1 6.4 6.9-8.6H8.9L9.15.9z" />
        </svg>
      );
    case "Mobility":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.3 8.6c1.6-3 3-3 4.5 0s2.9 3 4.5 0 2.9-3 4.5 0" />
        </svg>
      );
    case "Sparring":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <circle cx="5" cy="8" r="2.4" />
          <circle cx="11" cy="8" r="2.4" />
        </svg>
      );
    default:
      return null;
  }
}

function ActivityMarks({
  activities,
  selected,
}: {
  activities: WeekChipActivity[];
  selected: boolean;
}) {
  const gaps = Math.max(activities.length - 1, 0);
  const box = `min(1rem, calc((100% - ${gaps}px) / ${activities.length || 1}))`;

  return (
    <span
      data-week-chip-label
      className="mt-1 flex h-4 w-full min-w-0 items-center justify-center gap-px"
    >
      {activities.map((activity) => (
        <span
          key={activity.id}
          title={activity.label}
          data-week-activity={activity.id}
          className={`inline-flex aspect-square min-w-0 items-center justify-center ${iconTileClass(activity.id, selected)}`}
          style={{ width: box, flex: "0 0 auto" }}
        >
          <span className="sr-only">{activity.label}</span>
          {ICON_ACTIVITIES.has(activity.id) ? (
            <ActivityIcon id={activity.id} />
          ) : (
            <span aria-hidden className="text-[9px] font-medium leading-none">
              {activity.label}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function legendIds(days: Item[]) {
  const parts = new Set(days.flatMap((day) => day.summary.split("+").map(chipId)));
  const shown = ["Lift", "Cardio", FRIDAY_CONDITIONING_LABEL, "Mobility"].filter((id) =>
    parts.has(id),
  );
  if (parts.has("Bag")) shown.push("Bag");
  if (parts.has("Sparring")) shown.push("Sparring");
  return shown.length > 0 ? shown : ["Lift", "Cardio", "Mobility"];
}

function WeekLegend({ days }: { days: Item[] }) {
  const ids = legendIds(days);
  return (
    <ul
      data-week-legend
      aria-label="Activity key"
      className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1"
    >
      {ids.map((id) => (
        <li
          key={id}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none text-foreground"
        >
          <span
            aria-hidden
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${iconTileClass(id, false)}`}
          >
            <ActivityIcon id={id} />
          </span>
          {activityChipName(id)}
        </li>
      ))}
    </ul>
  );
}

const HOLD_MS = 450;
const SWIPE_SLOP_PX = 12;

function useWeekSwap(activeWeekStart: string | undefined) {
  const router = useRouter();
  const move = useWorkoutMove();
  const [source, setSource] = useState<{ weekStart: string; weekday: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClick = useRef(false);
  const pointerDown = useRef(false);
  const scrolledDuringPointer = useRef(false);
  const drag = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  function disarmHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function noteScrollerScroll() {
    if (pointerDown.current) scrolledDuringPointer.current = true;
  }

  function onPointerDown(
    event: PointerEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) {
    if (event.button !== 0) return;
    pointerDown.current = true;
    scrolledDuringPointer.current = false;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    if (!rearrange || pending) return;
    ignoreClick.current = false;
    disarmHold();
    const start = weekStart ?? activeWeekStart ?? "";
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (drag.current.moved || scrolledDuringPointer.current) return;
      ignoreClick.current = true;
      setSource({ weekStart: start, weekday });
      setError(null);
    }, HOLD_MS);
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointerDown.current) return;
    const dx = Math.abs(event.clientX - drag.current.x);
    const dy = Math.abs(event.clientY - drag.current.y);
    if (dx > SWIPE_SLOP_PX || dy > SWIPE_SLOP_PX) {
      drag.current.moved = true;
      disarmHold();
    }
  }

  function onPointerUp() {
    pointerDown.current = false;
    disarmHold();
  }

  function commitSwap(from: string, to: string, weekStart?: string) {
    const start = weekStart ?? activeWeekStart;
    setError(null);
    if (move && move.editable && start && start === activeWeekStart) {
      setSource(null);
      move.swapDays(from, to);
      return;
    }
    startTransition(async () => {
      const result = await swapCalendarDaysAction(from, to, start);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSource(null);
      router.refresh();
    });
  }

  function resetWeek(weekStart?: string) {
    const start = weekStart ?? activeWeekStart;
    setError(null);
    startTransition(async () => {
      const result = await resetCalendarWeekAction(start);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSource(null);
      router.refresh();
    });
  }

  function onChipClick(
    event: MouseEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) {
    if (drag.current.moved || scrolledDuringPointer.current) {
      event.preventDefault();
      drag.current.moved = false;
      scrolledDuringPointer.current = false;
      return;
    }
    if (!rearrange) return;
    if (ignoreClick.current) {
      event.preventDefault();
      ignoreClick.current = false;
      return;
    }
    const start = weekStart ?? activeWeekStart ?? "";
    if (!source || source.weekStart !== start) return;
    event.preventDefault();
    if (pending) return;
    if (source.weekday === weekday) {
      setSource(null);
      return;
    }
    commitSwap(source.weekday, weekday, start);
  }

  function onContextMenu(
    event: MouseEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) {
    if (!rearrange || pending) return;
    event.preventDefault();
    ignoreClick.current = true;
    disarmHold();
    setSource({ weekStart: weekStart ?? activeWeekStart ?? "", weekday });
    setError(null);
  }

  return {
    source,
    setSource,
    error,
    pending,
    noteScrollerScroll,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onChipClick,
    onContextMenu,
    resetWeek,
  };
}

function WeekChipList({
  days,
  basePath,
  rearrange,
  weekStart,
  completedDays,
  completedByDay,
  partialDays,
  inProgressDay,
  selectedDay,
  interactive = true,
  source,
  pending,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onChipClick,
  onContextMenu,
  onSelectDay,
  lockChipNavigation = false,
}: {
  days: Item[];
  basePath: string;
  rearrange: boolean;
  weekStart?: string;
  completedDays: string[];
  completedByDay: Record<string, string[]>;
  partialDays: string[];
  inProgressDay?: string;
  selectedDay?: string;
  interactive?: boolean;
  source: { weekStart: string; weekday: string } | null;
  pending: boolean;
  onPointerDown: (
    event: PointerEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
  onChipClick: (
    event: MouseEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) => void;
  onContextMenu: (
    event: MouseEvent,
    weekday: string,
    rearrange: boolean,
    weekStart?: string,
  ) => void;
  onSelectDay?: (dayParam: string) => void;
  /** Calendar handles the day itself. The link must not reload the old day. */
  lockChipNavigation?: boolean;
}) {
  return (
    <ol data-week-strip className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const href = weekChipHref(day, basePath);
        const selected = selectedDay ? day.dayParam === selectedDay : day.isSelected;
        const activities = weekChipActivities(day.summary);
        const word =
          activities.length === 1 && WORD_LABELS.has(activities[0]!.id)
            ? activities[0]!.label
            : null;
        const held = source?.weekday === day.weekday && source.weekStart === (weekStart ?? "");
        const mark: ChipMark = chipMarkForDay({
          plannedSessionIds: day.sessionIds ?? [],
          completedSessionIds: completedByDay[day.dayParam] ?? [],
          dayLogged: completedDays.includes(day.dayParam),
          partial: partialDays.includes(day.dayParam),
        });
        const missed = mark === "none" && day.isPast && day.active;
        const movedLabel = day.movedFrom ? `, showing ${day.movedFrom}’s workout` : "";
        const historyLabel =
          mark === "complete"
            ? ", logged"
            : mark === "partial"
              ? ", partly logged"
              : missed
                ? ", missed"
                : "";
        const swapping = source?.weekStart === (weekStart ?? "");
        const label = swapping
          ? held
            ? `${day.weekday}, selected to move. Tap another day to swap.`
            : `Swap ${source?.weekday} with ${day.weekday}`
          : `${day.weekday} ${day.dateLabel}, ${spokenSummary(day.summary)}${movedLabel}${historyLabel}`;
        return (
          <li key={day.dayParam} className="min-w-0">
            <Link
              href={href}
              data-testid={`week-chip-${day.dayParam}`}
              data-week-chip={day.short}
              tabIndex={interactive === false ? -1 : undefined}
              data-moved-from={day.movedFrom || undefined}
              data-move-source={held ? "true" : undefined}
              data-week-past={day.isPast ? "true" : undefined}
              data-week-missed={missed ? "true" : undefined}
              aria-current={day.isToday ? "date" : undefined}
              data-week-today={day.isToday ? "true" : undefined}
              data-week-selected={selected ? "true" : undefined}
              aria-pressed={rearrange ? Boolean(held || selected) : selected}
              aria-label={label}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => onPointerDown(event, day.weekday, rearrange, weekStart)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={
                rearrange
                  ? { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }
                  : undefined
              }
              onContextMenu={(event) => onContextMenu(event, day.weekday, rearrange, weekStart)}
              onClick={(event) => {
                onChipClick(event, day.weekday, rearrange, weekStart);
                if (event.defaultPrevented) return;
                if (lockChipNavigation) event.preventDefault();
                onSelectDay?.(day.dayParam);
              }}
              className={`flex h-[5.5rem] w-full min-w-0 flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 text-center text-foreground transition-colors ${
                rearrange ? "touch-manipulation select-none" : ""
              } ${
                day.isToday
                  ? "border-2 border-accent bg-accent/15 shadow-[0_0_16px_rgba(203,248,5,0.35)]"
                  : selected
                    ? "border border-[#cfd6c8] bg-card"
                    : "border border-line bg-card hover:border-white/30"
              } ${held ? "ring-2 ring-inset ring-white/70" : ""}`}
            >
              <span
                className={`font-display text-[11px] uppercase leading-none tracking-wide ${
                  day.isToday ? "text-accent" : selected ? "text-foreground" : "text-muted"
                }`}
              >
                {day.short}
              </span>
              <span
                data-week-chip-date
                className="font-display mt-1 text-base leading-none text-foreground"
              >
                {day.dateLabel}
              </span>
              {inProgressDay && day.dayParam === inProgressDay ? (
                <span
                  data-week-draft
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden
                />
              ) : null}
              {word ? (
                <span
                  data-week-chip-label
                  className="mt-1 text-[11px] font-medium leading-none text-foreground"
                >
                  {word}
                </span>
              ) : (
                <ActivityMarks activities={activities} selected={false} />
              )}
              {mark === "complete" ? (
                <span
                  data-week-complete
                  className="mt-1 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-accent text-black"
                  aria-hidden
                >
                  <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M2.2 6.2 4.8 8.6 9.8 3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : mark === "partial" ? (
                <span
                  data-week-partial
                  className="relative mt-1 inline-block h-3 w-3 shrink-0 rounded-full border-2 border-accent/35"
                  aria-hidden
                >
                  <span className="absolute -inset-0.5 rounded-full border-2 border-accent [clip-path:inset(0_50%_0_0)]" />
                </span>
              ) : missed ? (
                <span
                  data-week-missed-mark
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal"
                  aria-hidden
                />
              ) : (
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0" />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function RearrangeChrome({
  rearrange,
  days,
  weekStart,
  source,
  error,
  pending,
  onCancel,
  onReset,
}: {
  rearrange: boolean;
  days: Item[];
  weekStart?: string;
  source: string | null;
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  onReset: (weekStart?: string) => void;
}) {
  if (!rearrange) return null;
  const moving = days.find((day) => day.weekday === source);
  const moved = days.filter((day) => day.movedFrom);
  return (
    <>
      {source ? (
        <div
          data-move-sheet
          role="status"
          className="mt-3 rounded-2xl bg-black px-4 py-4 text-white"
        >
          <p className="font-display text-xs uppercase tracking-wide text-highlighter">
            Move {moving?.short ?? source}
          </p>
          <p className="mt-1 text-sm text-white/80">
            Tap another day to swap workouts. {source}’s work lands on that day, and that
            day’s work lands here.
            {moving?.isPast
              ? " Pick a later day to make this missed session up."
              : " This week only."}
          </p>
          {error ? <p className="mt-2 text-sm text-highlighter">{error}</p> : null}
          <button
            data-testid="training-cancel"
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Cancel"}
          </button>
        </div>
      ) : null}
      {!source && moved.length > 0 ? (
        <div data-week-moved className="mt-3 rounded-2xl bg-black px-4 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-wide text-highlighter">
            This week
          </p>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            {moved.map((day) => (
              <li key={day.weekday}>
                {day.weekday} is {day.movedFrom}’s workout.
              </li>
            ))}
          </ul>
          {error ? <p className="mt-2 text-sm text-highlighter">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              data-testid="training-back-to-the-default-week"
              type="button"
              onClick={() => onReset(weekStart)}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {pending ? "Saving…" : "Back to the default week"}
            </button>
          </div>
        </div>
      ) : null}
      {!source && moved.length === 0 ? (
        <p data-move-hint className="mt-3 text-sm text-muted">
          Tap Move on a session to put it on another day. Hold a day to swap two whole days.
        </p>
      ) : null}
      {!source && moved.length === 0 && error ? (
        <p className="mt-2 text-sm text-muted">{error}</p>
      ) : null}
    </>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      {direction === "left" ? (
        <path d="M10 3.5 5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function WeekDayCarousel({
  weeks,
  basePath,
  completedDays,
  completedByDay,
  partialDays,
  inProgressDay,
  focusOffset,
  todayHref,
  swapWeekStart,
  onWeekChange,
  logPastDayKeys = [],
  timeZone,
  onDayChange,
}: {
  weeks: WeekCarouselWeek[];
  basePath: string;
  completedDays: string[];
  completedByDay: Record<string, string[]>;
  partialDays: string[];
  inProgressDay?: string;
  focusOffset: number;
  todayHref?: string;
  swapWeekStart?: string;
  onWeekChange?: (week: WeekChange) => void;
  logPastDayKeys?: string[];
  timeZone?: string;
  onDayChange?: (dayParam: string) => void;
}) {
  const router = useRouter();
  const trainWeekChange = useContext(TrainWeekChangeContext);
  const scrollerId = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const swap = useWeekSwap(swapWeekStart);
  const initialIndex = Math.max(
    0,
    weeks.findIndex((week) => week.offset === focusOffset),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [ready, setReady] = useState(false);
  const initialSelected =
    weeks.flatMap((week) => week.days).find((day) => day.isSelected)?.dayParam ?? "";
  const [selectedDay, setSelectedDay] = useState(initialSelected);
  const selectedDayRef = useRef(initialSelected);
  const skipUrl = useRef(true);
  const jumpingToToday = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const weeksRef = useRef(weeks);
  const onWeekChangeRef = useRef(onWeekChange ?? trainWeekChange ?? undefined);
  useLayoutEffect(() => {
    weeksRef.current = weeks;
    onWeekChangeRef.current = onWeekChange ?? trainWeekChange ?? undefined;
    indexRef.current = activeIndex;
    selectedDayRef.current = selectedDay;
  });

  function knownDayParams() {
    return weeksRef.current.flatMap((week) => week.days.map((day) => day.dayParam));
  }

  function todayParam() {
    return weeksRef.current.flatMap((week) => week.days).find((day) => day.isToday)?.dayParam ?? "";
  }

  function applySelected(dayParam: string) {
    selectedDayRef.current = dayParam;
    setSelectedDay(dayParam);
  }

  function scrollToIndex(index: number, behavior: ScrollBehavior) {
    const el = scrollerRef.current;
    if (!el) return false;
    const left = weekScrollLeft(index, el.clientWidth);
    if (el.clientWidth <= 0) return false;
    if (behavior === "auto") el.scrollLeft = left;
    else el.scrollTo({ left, behavior });
    return true;
  }

  useLayoutEffect(() => {
    const index = Math.max(
      0,
      weeks.findIndex((week) => week.offset === focusOffset),
    );
    const placed = scrollToIndex(index, "auto");
    // The strip scrolls before paint, then the index matches the week on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(index);
    if (placed) setReady(true);
  }, [focusOffset, weeks]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = el.clientWidth;
      if (next === width && next > 0) return;
      width = next;
      const placed = scrollToIndex(indexRef.current, "auto");
      if (placed) setReady(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (jumpingToToday.current) return;
    const urlDay =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("day");
    const next = nextSelectedDay(
      urlDay
        ? { type: "url", dayParam: urlDay, known: knownDayParams(), fallback: initialSelected }
        : { type: "prop", dayParam: initialSelected },
    );
    applySelected(next);
  }, [initialSelected]);

  useEffect(() => {
    if (!ready) return;
    const week = weeksRef.current[activeIndex];
    if (!week) return;
    if (skipUrl.current) {
      skipUrl.current = false;
      jumpingToToday.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const jumping = jumpingToToday.current;
      const dayParam = nextSelectedDay({
        type: "snap",
        weekDays: week.days,
        previousDayParam: selectedDayRef.current,
        allDays: weeksRef.current.flatMap((item) => item.days),
        todayParam: todayParam(),
        jumpingToToday: jumping,
      });
      jumpingToToday.current = false;
      applySelected(dayParam);
      onWeekChangeRef.current?.({
        weekStart: week.weekStart,
        offset: week.offset,
        label: week.label,
        dayParam,
        preserveUrl: jumping,
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeIndex, ready]);

  useEffect(() => {
    const weekday = pendingFocus.current;
    if (!weekday) return;
    pendingFocus.current = null;
    const panel = scrollerRef.current?.querySelector(
      `[data-week-index="${activeIndex}"]`,
    );
    panel?.querySelector<HTMLElement>(`[data-week-chip="${weekday}"]`)?.focus();
  }, [activeIndex]);

  function rememberChipFocus() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const chip = active.closest("[data-week-chip]");
    if (chip instanceof HTMLElement && scrollerRef.current?.contains(chip)) {
      pendingFocus.current = chip.getAttribute("data-week-chip");
    }
  }

  function syncFromScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth <= 0) return;
    swap.noteScrollerScroll();
    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(weeks.length - 1, index));
    if (clamped !== indexRef.current) {
      rememberChipFocus();
      swap.setSource(null);
    }
    indexRef.current = clamped;
    setActiveIndex(clamped);
  }

  function goTo(index: number) {
    const next = Math.max(0, Math.min(weeks.length - 1, index));
    if (next !== indexRef.current) {
      rememberChipFocus();
      swap.setSource(null);
    }
    indexRef.current = next;
    setActiveIndex(next);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToIndex(next, reduce ? "auto" : "smooth");
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(indexRef.current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(indexRef.current + 1);
    }
  }

  const active = weeks[activeIndex] ?? weeks[0];
  const awayFromToday = (active?.offset ?? 0) !== 0;
  const legendDays = weeks.flatMap((week) => week.days);

  function jumpToday() {
    const today = todayParam();
    // Set today before the week scroll. The snap callback runs ~120ms later
    // and would otherwise copy the old weekday into this week (yesterday).
    if (today) {
      jumpingToToday.current = true;
      applySelected(nextSelectedDay({ type: "today", todayParam: today }));
    }
    const current = weeks.findIndex((week) => week.offset === 0);
    const target = current < 0 ? 0 : current;
    const staying = indexRef.current === target;
    goTo(target);
    if (staying) jumpingToToday.current = false;
    if (todayHref) router.push(todayHref);
  }

  if (!active) return null;

  return (
    <div data-week-carousel>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1">
        <button
          type="button"
          data-week-prev
          aria-label="Previous week"
          aria-controls={scrollerId}
          disabled={activeIndex <= 0}
          onClick={() => goTo(activeIndex - 1)}
          className="inline-flex h-11 w-11 items-center justify-center justify-self-start rounded-full border border-line bg-carbon text-foreground disabled:opacity-30"
        >
          <Chevron direction="left" />
        </button>
        <div className="min-w-0 text-center" aria-live="polite">
          <p data-week-label className="truncate font-display text-sm uppercase tracking-wide">
            {active.label}
          </p>
          <p data-week-range className="truncate text-xs text-muted">
            {active.rangeLabel}
          </p>
        </div>
        <button
          type="button"
          data-week-next
          aria-label="Next week"
          aria-controls={scrollerId}
          disabled={activeIndex >= weeks.length - 1}
          onClick={() => goTo(activeIndex + 1)}
          className="inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-full border border-line bg-carbon text-foreground disabled:opacity-30"
        >
          <Chevron direction="right" />
        </button>
      </div>
      {awayFromToday ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            data-testid="jump-today"
            aria-label="Jump to today"
            onClick={jumpToday}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-black"
          >
            Today
          </button>
        </div>
      ) : null}
      {selectedDay && logPastDayKeys.includes(selectedDay) ? (
        <div className="mt-2 flex justify-center">
          <LogPastWorkoutButton
            dayKey={selectedDay}
            entry="week"
            label={
              timeZone && selectedDay === dayKey(new Date(), timeZone) ? "Log a workout" : "Log a past workout"
            }
            compact
            timeZone={timeZone}
          />
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        id={scrollerId}
        data-week-scroller
        data-week-ready={ready ? "true" : undefined}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Training weeks. Left and right arrow keys change the week."
        onKeyDown={onKeyDown}
        onScroll={syncFromScroll}
      >
        {weeks.map((week, index) => (
          <div
            key={week.weekStart}
            data-week-panel={String(week.offset)}
            data-week-index={index}
            data-week-current={week.offset === 0 ? "true" : undefined}
            data-week-focus={week.offset === focusOffset ? "true" : undefined}
            role="group"
            aria-label={`${week.label}, ${week.rangeLabel}`}
            inert={index === activeIndex ? undefined : true}
          >
            <WeekChipList
              days={week.days}
              basePath={basePath}
              rearrange={Boolean(week.rearrange)}
              weekStart={week.weekStart}
              completedDays={completedDays}
              completedByDay={completedByDay}
              partialDays={partialDays}
              inProgressDay={inProgressDay}
              selectedDay={selectedDay}
              interactive={index === activeIndex}
              source={swap.source}
              pending={swap.pending}
              onPointerDown={swap.onPointerDown}
              onPointerMove={swap.onPointerMove}
              onPointerUp={swap.onPointerUp}
              onChipClick={swap.onChipClick}
              onContextMenu={swap.onContextMenu}
              lockChipNavigation={Boolean(onDayChange)}
              onSelectDay={(dayParam) => {
                const next = nextSelectedDay({ type: "chip", dayParam });
                applySelected(next);
                onDayChange?.(next);
              }}
            />
          </div>
        ))}
      </div>
      <WeekLegend days={legendDays} />
      <RearrangeChrome
        rearrange={Boolean(active.rearrange)}
        days={active.days}
        weekStart={active.weekStart}
        source={
          swap.source?.weekStart === active.weekStart ? swap.source.weekday : null
        }
        error={swap.error}
        pending={swap.pending}
        onCancel={() => swap.setSource(null)}
        onReset={swap.resetWeek}
      />
    </div>
  );
}

function SingleWeekStrip({
  days,
  basePath,
  rearrange,
  weekStart,
  completedDays,
  completedByDay,
  partialDays,
  inProgressDay,
}: {
  days: Item[];
  basePath: string;
  rearrange: boolean;
  weekStart?: string;
  completedDays: string[];
  completedByDay: Record<string, string[]>;
  partialDays: string[];
  inProgressDay?: string;
}) {
  const swap = useWeekSwap(weekStart);
  return (
    <div>
      <WeekChipList
        days={days}
        basePath={basePath}
        rearrange={rearrange}
        weekStart={weekStart}
        completedDays={completedDays}
        completedByDay={completedByDay}
        partialDays={partialDays}
        inProgressDay={inProgressDay}
        source={swap.source}
        pending={swap.pending}
        onPointerDown={swap.onPointerDown}
        onPointerMove={swap.onPointerMove}
        onPointerUp={swap.onPointerUp}
        onChipClick={swap.onChipClick}
        onContextMenu={swap.onContextMenu}
      />
      <WeekLegend days={days} />
      <RearrangeChrome
        rearrange={rearrange}
        days={days}
        weekStart={weekStart}
        source={
          swap.source?.weekStart === (weekStart ?? "") ? swap.source.weekday : null
        }
        error={swap.error}
        pending={swap.pending}
        onCancel={() => swap.setSource(null)}
        onReset={swap.resetWeek}
      />
    </div>
  );
}

export function WeekStrip({
  days,
  weeks,
  basePath = "/training",
  rearrange = false,
  weekStart,
  completedDays = [],
  completedByDay = {},
  partialDays = [],
  inProgressDay,
  focusOffset = 0,
  todayHref,
  swapWeekStart,
  onWeekChange,
  logPastDayKeys = [],
  timeZone,
  onDayChange,
}: {
  days: Item[];
  /** When set, Train and Calendar swipe across these weeks instead of one row. */
  weeks?: WeekCarouselWeek[];
  basePath?: string;
  /** Calendar only. Hold a day, then tap another day to swap that week. */
  rearrange?: boolean;
  /** Monday YYYY-MM-DD of the week on screen. Past weeks included. */
  weekStart?: string;
  /** Day params (YYYY-MM-DD) from `completedLocalDayKeys`. */
  completedDays?: string[];
  /** Program days completed on each civil day. Same rule, per session. */
  completedByDay?: Record<string, string[]>;
  /** Civil days with ticked work that does not finish the prescription. */
  partialDays?: string[];
  /** Civil day of the open draft. That chip gets an in-progress dot. */
  inProgressDay?: string;
  /** Week offset to center on load. 0 is the current week. */
  focusOffset?: number;
  /** Where the Today button goes when the selected day is not today. */
  todayHref?: string;
  /** Provider week. Swaps on this week keep the Move undo toast. */
  swapWeekStart?: string;
  /** Fired after the strip snaps to a week. Calendar passes this directly. Train uses context. */
  onWeekChange?: (week: WeekChange) => void;
  /** Civil days that can take a past workout. The strip button follows the selected chip. */
  logPastDayKeys?: string[];
  /** Member zone for the past-log day list, so the dialog's first paint matches the server. */
  timeZone?: string;
  /** Calendar chip tap. The strip keeps the link from loading a different day. */
  onDayChange?: (dayParam: string) => void;
}) {
  if (weeks && weeks.length > 0) {
    return (
      <WeekDayCarousel
        weeks={weeks}
        basePath={basePath}
        completedDays={completedDays}
        completedByDay={completedByDay}
        partialDays={partialDays}
        inProgressDay={inProgressDay}
        focusOffset={focusOffset}
        todayHref={todayHref}
        swapWeekStart={swapWeekStart ?? weekStart}
        onWeekChange={onWeekChange}
        logPastDayKeys={logPastDayKeys}
        timeZone={timeZone}
        onDayChange={onDayChange}
      />
    );
  }
  return (
    <SingleWeekStrip
      days={days}
      basePath={basePath}
      rearrange={rearrange}
      weekStart={weekStart}
      completedDays={completedDays}
      completedByDay={completedByDay}
      partialDays={partialDays}
      inProgressDay={inProgressDay}
    />
  );
}
