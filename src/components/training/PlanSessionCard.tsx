import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { WatchFormInline } from "@/components/training/WatchForm";
import { lookupFormVideo } from "@/lib/form-videos";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import type { ResolvedPlanSession } from "@/lib/week-plan";

const KIND_LABEL: Record<ResolvedPlanSession["kind"], string> = {
  skill: "Skill",
  strength: "Strength",
  conditioning: "Conditioning",
  rest: "Rest",
  mobility: "Recovery",
};

type DayExercise = {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  formVideoUrl: string;
  formVideoPending: boolean;
};

export function PlanSessionCard({
  session,
  highlight,
  compact,
  draftId,
}: {
  session: ResolvedPlanSession;
  highlight?: boolean;
  compact?: boolean;
  draftId?: string;
}) {
  const kind = KIND_LABEL[session.kind];
  const exercises = (session.day?.exercises ?? []) as DayExercise[];
  const minutes = session.day ? estimateSessionMinutes(session.day.exercises) : 0;
  const count = exercises.length;
  const href = draftId ? `/training/log/${draftId}` : session.href;
  const cta = draftId ? "Continue" : session.href ? "Open session" : null;

  return (
    <article
      className={`rounded-2xl p-5 ${
        highlight
          ? "bg-black text-white"
          : "border border-line bg-card text-foreground"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          highlight ? "text-highlighter" : "text-accent"
        }`}
      >
        Session {session.slot} · {kind}
        {session.optional ? " · optional" : ""}
        {minutes > 0 ? ` · est. ${minutes} min` : ""}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-tight">{session.title}</h3>
      <p className={`mt-1 text-sm ${highlight ? "text-white/70" : "text-muted"}`}>
        {session.subtitle}
        {count > 0 ? ` · ${exerciseCountLabel(count)}` : ""}
      </p>
      {!compact && exercises.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm">
          {exercises.map((exercise, index) => {
            const form = lookupFormVideo(exercise.name, exercises);
            return (
              <li
                key={exercise.id ?? `${exercise.name}-${index}`}
                className={`flex items-center justify-between gap-3 border-b py-2 last:border-0 ${
                  highlight ? "border-white/15" : "border-line/60"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ExerciseThumb
                    name={exercise.name}
                    formVideoUrl={form.url}
                    formVideoPending={form.pending}
                    size={48}
                  />
                  <span>
                    <span className="font-medium">{exercise.name}</span>
                    <span className={`block ${highlight ? "text-white/60" : "text-muted"}`}>
                      {exercise.sets} × {exercise.reps} · {exercise.loadText}
                    </span>
                  </span>
                </span>
                <WatchFormInline url={form.url} pending={form.pending} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {href ? (
        <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={href}
            className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold ${
              highlight ? "bg-accent text-black" : "border border-line"
            }`}
          >
            {cta}
          </Link>
          {session.dayId && !draftId ? (
            <form action={startSessionAction}>
              <input type="hidden" name="programDayId" value={session.dayId} />
              <button
                type="submit"
                className={`touch-target rounded-full px-4 text-sm font-semibold ${
                  highlight
                    ? "border border-white/30 text-white"
                    : "bg-accent text-black"
                }`}
              >
                Start this session
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
