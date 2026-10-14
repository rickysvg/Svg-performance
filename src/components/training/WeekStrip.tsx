"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  resetCalendarWeekAction,
  swapCalendarDaysAction,
} from "@/app/actions/week-plan";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export type WeekChipActivity = {
  id: string;
  label: string;
};

const WORD_LABELS = new Set(["Off", "Rest", "Recover"]);
const LEGEND = ["Bag", "Lift", "Bike", "GPP"] as const;
const ICON_ACTIVITIES = new Set<string>(LEGEND);

/** Spoken and legend names. Plan summaries stay Bag+GPP. */
const ACTIVITY_NAME: Record<string, string> = {
  GPP: "GPP · conditioning",
};

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
      id: part,
      label: activityChipName(part),
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
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="3.55" cy="11.55" r="2.5" />
          <circle cx="12.45" cy="11.55" r="2.5" />
          {/* One path. Both ends land on a wheel so the saddle, bars, and frame stay attached at chip size. */}
          <path d="M5.15 9.6 6.3 5.35 5.05 3.6h2.5L6.3 5.35h3.45l1.15-1.75h2.2L10.9 5.35 10.9 9.6" />
        </svg>
      );
    case "GPP":
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
          className={`inline-flex aspect-square min-w-0 items-center justify-center ${
            activity.id === "Bag"
              ? "rounded-full bg-accent text-black"
              : selected
                ? "text-white"
                : "text-foreground"
          }`}
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

function WeekLegend() {
  return (
    <ul
      data-week-legend
      aria-label="Activity key"
      className="mt-2 flex flex-nowrap items-center justify-center gap-x-2.5 gap-y-1"
    >
      {LEGEND.map((id) => (
        <li
          key={id}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none text-foreground"
        >
          <span
            aria-hidden
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${
              id === "Bag" ? "rounded-full bg-accent text-black" : "text-foreground"
            }`}
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

export function WeekStrip({
  days,
  basePath = "/training",
  rearrange = false,
  weekStart,
  completedDays = [],
}: {
  days: Item[];
  basePath?: string;
  /** Calendar only. Hold a day, then tap another day to swap that week. */
  rearrange?: boolean;
  /** Monday YYYY-MM-DD of the week on screen. Past weeks included. */
  weekStart?: string;
  /** Day params (YYYY-MM-DD) that already have a logged workout. */
  completedDays?: string[];
}) {
  const router = useRouter();
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClick = useRef(false);

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

  function armHold(weekday: string) {
    if (!rearrange || pending) return;
    // A new press should not keep a swallowed click from the previous hold.
    ignoreClick.current = false;
    disarmHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      ignoreClick.current = true;
      setSource(weekday);
      setError(null);
    }, HOLD_MS);
  }

  function commitSwap(from: string, to: string) {
    setError(null);
    startTransition(async () => {
      const result = await swapCalendarDaysAction(from, to, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSource(null);
      router.refresh();
    });
  }

  function resetWeek() {
    setError(null);
    startTransition(async () => {
      const result = await resetCalendarWeekAction(weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSource(null);
      router.refresh();
    });
  }

  function onChipClick(event: { preventDefault: () => void }, weekday: string) {
    if (!rearrange) return;
    if (ignoreClick.current) {
      event.preventDefault();
      ignoreClick.current = false;
      return;
    }
    if (!source) return;
    event.preventDefault();
    if (pending) return;
    if (source === weekday) {
      setSource(null);
      return;
    }
    commitSwap(source, weekday);
  }

  const moving = days.find((day) => day.weekday === source);
  const moved = days.filter((day) => day.movedFrom);

  return (
    <div>
      <ol data-week-strip className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const href = `${basePath}?day=${day.dayParam}`;
        const selected = day.isSelected;
        const activities = weekChipActivities(day.summary);
        const word =
          activities.length === 1 && WORD_LABELS.has(activities[0]!.id)
            ? activities[0]!.label
            : null;
        const held = source === day.weekday;
        const logged = completedDays.includes(day.dayParam);
        const missed = day.isPast && day.active && !logged;
        const movedLabel = day.movedFrom
          ? `, showing ${day.movedFrom}’s workout`
          : "";
        const historyLabel = logged ? ", logged" : missed ? ", missed" : "";
        const label = source
          ? held
            ? `${day.weekday}, selected to move. Tap another day to swap.`
            : `Swap ${source} with ${day.weekday}`
          : `${day.weekday} ${day.dateLabel}, ${spokenSummary(day.summary)}${movedLabel}${historyLabel}`;
        return (
          <li key={day.weekday} className="min-w-0">
            <Link
              href={href}
              data-week-chip={day.short}
              data-moved-from={day.movedFrom || undefined}
              data-move-source={held ? "true" : undefined}
              data-week-past={day.isPast ? "true" : undefined}
              data-week-missed={missed ? "true" : undefined}
              aria-current={selected ? "date" : undefined}
              aria-pressed={rearrange ? held : undefined}
              aria-label={label}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                armHold(day.weekday);
              }}
              onPointerUp={disarmHold}
              style={rearrange ? { WebkitTouchCallout: "none" } : undefined}
              onContextMenu={(event) => {
                if (!rearrange || pending) return;
                event.preventDefault();
                ignoreClick.current = true;
                setSource(day.weekday);
                setError(null);
              }}
              onClick={(event) => onChipClick(event, day.weekday)}
              className={`flex h-[5.5rem] w-full min-w-0 flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 text-center transition-colors ${
                rearrange ? "touch-manipulation select-none" : ""
              } ${
                held || day.movedFrom ? "ring-2 ring-inset ring-accent" : ""
              } ${
                selected
                  ? "bg-black text-white"
                  : "border border-line bg-card text-foreground hover:border-black/40"
              }`}
            >
              <span
                className={`font-display text-[11px] uppercase leading-none tracking-wide ${
                  selected ? "text-highlighter" : "text-muted"
                }`}
              >
                {day.short}
              </span>
              <span
                data-week-chip-date
                className={`font-display mt-1 text-base leading-none ${
                  selected ? "text-white" : "text-foreground"
                }`}
              >
                {day.dateLabel}
              </span>
              {word ? (
                <span
                  data-week-chip-label
                  className={`mt-1 text-[11px] font-medium leading-none ${
                    selected ? "text-white" : "text-foreground"
                  }`}
                >
                  {word}
                </span>
              ) : (
                <ActivityMarks activities={activities} selected={selected} />
              )}
              {logged ? (
                <span
                  data-week-complete
                  className="mt-1 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-accent text-black"
                  aria-hidden
                >
                  <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M2.2 6.2 4.8 8.6 9.8 3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : day.isToday && !selected ? (
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              ) : missed ? (
                <span
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full border border-foreground/40"
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
      <WeekLegend />
      {rearrange && source ? (
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
            type="button"
            onClick={() => setSource(null)}
            disabled={pending}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Cancel"}
          </button>
        </div>
      ) : null}
      {rearrange && !source && moved.length > 0 ? (
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
              type="button"
              onClick={resetWeek}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {pending ? "Saving…" : "Back to the default week"}
            </button>
          </div>
          <p className="mt-2 text-sm text-white/70">Hold a day to swap again.</p>
        </div>
      ) : null}
      {rearrange && !source && moved.length === 0 ? (
        <p data-move-hint className="mt-3 text-sm text-muted">
          Hold a day — including a missed day — to swap it with another day.
        </p>
      ) : null}
      {rearrange && !source && moved.length === 0 && error ? (
        <p className="mt-2 text-sm text-muted">{error}</p>
      ) : null}
    </div>
  );
}
