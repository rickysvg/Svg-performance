import Link from "next/link";
import type { getTodayGuide } from "@/lib/today";
import {
  estimateSessionMinutes,
  exerciseCountLabel,
  sessionKindLabel,
} from "@/lib/exercise-media";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

export function TodayGuide({ guide }: { guide: Guide }) {
  const { today } = guide;
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
    ? "Review session"
    : today.draft
      ? "Continue"
      : "Open workout";
  const day = today.suggestedDay;
  const minutes = day ? estimateSessionMinutes(day.exercises) : 0;
  const kind = day ? sessionKindLabel({ title: day.title, focus: day.focus }) : "Strength";
  const count = day?.exercises.length ?? 0;

  return (
    <section className="rounded-2xl border border-line bg-card px-5 py-6">
      <p className="text-xs uppercase tracking-wide text-muted">Today’s workout</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{workoutTitle}</h2>
      {day ? (
        <p className="mt-2 text-sm text-muted">
          {kind} · est. {minutes} min · {exerciseCountLabel(count)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">{today.suggestionCopy}</p>
      )}
      {today.loggedOnSelected ? (
        <p className="mt-2 text-sm text-muted">Already logged this day.</p>
      ) : null}
      <Link
        href={workoutHref}
        className="touch-target mt-5 inline-flex items-center rounded-full bg-accent px-5 text-sm font-semibold text-black"
      >
        {workoutCta}
      </Link>
    </section>
  );
}
