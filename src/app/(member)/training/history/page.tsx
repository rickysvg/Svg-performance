import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { readTimerFieldsByIds } from "@/lib/workout-timer-columns";
import { memberFacingTitle } from "@/lib/member-copy";
import { EmptyState } from "@/components/EmptyState";
import { difficultyLabel } from "@/lib/difficulty";
import { bagworkHistoryLine } from "@/lib/bagwork";
import { bikeHistoryLine } from "@/lib/bike-chooser";
import { historyDetailBesideCount, roundHistoryLine } from "@/lib/round-session";
import { calendarPlanDoses } from "@/lib/plan-doses";
import { sessionProgress } from "@/lib/session-progress";
import { visibleDoseForSession } from "@/lib/finish-plan";
import { loadMemberExerciseEdits } from "@/lib/member-exercise-edits";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { dayKey, formatMemberDateTime, mondayOfZoned } from "@/lib/timezone";
import { DeleteWorkoutButton } from "@/components/training/DeleteWorkoutButton";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { backfillFormSeed } from "@/lib/backfill-workout";
import { SaveWorkoutButton } from "@/components/training/SaveWorkoutButton";
import { loggedExerciseNamesInOrder } from "@/lib/logger-insert";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { defaultSavedWorkoutName } from "@/lib/my-workout-plan";

export default async function HistoryPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const sessions = await listWorkoutSessionsForUser(user.id);
  const timers = await readTimerFieldsByIds(
    sessions.map((session) => session.id),
    prisma,
  );
  const weeks = new Map<string, Date>();
  for (const session of sessions) {
    const performed = new Date(session.performedAt);
    const week = dayKey(mondayOfZoned(performed, timeZone), timeZone);
    if (!weeks.has(week)) weeks.set(week, performed);
  }
  const [doseByWeek, edits] = await Promise.all([
    Promise.all(
      [...weeks].map(async ([week, date]) => [week, await calendarPlanDoses(user.id, date)] as const),
    ).then((rows) => new Map(rows)),
    loadMemberExerciseEdits(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-2xl">Workout history</h1>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Link
              href="/training/history/bike"
              data-bike-history-link
              className="touch-target inline-flex items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
            >
              Bike history
            </Link>
            <Link
              href="/training/my-workouts"
              data-my-workouts-link
              className="touch-target inline-flex items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
            >
              My Workouts
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </p>
        <div className="mt-3">
          <LogPastWorkoutButton entry="history" label="+ Log past workout" timeZone={timeZone} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          action={
            <Link href="/training" className="text-accent underline">
              Start a session
            </Link>
          }
        >
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => {
            const week = dayKey(mondayOfZoned(new Date(session.performedAt), timeZone), timeZone);
            const plan = session.programDayId ? doseByWeek.get(week)?.get(session.programDayId) : undefined;
            const programmed =
              plan?.exercises && plan.exercises.length > 0
                ? plan.exercises
                : (session.programDay?.exercises ?? []);
            const visible = session.programDay
              ? visibleDoseForSession({
                  exercises: programmed,
                  catalogDose: plan?.dose,
                  sessionId: session.id,
                  blockKey: trainingBlockKey(
                    new Date(session.performedAt),
                    timeZone,
                    profile?.onboardingCompletedAt ?? null,
                  ),
                  programSlug: session.programDay.program.slug,
                  dayNumber: session.programDay.dayNumber,
                  edits,
                  loggedSets: session.sets,
                })
              : null;
            const progress = sessionProgress(
              session,
              visible
                ? { dose: visible.dose, names: visible.names, exercises: visible.exercises }
                : { exercises: session.programDay?.exercises },
            );
            const countLine = progress.text;
            const finished = progress.done;
            const names = loggedExerciseNamesInOrder(session.sets);
            const liveName = session.savedWorkout?.name?.trim();
            const title = liveName || memberFacingTitle(session.title);
            const bagLine = bagworkHistoryLine(session);
            const roundLine = bagLine
              ? null
              : roundHistoryLine({ ...session, ...timers.get(session.id) });
            const bikeLine = bikeHistoryLine(session);
            const detailLine = historyDetailBesideCount(bagLine ?? roundLine);
            const pastSeed = session.backfilled ? backfillFormSeed(session, timeZone) : null;
            return (
            <li key={session.id} className="space-y-2" {...(bagLine ? { "data-bagwork-session": "" } : {})}>
            <div className="flex items-stretch gap-2">
              <Link
                data-testid={`training-history-log-${session.id}`}
                href={`/training/log/${session.id}`}
                className="block min-w-0 flex-1 rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`font-semibold${liveName ? " normal-case" : ""}`}>{title}</p>
                </div>
                {names.length > 0 ? (
                  <p className="mt-1 text-sm" data-history-exercises>
                    {names.join(" · ")}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted" data-history-when={timeZone}>
                  {formatMemberDateTime(new Date(session.performedAt), timeZone)} ·{" "}
                  <span data-session-progress>{countLine}</span>
                  {detailLine ? ` · ${detailLine}` : ""}
                  {difficultyLabel(session.difficultyRating)
                    ? ` · ${difficultyLabel(session.difficultyRating)}`
                    : finished && !bagLine
                      ? " · rate how it felt"
                      : ""}
                </p>
                {bikeLine ? (
                  <p className="mt-1 text-sm text-muted" data-bike-history-line>
                    {bikeLine}
                  </p>
                ) : null}
                {session.notes ? <p className="mt-1 text-sm">{session.notes}</p> : null}
              </Link>
              {finished ? (
                <Link
                  href={`/training/log/${session.id}/done`}
                  className="touch-target inline-flex min-w-[4.5rem] items-center justify-center rounded-2xl border border-line px-3 text-sm"
                >
                  Share
                </Link>
              ) : null}
              <DeleteWorkoutButton workoutId={session.id} compact />
            </div>
            {pastSeed ? (
              <div className="flex flex-wrap gap-2">
                <LogPastWorkoutButton
                  entry="edit"
                  sessionId={session.id}
                  label="Edit"
                  compact
                  timeZone={timeZone}
                  seed={pastSeed}
                />
                <LogPastWorkoutButton
                  entry="delete"
                  sessionId={session.id}
                  label="Delete"
                  compact
                  timeZone={timeZone}
                  seed={pastSeed}
                />
              </div>
            ) : null}
            <SaveWorkoutButton
              workoutId={session.id}
              defaultName={defaultSavedWorkoutName({
                title: session.title,
                date: new Date(session.performedAt),
                timeZone,
              })}
            />
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
