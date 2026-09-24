import Link from "next/link";
import { formatDayParam, sameLocalDay, weekStripDays } from "@/lib/home";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekStrip({ selected }: { selected: Date }) {
  const days = weekStripDays(selected);
  const today = new Date();
  const monthLabel = selected.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{monthLabel}</p>
        <div className="flex items-center gap-3">
          <Link href="/training/calendar" className="text-sm text-accent underline">
            Calendar
          </Link>
          {sameLocalDay(selected, today) ? (
            <span className="text-sm font-semibold text-accent">Today</span>
          ) : (
            <Link href="/home" className="text-sm text-accent underline">
              Jump to today
            </Link>
          )}
        </div>
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {days.map((day, index) => {
          const active = sameLocalDay(day, selected);
          const isToday = sameLocalDay(day, today);
          const href = `/home?day=${formatDayParam(day)}`;
          return (
            <Link
              key={href}
              href={href}
              className={`min-w-[3.1rem] flex-1 rounded-2xl px-2 py-2 text-center ${
                active
                  ? "border border-accent bg-accent/15 text-accent"
                  : "border border-transparent text-muted hover:border-line"
              }`}
            >
              <span className="stat-display block text-lg font-semibold leading-none">
                {day.getDate()}
              </span>
              <span className="font-display mt-1 block text-[11px] uppercase tracking-wide">{WEEKDAY_SHORT[index]}</span>
              {isToday ? (
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              ) : (
                <span className="mt-1 inline-block h-1.5 w-1.5" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
