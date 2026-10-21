import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { StartSubmit } from "@/components/training/StartTodayButton";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import { isBikeTimerHref } from "@/lib/timer-session";
import type { getTodayGuide } from "@/lib/today";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

export function HomeToday({ guide, locked = false }: { guide: Guide; locked?: boolean }) {
  const planned = (guide.today.plannedSessions ?? []).filter((session) => session.kind !== "rest");
  const first = planned[0];
  const extra = Math.max(0, planned.length - 1);
  const next = guide.today.nextSession;
  const draft = guide.today.draft;
  const draftIsFirst = Boolean(draft && first && draft.programDayId === first.dayId);

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
        ) : next?.href && isBikeTimerHref(next.href) ? (
          <Link
            href={next.href}
            data-open-bike-clock
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Start next session
          </Link>
        ) : next?.dayId ? (
          <form action={startSessionAction} data-prime-coach-audio className="mt-4">
            <input type="hidden" name="programDayId" value={next.dayId} />
            <StartSubmit
              label="Start next session"
              className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
            />
          </form>
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
  const bikeHref = isBikeTimerHref(first.href) ? first.href : null;

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
      ) : draftIsFirst && draft ? (
        <Link
          href={`/training/log/${draft.id}`}
          data-prime-coach-audio
          data-resume-workout
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Resume
        </Link>
      ) : bikeHref ? (
        <Link
          href={bikeHref}
          data-open-bike-clock
          data-prime-coach-audio
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Start
        </Link>
      ) : first.dayId ? (
        <form action={startSessionAction} data-prime-coach-audio className="mt-4">
          <input type="hidden" name="programDayId" value={first.dayId} />
          <StartSubmit
            label="Start"
            className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          />
        </form>
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
