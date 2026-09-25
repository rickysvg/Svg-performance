import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

export function WeekStrip({ days }: { days: Item[] }) {
  return (
    <ol data-week-strip className="grid grid-cols-7 gap-1.5">
      {days.map((day) => (
        <li key={day.weekday}>
          <div
            data-week-chip={day.short}
            className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center ${
              day.isToday
                ? "bg-black text-white"
                : "border border-line bg-card text-foreground"
            }`}
          >
            <span
              className={`font-display text-[11px] font-semibold uppercase tracking-wide ${
                day.isToday ? "text-highlighter" : "text-muted"
              }`}
            >
              {day.short}
            </span>
            <span className="mt-1 text-[10px] font-medium leading-tight">
              {day.summary}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
