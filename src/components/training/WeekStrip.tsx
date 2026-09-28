import Link from "next/link";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export function WeekStrip({
  days,
  basePath = "/training",
}: {
  days: Item[];
  basePath?: string;
}) {
  return (
    <ol data-week-strip className="grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const href = `${basePath}?day=${day.dayParam}`;
        const selected = day.isSelected;
        return (
          <li key={day.weekday}>
            <Link
              href={href}
              data-week-chip={day.short}
              aria-current={selected ? "date" : undefined}
              className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center transition-colors ${
                selected
                  ? "bg-black text-white"
                  : "border border-line bg-card text-foreground hover:border-black/40"
              }`}
            >
              <span
                className={`font-display text-[11px] uppercase ${
                  selected ? "text-highlighter" : "text-muted"
                }`}
              >
                {day.short}
              </span>
              <span className="mt-1 text-[10px] font-medium leading-tight">
                {day.summary}
              </span>
              {day.isToday && !selected ? (
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              ) : (
                <span className="mt-1 inline-block h-1.5 w-1.5" />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
