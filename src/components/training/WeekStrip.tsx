import Link from "next/link";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export function WeekStrip({ days, selected }: { days: Item[]; selected?: string }) {
  return (
    <ol data-week-strip className="grid grid-cols-7 gap-1.5">
      {days.map((day) => (
        <li key={day.weekday}>
          <Link
            href={`/training?weekday=${day.weekday}`}
            data-week-chip={day.short}
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-2xl px-1 py-2 text-center ${
              day.weekday === selected || (day.isToday && !selected)
                ? "bg-black text-white"
                : "border border-line bg-card text-foreground"
            }`}
          >
            <span
              className={`font-display text-[11px] uppercase ${
                day.weekday === selected || (day.isToday && !selected) ? "text-highlighter" : "text-muted"
              }`}
            >
              {day.short}
            </span>
            <span className="mt-1 text-[11px] font-medium leading-tight">
              {day.summary}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
