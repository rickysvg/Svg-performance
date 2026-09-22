import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import type { getTodayGuide } from "@/lib/today";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

export function TodayGuide({ guide }: { guide: Guide }) {
  const { today, path, lesson, checkIn } = guide;
  const workoutHref = today.loggedOnSelected
    ? `/training/log/${today.loggedOnSelected.id}`
    : today.draft
      ? `/training/log/${today.draft.id}`
      : today.suggestedDay
        ? `/training/${today.suggestedDay.id}`
        : "/training";
  const workoutTitle = today.loggedOnSelected
    ? today.loggedOnSelected.title
    : today.draft
      ? today.draft.title
      : today.suggestedDay
        ? today.suggestedDay.title
        : "No DEMO day loaded";
  const workoutCta = today.loggedOnSelected
    ? "Review or correct"
    : today.draft
      ? "Continue draft"
      : "Open today’s DEMO session";

  return (
    <section className="space-y-4 rounded-2xl border border-accent/40 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Today</p>
          <h2 className="mt-1 text-xl font-semibold">{guide.priority.headline}</h2>
          <p className="mt-2 text-sm text-muted">{guide.priority.body}</p>
        </div>
        <DemoBadge />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <dt className="text-xs uppercase text-muted">Current goal</dt>
          <dd className="mt-1 text-sm font-semibold">{guide.goal}</dd>
          {!guide.hasGoal ? (
            <Link href="/profile" className="mt-2 inline-block text-xs text-accent underline">
              Add a goal
            </Link>
          ) : null}
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-xs uppercase text-muted">Training path</dt>
          <dd className="mt-1 text-sm font-semibold">{path.path.title}</dd>
          <p className="mt-1 text-xs text-muted">
            {path.nextStep
              ? `Next: ${path.nextStep.title} · ${path.completedCount}/${path.totalSteps}`
              : `Milestones complete · ${path.completedCount}/${path.totalSteps}`}
          </p>
          <Link href={`/paths/${path.path.slug}`} className="mt-2 inline-block text-xs text-accent underline">
            Open path
          </Link>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-xs uppercase text-muted">Next workout</dt>
          <dd className="mt-1 text-sm font-semibold">{workoutTitle}</dd>
          <p className="mt-1 text-xs text-muted">
            {today.loggedOnSelected
              ? "Already logged this day."
              : today.suggestionCopy || "DEMO template — not custom Elite coaching."}
          </p>
          {today.sessionHint ? <p className="mt-1 text-xs text-muted">{today.sessionHint}</p> : null}
          {today.locationHint ? <p className="mt-1 text-xs text-muted">{today.locationHint}</p> : null}
          {today.competitionNote ? (
            <p className="mt-1 text-xs text-muted">{today.competitionNote}</p>
          ) : null}
          <Link
            href={workoutHref}
            className="touch-target mt-3 inline-flex items-center rounded-full bg-accent px-4 text-sm font-semibold text-black"
          >
            {workoutCta}
          </Link>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-xs uppercase text-muted">Recommended tutorial</dt>
          <dd className="mt-1 text-sm font-semibold">
            {lesson ? lesson.title : "No unfinished published lesson right now."}
          </dd>
          {lesson ? (
            <>
              <p className="mt-1 text-xs text-muted">
                {lesson.skillLevel} · {lesson.topic} · filtered from your intake
              </p>
              <Link href={`/learn/${lesson.slug}`} className="mt-2 inline-block text-xs text-accent underline">
                Open tutorial
              </Link>
            </>
          ) : (
            <Link href="/learn" className="mt-2 inline-block text-xs text-accent underline">
              Browse Learn
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-line p-3 sm:col-span-2">
          <dt className="text-xs uppercase text-muted">Next check-in</dt>
          <dd className="mt-1 text-sm font-semibold">{checkIn.title}</dd>
          <p className="mt-1 text-xs text-muted">{checkIn.body}</p>
          <Link href={checkIn.href} className="mt-2 inline-block text-xs text-accent underline">
            {checkIn.kind === "empty" ? "Book with Ricky" : "Open Book / request"}
          </Link>
        </div>
      </dl>
    </section>
  );
}
