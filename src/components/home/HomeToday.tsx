import Link from "next/link";
import { CUSTOM_HOME_RESUME } from "@/lib/today-start";
import { bikeLoggerHref } from "@/lib/timer-session";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
import type { getTodayGuide } from "@/lib/today";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

const resumeClass =
  "touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black";

function ResumeButton({
  log,
  className,
}: {
  log: { id: string; partial: boolean };
  className: string;
}) {
  if (log.partial) {
    return <ContinueWorkoutButton workoutId={log.id} label="Resume" className={className} />;
  }
  return (
    <Link
      href={`/training/log/${log.id}`}
      data-prime-coach-audio
      data-resume-workout
      className={className}
    >
      Resume
    </Link>
  );
}

export function HomeToday({ guide, locked = false }: { guide: Guide; locked?: boolean }) {
  const planned = (guide.today.plannedSessions ?? []).filter((session) => session.kind !== "rest");
  const first = planned[0];
  const extra = Math.max(0, planned.length - 1);
  const next = guide.today.nextSession;
  const resume = first?.dayId ? guide.today.resumeByDay?.[first.dayId] : undefined;
  const customResume = guide.today.resumeByDay?.[CUSTOM_HOME_RESUME];
  const otherResume = Object.entries(guide.today.resumeByDay ?? {}).find(
    ([dayId]) =>
      dayId !== first?.dayId &&
      dayId !== CUSTOM_HOME_RESUME &&
      !guide.today.completedDayIds?.includes(dayId),
  )?.[1];
  const firstDone = Boolean(first?.dayId && guide.today.completedDayIds?.includes(first.dayId));
  const nextDone = Boolean(next?.dayId && guide.today.completedDayIds?.includes(next.dayId));
  const firstPartial = Boolean(
    first?.dayId && !firstDone && guide.today.partialDayIds?.includes(first.dayId),
  );
  const nextPartial = Boolean(
    next?.dayId && !nextDone && guide.today.partialDayIds?.includes(next.dayId),
  );

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
          <>
            <a
              href="#trial-ended"
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
            >
              Subscribe
            </a>
            {!nextDone && (nextPartial || customResume?.partial || otherResume?.partial) ? (
              <p data-session-partial className="mt-4 font-display text-xs uppercase tracking-wide text-[#FF3B3B]">
                Partial
              </p>
            ) : nextDone ? (
              <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
                Done
              </p>
            ) : null}
            {customResume ? (
              <ResumeButton log={customResume} className={resumeClass} />
            ) : otherResume ? (
              <ResumeButton log={otherResume} className={resumeClass} />
            ) : null}
            {customResume && otherResume ? (
              <ResumeButton
                log={otherResume}
                className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
              />
            ) : null}
          </>
        ) : (
          <>
            {!nextDone && (nextPartial || customResume?.partial || otherResume?.partial) ? (
              <p data-session-partial className="mt-4 font-display text-xs uppercase tracking-wide text-[#FF3B3B]">
                Partial
              </p>
            ) : null}
            {customResume ? (
              <>
                <ResumeButton log={customResume} className={resumeClass} />
                {otherResume ? (
                  <ResumeButton
                    log={otherResume}
                    className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
                  />
                ) : null}
              </>
            ) : otherResume ? (
              <ResumeButton log={otherResume} className={resumeClass} />
            ) : nextDone ? (
              <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
                Done
              </p>
            ) : nextPartial ? null : next?.dayId ? (
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
          </>
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
        <>
          <a
            href="#trial-ended"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
          >
            Subscribe
          </a>
          {firstDone ? (
            <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
              Done
            </p>
          ) : firstPartial || resume?.partial ? (
            <p data-session-partial className="mt-4 font-display text-xs uppercase tracking-wide text-[#FF3B3B]">
              Partial
            </p>
          ) : null}
          {resume ? <ResumeButton log={resume} className={resumeClass} /> : null}
          {customResume && customResume.id !== resume?.id ? (
            <ResumeButton
              log={customResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {otherResume && otherResume.id !== customResume?.id ? (
            <ResumeButton
              log={otherResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {extra > 0 || customResume || otherResume ? (
            <Link href="/training" className="mt-3 block text-sm text-muted" data-more-today={Math.max(extra, 1)}>
              See the rest of today
            </Link>
          ) : null}
        </>
      ) : firstDone ? (
        <>
          <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
            Done
          </p>
          {customResume && customResume.id !== resume?.id ? (
            <ResumeButton
              log={customResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {otherResume && otherResume.id !== customResume?.id ? (
            <ResumeButton
              log={otherResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {extra > 0 || customResume || otherResume ? (
            <Link href="/training" className="mt-3 block text-sm text-muted" data-more-today={Math.max(extra, 1)}>
              See the rest of today
            </Link>
          ) : null}
        </>
      ) : (
        <>
          {firstPartial || resume?.partial ? (
            <p data-session-partial className="mt-4 font-display text-xs uppercase tracking-wide text-[#FF3B3B]">
              Partial
            </p>
          ) : null}
          {resume ? (
            <ResumeButton log={resume} className={resumeClass} />
          ) : firstPartial ? null : first.dayId ? (
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
          {customResume && customResume.id !== resume?.id ? (
            <ResumeButton
              log={customResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {otherResume && otherResume.id !== customResume?.id ? (
            <ResumeButton
              log={otherResume}
              className="touch-target mt-3 inline-flex items-center rounded-full border border-line px-5 text-sm"
            />
          ) : null}
          {extra > 0 || customResume || otherResume ? (
            <Link href="/training" className="mt-3 block text-sm text-muted" data-more-today={Math.max(extra, 1)}>
              See the rest of today
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
