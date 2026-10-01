import Link from "next/link";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export type WeekChipActivity = {
  id: string;
  label: string;
  mark: string;
};

const ACTIVITY_MARK: Record<string, string> = {
  Bag: "B",
  Lift: "L",
  Bike: "K",
  GPP: "G",
};

const WORD_LABELS = new Set(["Off", "Rest", "Recover"]);

/** Day chips show a date plus compact activity marks, not tiny stacked Bag+Lift text. */
export function weekChipActivities(summary: string): WeekChipActivity[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];
  return trimmed
    .split("+")
    .filter((part) => part.length > 0)
    .map((part) => ({
      id: part,
      label: part,
      mark: ACTIVITY_MARK[part] ?? part.slice(0, 1),
    }));
}

function markClass(id: string, selected: boolean) {
  if (id === "Bag") return "bg-accent text-black";
  if (selected) return "bg-white text-black";
  return "bg-black text-white";
}

export function WeekStrip({
  days,
  basePath = "/training",
}: {
  days: Item[];
  basePath?: string;
}) {
  return (
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
              className={`flex h-[5.5rem] w-full flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 text-center transition-colors ${
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
                <span
                  data-week-chip-label
                  className="mt-1 flex h-4 items-center justify-center gap-0.5"
                >
                  {activities.map((activity) => (
                    <span
                      key={`${day.weekday}-${activity.id}`}
                      title={activity.label}
                      className={`font-display inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none ${markClass(activity.id, selected)}`}
                    >
                      <span className="sr-only">{activity.label}</span>
                      <span aria-hidden>{activity.mark}</span>
                    </span>
                  ))}
                </span>
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
  );
}
