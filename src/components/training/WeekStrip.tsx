import Link from "next/link";
import type { weekStrip } from "@/lib/week-plan";

type Item = ReturnType<typeof weekStrip>[number];

/**
 * Fit week-chip summaries inside equal-width mobile chips.
 * Stack on “+” so labels stay inside the chip with no overflow/clipping;
 * workout data / ?day= behavior is unchanged.
 */
export function weekChipLabelLines(summary: string): string[] {
  const trimmed = summary.trim();
  if (!trimmed) return [""];
  const parts = trimmed.split("+").filter((part) => part.length > 0);
  if (parts.length >= 3) {
    return [parts.slice(0, -1).join("+"), `+${parts[parts.length - 1]}`];
  }
  if (parts.length === 2) {
    return [parts[0]!, `+${parts[1]!}`];
  }
  return [trimmed];
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
        const lines = weekChipLabelLines(day.summary);
        return (
          <li key={day.weekday} className="min-w-0">
            <Link
              href={href}
              data-week-chip={day.short}
              aria-current={selected ? "date" : undefined}
              className={`flex h-[4.75rem] w-full flex-col items-center justify-center rounded-2xl px-0.5 py-1.5 text-center transition-colors ${
                selected
                  ? "bg-black text-white"
                  : "border border-line bg-card text-foreground hover:border-black/40"
              }`}
            >
              <span
                className={`font-display text-[10px] uppercase leading-none tracking-wide ${
                  selected ? "text-highlighter" : "text-muted"
                }`}
              >
                {day.short}
              </span>
              <span
                data-week-chip-label
                className={`mt-1 flex h-[1.75rem] w-full flex-col items-center justify-center text-[9px] font-medium leading-[1.1] ${
                  selected ? "text-white" : "text-foreground"
                }`}
              >
                {lines.map((line) => (
                  <span key={`${day.weekday}-${line}`} className="block max-w-full px-0.5">
                    {line}
                  </span>
                ))}
              </span>
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
