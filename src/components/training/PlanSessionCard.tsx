import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { StartSubmit } from "@/components/training/StartTodayButton";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { TrainDayMobility } from "@/components/training/TrainDayMobility";
import { lookupFormVideo } from "@/lib/form-videos";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import { plannedSetLine } from "@/lib/exercise-log-mode";
import { mobilityBookendsForSession } from "@/lib/mobility-train";
import { planStructureGroups, planStructureLine } from "@/lib/plan-structure";
import type { ResolvedPlanSession } from "@/lib/week-plan";
import { HoldToMove, WorkoutMoveButton } from "@/components/training/WorkoutMove";

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
  logMode?: string;
  formVideoUrl: string;
  formVideoPending: boolean;
  planSlot?: string | null;
};

export function PlanSessionCard({
  session,
  highlight,
  compact,
  draftId,
  calendarWeekday,
  completed = false,
}: {
  session: ResolvedPlanSession;
  highlight?: boolean;
  compact?: boolean;
  draftId?: string;
  /** Calendar day this card is showing on. Swap uses this, not the skeleton day. */
  calendarWeekday?: string;
  /** A logged session stays on the day it was finished. */
  completed?: boolean;
}) {
  const kind = KIND_LABEL[session.kind];
  const exercises = (session.day?.exercises ?? []) as DayExercise[];
  const groups = planStructureGroups(exercises);
  const structure = planStructureLine(groups);
  const minutes = session.day ? estimateSessionMinutes(session.day.exercises) : 0;
  const count = exercises.length;
  const href = draftId ? `/training/log/${draftId}` : session.href;
  const cta = draftId ? "Resume" : session.dayId ? "Start" : session.href ? "Open session" : null;
  const bookend = mobilityBookendsForSession({
    kind: session.kind,
    title: session.title,
    subtitle: session.subtitle,
    label: session.label,
  });
  const fromWeekday = calendarWeekday || session.sourceWeekday || "";
  const canMove = Boolean(session.sessionKey && session.href && fromWeekday && !completed);

  const article = (
    <article
      className={`rounded-2xl p-5 ${
        highlight
          ? "bg-black text-white"
          : "border border-line bg-card text-foreground"
      }`}
    >
      <p
        className={`font-display text-xs uppercase ${
          highlight ? "text-highlighter" : "text-accent"
        }`}
      >
        {structure || `Session ${session.slot} · ${kind}`}
        {session.optional ? " · optional" : ""}
        {minutes > 0 ? ` · est. ${minutes} min` : ""}
      </p>
      <h3 className="mt-1 text-lg leading-tight">{session.title}</h3>
      <p className={`mt-1 text-sm ${highlight ? "text-white/70" : "text-muted"}`}>
        {session.subtitle}
        {count > 0 ? ` · ${exerciseCountLabel(count)}` : ""}
      </p>
      {groups.length > 0 ? (
        <div className="mt-3 space-y-3" data-plan-structure={structure}>
          {groups.map((group) => (
            <div key={group.label}>
              <p
                className={`font-display text-[11px] uppercase tracking-wide ${
                  highlight ? "text-highlighter" : "text-accent"
                }`}
              >
                {group.label}
              </p>
              <ul className="space-y-2 text-sm">
                {group.exercises.map((exercise, index) => {
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
                            {plannedSetLine({
                              sets: exercise.sets,
                              reps: exercise.reps,
                              restSeconds: exercise.restSeconds,
                              logMode: exercise.logMode,
                              name: exercise.name,
                              loadText: exercise.loadText,
                            })}
                          </span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : !compact && exercises.length > 0 ? (
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
                      {plannedSetLine({
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restSeconds: exercise.restSeconds,
                        logMode: exercise.logMode,
                        name: exercise.name,
                        loadText: exercise.loadText,
                      })}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {canMove && session.sessionKey ? (
        <div className="mt-4">
          <WorkoutMoveButton
            sessionKey={session.sessionKey}
            fromWeekday={fromWeekday}
            title={session.title}
            heavy={Boolean(session.heavy)}
          />
        </div>
      ) : null}
      {completed ? (
        <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
          Done
        </p>
      ) : null}
      {cta ? (
        <div
          data-session-actions
          className="above-dock mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          {draftId ? (
            <Link
              href={`/training/log/${draftId}`}
              data-prime-coach-audio
              className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-4 text-sm text-black"
            >
              Resume
            </Link>
          ) : session.dayId ? (
            <form
              data-testid="training-open-bike-logger"
              action={startSessionAction}
              data-open-bike-logger={session.logHref ? "train" : undefined}
              data-prime-coach-audio
            >
              <input type="hidden" name="programDayId" value={session.dayId} />
              <StartSubmit
                label="Start"
                className="touch-target rounded-full bg-accent px-4 text-sm text-black"
              />
            </form>
          ) : href ? (
            <Link
              data-testid={`training-link-2-${href.split("/").filter(Boolean).join("-")}`}
              href={href}
              className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm ${
                highlight ? "bg-accent text-black" : "border border-line"
              }`}
            >
              {cta}
            </Link>
          ) : null}
          {session.href && (draftId || session.dayId) ? (
            <Link
              href={session.href}
              className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm ${
                highlight ? "border border-white/30 text-white" : "border border-line"
              }`}
            >
              Preview
            </Link>
          ) : null}
        </div>
      ) : null}
      {bookend ? <TrainDayMobility bookend={bookend} inverted={Boolean(highlight)} /> : null}
    </article>
  );

  if (!canMove || !session.sessionKey) return article;
  return (
    <HoldToMove
      sessionKey={session.sessionKey}
      fromWeekday={fromWeekday}
      title={session.title}
      heavy={Boolean(session.heavy)}
    >
      {article}
    </HoldToMove>
  );
}
