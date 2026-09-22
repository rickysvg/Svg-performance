import Link from "next/link";
import type { CalendarActivity, CalendarDay } from "@/lib/calendar";

function StatusCircle({
  kind,
  status,
}: {
  kind: CalendarActivity["kind"];
  status: CalendarActivity["status"];
}) {
  const complete = status === "complete";
  const ring =
    kind === "workout"
      ? complete
        ? "border-accent bg-accent"
        : "border-muted bg-transparent"
      : complete
        ? "border-accent bg-accent/30"
        : "border-accent bg-transparent";

  return (
    <span
      className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${ring}`}
      aria-hidden
    />
  );
}

function ActivityCard({ activity }: { activity: CalendarActivity }) {
  return (
    <Link
      href={activity.href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-sm hover:border-accent/50"
    >
      <StatusCircle kind={activity.kind} status={activity.status} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{activity.title}</span>
        <span className="mt-0.5 block text-sm text-muted">{activity.subtitle}</span>
      </span>
      <span className="text-lg text-muted" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function CalendarList({ days }: { days: CalendarDay[] }) {
  return (
    <ol className="space-y-6">
      {days.map((day) => (
        <li key={day.heading} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            {day.isToday ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
            ) : null}
            {day.heading}
          </h2>
          {day.activities.length > 0 ? (
            <ul className="space-y-2">
              {day.activities.map((activity) => (
                <li key={`${activity.kind}-${activity.href}-${activity.title}`}>
                  <ActivityCard activity={activity} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-b border-line/70" />
          )}
        </li>
      ))}
    </ol>
  );
}
