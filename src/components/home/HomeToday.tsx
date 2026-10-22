import Link from "next/link";
import { bikeLoggerHref } from "@/lib/timer-session";
import { sessionMatchesPlannedDay } from "@/lib/workouts";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import type { getTodayGuide } from "@/lib/today";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

export function HomeToday({ guide, locked = false }: { guide: Guide; locked?: boolean }) {
  const planned = (guide.today.plannedSessions ?? []).filter((session) => session.kind !== "rest");
  const first = planned[0];
  const extra = Math.max(0, planned.length - 1);
  const next = guide.today.nextSession;
  const draft = guide.today.draft;
  const draftIsFirst = Boolean(
    draft &&
      first?.dayId &&
      draft.programDayId === first.dayId &&
      (!first.day || sessionMatchesPlannedDay(draft, first.day)),
  );
  const firstDone = Boolean(first?.dayId && guide.today.completedDayIds?.includes(first.dayId));
  const nextDone = Boolean(next?.dayId && guide.today.completedDayIds?.includes(next.dayId));

  if (!first) {
    return (
      <section className="hc-panel hc-carbon px-5 py-5">
        <p className="hc-kicker">Today</p>
        <h2 className="mt-2 text-2xl">Rest day</h2>
        <p className="mt-1 text-sm text-muted">
          {guide.today.nextSessionWeekday
            ? `Next session: ${guide.today.nextSessionWeekday}.`
            : "Recover today."}
        </p>
        {locked ? (
          <a
            href="#trial-ended"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Subscribe
          </a>
        ) : draft ? (
          <Link
            href={`/training/log/${draft.id}`}
            data-prime-coach-audio
            data-resume-workout
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Resume
          </Link>
        ) : nextDone ? (
          <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
            Done
          </p>
        ) : next?.dayId ? (
          <Link
            href={next.startHref ?? next.logHref ?? bikeLoggerHref(next.dayId)}
            prefetch={false}
            data-testid="home-prime-coach-audio"
            data-prime-coach-audio
            data-open-bike-logger={next.logHref ? "home" : undefined}
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Start next session
          </Link>
        ) : next?.href ? (
          <Link
            href={next.href}
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Start next session
          </Link>
        ) : (
          <Link
            href="/training"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Open Train
          </Link>
        )}
      </section>
    );
  }

  const minutes = first.day ? estimateSessionMinutes(first.day.exercises) : 0;
  const count = first.day?.exercises.length ?? 0;

  return (
    <section className="hc-panel hc-carbon px-5 py-5">
      <p className="hc-kicker">
        Today
        {minutes > 0 ? ` · ${minutes} min` : ""}
      </p>
      <h2 className="mt-2 text-2xl leading-tight">{first.title}</h2>
      <p className="mt-1 text-sm text-muted">
        {count > 0 ? exerciseCountLabel(count) : first.label}
        {extra > 0 ? ` · ${extra} more today` : ""}
      </p>
      {locked ? (
        <a
          href="#trial-ended"
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Subscribe
        </a>
      ) : firstDone ? (
        <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
          Done
        </p>
      ) : draftIsFirst && draft ? (
        <Link
          href={`/training/log/${draft.id}`}
          data-prime-coach-audio
          data-resume-workout
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Resume
        </Link>
      ) : first.dayId ? (
        <Link
          href={first.startHref ?? first.logHref ?? bikeLoggerHref(first.dayId)}
          prefetch={false}
          data-testid="home-prime-coach-audio-2"
          data-prime-coach-audio
          data-open-bike-logger={first.logHref ? "home" : undefined}
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Start
        </Link>
      ) : first.href ? (
        <Link
          href={first.href}
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Start
        </Link>
      ) : (
        <Link
          href="/training"
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Open Train
        </Link>
      )}
      {draft && !draftIsFirst ? (
        <Link
          href={`/training/log/${draft.id}`}
          data-prime-coach-audio
          data-resume-workout
          className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
        >
          Resume
        </Link>
      ) : null}
      {extra > 0 ? (
        <Link href="/training" className="mt-3 block text-sm text-muted" data-more-today={extra}>
          See the rest of today
        </Link>
      ) : null}
    </section>
  );
}
