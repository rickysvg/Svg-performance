import Link from "next/link";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export type WeekChipActivity = {
  id: string;
  label: string;
};

const WORD_LABELS = new Set(["Off", "Rest", "Recover"]);
const LEGEND = ["Bag", "Lift", "Bike", "GPP"] as const;
const ICON_ACTIVITIES = new Set<string>(LEGEND);

/** Split a plan summary into chip activities. Rendering is icons, not letters. */
export function weekChipActivities(summary: string): WeekChipActivity[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];
  return trimmed
    .split("+")
    .filter((part) => part.length > 0)
    .map((part) => ({
      id: part,
      label: part,
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
          strokeWidth={1.55}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="4.1" cy="11.4" r="2.65" />
          <circle cx="11.9" cy="11.4" r="2.65" />
          <path d="M4.1 11.4 8.1 4.7h3.2M8.1 4.7 6.6 8.5" />
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
      className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
    >
      {LEGEND.map((id) => (
        <li
          key={id}
          className="inline-flex items-center gap-1 text-[11px] font-medium leading-none text-foreground"
        >
          <span
            aria-hidden
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${
              id === "Bag" ? "rounded-full bg-accent text-black" : "text-foreground"
            }`}
          >
            <ActivityIcon id={id} />
          </span>
          {id}
        </li>
      ))}
    </ul>
  );
}

export function WeekStrip({
  days,
  basePath = "/training",
}: {
  days: Item[];
  basePath?: string;
}) {
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
        return (
          <li key={day.weekday} className="min-w-0">
            <Link
              href={href}
              data-week-chip={day.short}
              aria-current={selected ? "date" : undefined}
              aria-label={`${day.weekday} ${day.dateLabel}, ${day.summary}`}
              className={`flex h-[5.5rem] w-full min-w-0 flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 text-center transition-colors ${
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
              {day.isToday && !selected ? (
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              ) : (
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0" />
              )}
            </Link>
          </li>
        );
      })}
      </ol>
      <WeekLegend />
    </div>
  );
}
