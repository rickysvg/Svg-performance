import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { StartSubmit } from "@/components/training/StartTodayButton";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import type { getTodayGuide } from "@/lib/today";

type Guide = Awaited<ReturnType<typeof getTodayGuide>>;

export function HomeToday({ guide, locked = false }: { guide: Guide; locked?: boolean }) {
  const planned = (guide.today.plannedSessions ?? []).filter((session) => session.href);
  const first = planned[0];
  const extra = planned.length - 1;
  const next = guide.today.nextSession;

  if (!first) {
    return (
      <section className="rounded-[1.75rem] bg-black px-5 py-5 text-white">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">Today</p>
        <h2 className="mt-2 text-2xl">Rest day</h2>
        <p className="mt-1 text-sm text-white/70">
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
  const draft = guide.today.draft && guide.today.draft.programDayId === first.dayId;

  return (
    <section className="rounded-[1.75rem] bg-black px-5 py-5 text-white">
      <p className="font-display text-xs uppercase tracking-[0.06em] text-highlighter">
        Today
        {minutes > 0 ? ` · ${minutes} min` : ""}
      </p>
      <h2 className="mt-2 text-2xl leading-tight">{first.title}</h2>
      <p className="mt-1 text-sm text-white/70">
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
      ) : draft ? (
        <Link
          href={`/training/log/${guide.today.draft?.id}`}
          data-prime-coach-audio
          className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Resume
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
      {extra > 0 ? (
        <Link href="/training" className="mt-3 block text-sm text-white/80">
          See the rest of today
        </Link>
      ) : null}
    </section>
  );
}
