import Link from "next/link";
import { weekSessionTally, type CalendarActivity, type CalendarDay } from "@/lib/calendar";
import { HoldToMove, WorkoutMoveButton } from "@/components/training/WorkoutMove";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";

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
  const movable = Boolean(
    activity.kind === "workout" &&
      activity.sessionKey &&
      activity.weekday &&
      activity.status !== "complete",
  );
  const card = (
    <div
      data-status={activity.status}
      data-session-key={activity.sessionKey}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card py-3.5 pr-3 pl-4 shadow-sm"
    >
      <Link href={activity.href} className="flex min-w-0 flex-1 items-center gap-3">
        <StatusCircle kind={activity.kind} status={activity.status} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-semibold leading-snug">{activity.title}</span>
            {activity.status === "complete" ? (
              <span className="font-display shrink-0 text-[11px] uppercase tracking-wide text-accent">
                Done
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-muted">{activity.subtitle}</span>
        </span>
        <span className="text-lg text-muted" aria-hidden>
          ›
        </span>
      </Link>
      {movable ? (
        <WorkoutMoveButton
          sessionKey={activity.sessionKey!}
          fromWeekday={activity.weekday!}
          title={activity.title}
          heavy={Boolean(activity.heavy)}
        />
      ) : null}
    </div>
  );
  if (!movable || !activity.sessionKey || !activity.weekday) return card;
  return (
    <HoldToMove
      sessionKey={activity.sessionKey}
      fromWeekday={activity.weekday}
      title={activity.title}
      heavy={Boolean(activity.heavy)}
    >
      {card}
    </HoldToMove>
  );
}

export function CalendarList({
  days,
  coachName,
  coachImage,
}: {
  days: CalendarDay[];
  coachName?: string;
  coachImage?: string;
}) {
  const tally = weekSessionTally(days);
  return (
    <div className="space-y-4">
      {tally.total > 0 ? (
        <div>
          <p data-week-session-progress className="text-sm font-semibold">
            This week: {tally.done} of {tally.total} sessions done
          </p>
          <p data-week-flexible className="mt-1 text-sm text-muted">
            Workouts are interchangeable through the week.
          </p>
        </div>
      ) : null}
    <ol className="space-y-6">
      {days.map((day) => (
        <li key={day.heading} data-calendar-day={day.heading} className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm text-foreground">
            {day.isToday ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
            ) : null}
            {day.heading}
          </h2>
          {day.easeNote || day.coachCheckIn ? (
            <RecoveryNotice
              note={day.easeNote}
              coachName={day.coachCheckIn?.name}
              coachImage={day.coachCheckIn?.image}
              message={day.coachCheckIn?.message}
            />
          ) : null}
          {day.sparring ? (
            <SparringLogForm
              dateKey={day.sparring.dateKey}
              weekday={day.sparring.weekday}
              timeLabel={day.sparring.timeLabel}
              saved={day.sparring.saved}
              coachName={coachName}
              coachImage={coachImage}
            />
          ) : null}
          {day.activities.length > 0 ? (
            <ul className="space-y-2">
              {day.activities.map((activity) => (
                <li key={`${activity.kind}-${activity.href}-${activity.title}`}>
                  <ActivityCard activity={activity} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-px bg-line" />
          )}
        </li>
      ))}
    </ol>
    </div>
  );
}
