import Link from "next/link";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { TrainDayMobility } from "@/components/training/TrainDayMobility";
import { lookupFormVideo } from "@/lib/form-videos";
import { estimateSessionMinutes, exerciseCountLabel } from "@/lib/exercise-media";
import { plannedSetLine } from "@/lib/exercise-log-mode";
import { mobilityBookendsForSession } from "@/lib/mobility-train";
import { planStructureGroups, planStructureLine } from "@/lib/plan-structure";
import type { ResolvedPlanSession } from "@/lib/week-plan";
import { HoldToMove, WorkoutMoveButton } from "@/components/training/WorkoutMove";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
import type { OpenProgramLog } from "@/lib/today-start";
import { visiblePartialLabel } from "@/lib/finish-plan";

const KIND_LABEL: Record<ResolvedPlanSession["kind"], string> = {
  skill: "Skill",
  strength: "Strength",
  conditioning: "Conditioning",
  rest: "Rest",
  mobility: "Mobility",
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
  resume,
  calendarWeekday,
  completed = false,
  dateLabel,
}: {
  session: ResolvedPlanSession;
  highlight?: boolean;
  compact?: boolean;
  draftId?: string;
  /** Open log for this program day. A short save is partial, not a draft. */
  resume?: OpenProgramLog;
  /** Calendar day this card is showing on. Swap uses this, not the skeleton day. */
  calendarWeekday?: string;
  /** A logged session stays on the day it was finished. */
  completed?: boolean;
  /** Civil date this card belongs to, so a swipe does not make it look like another week. */
  dateLabel?: string;
}) {
  const kind = KIND_LABEL[session.kind];
  const exercises = (session.day?.exercises ?? []) as DayExercise[];
  const groups = planStructureGroups(exercises);
  const structure = planStructureLine(groups);
  const minutes = session.day ? estimateSessionMinutes(session.day.exercises) : 0;
  const count = exercises.length;
  const partial = Boolean(resume?.partial);
  const href = session.href;
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
      {dateLabel ? (
        <p
          data-plan-date
          className={`font-display text-xs uppercase tracking-wide ${
            highlight ? "text-highlighter" : "text-accent"
          }`}
        >
          {dateLabel}
        </p>
      ) : null}
      <p
        className={`font-display text-xs uppercase ${
          highlight ? "text-highlighter" : "text-accent"
        } ${dateLabel ? "mt-2" : ""}`}
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
      {partial && !completed ? (
        <p data-session-partial className="mt-4 font-display text-xs uppercase tracking-wide text-[#FF3B3B]">
          {visiblePartialLabel(resume?.ticked, resume?.planned)}
        </p>
      ) : null}
      {partial && completed && resume?.progress ? (
        <p data-session-progress className="mt-3 text-sm font-semibold text-accent">
          {resume.progress}
        </p>
      ) : null}
      {completed ? (
        <p data-session-done className="mt-4 font-display text-xs uppercase tracking-wide text-accent">
          Done
        </p>
      ) : null}
      {session.href && session.dayId ? (
        <div
          data-session-actions
          data-session-draft={draftId || undefined}
          className="above-dock mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <Link
            href={session.href}
            data-preview-session
            className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm ${
              highlight ? "border border-white/30 text-white" : "border border-line"
            }`}
          >
            Preview
          </Link>
          {partial && resume && !completed ? (
            <ContinueWorkoutButton
              workoutId={resume.id}
              label="Resume"
              className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm ${
                highlight ? "bg-accent text-black" : "bg-accent text-black"
              }`}
            />
          ) : null}
        </div>
      ) : href ? (
        <div data-session-actions className="above-dock mt-4">
          <Link
            data-testid={`training-link-2-${href.split("/").filter(Boolean).join("-")}`}
            href={href}
            className={`touch-target inline-flex items-center justify-center rounded-full px-4 text-sm ${
              highlight ? "bg-accent text-black" : "border border-line"
            }`}
          >
            Open session
          </Link>
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
