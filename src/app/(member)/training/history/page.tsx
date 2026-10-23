import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { memberFacingTitle } from "@/lib/member-copy";
import { EmptyState } from "@/components/EmptyState";
import { difficultyLabel } from "@/lib/difficulty";
import { bagworkHistoryLine } from "@/lib/bagwork";
import { bikeHistoryLine } from "@/lib/bike-chooser";
import { roundHistoryLine } from "@/lib/round-session";
import {
  completionListLabel,
  sessionCountsAsPlannedCompletion,
  tickedSetCount,
} from "@/lib/logged-work";
import { DeleteWorkoutButton } from "@/components/training/DeleteWorkoutButton";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { SaveWorkoutButton } from "@/components/training/SaveWorkoutButton";
import { loggedExerciseNamesInOrder } from "@/lib/logger-insert";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { defaultSavedWorkoutName } from "@/lib/my-workout-plan";

export default async function HistoryPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const sessions = await listWorkoutSessionsForUser(user.id);

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
          <LogPastWorkoutButton entry="history" label="+ Log past workout" />
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
            const finished = sessionCountsAsPlannedCompletion(session, []);
            const setCount = tickedSetCount(session.sets);
            const label = completionListLabel(session);
            const names = loggedExerciseNamesInOrder(session.sets);
            const liveName = session.savedWorkout?.name?.trim();
            const title = liveName || memberFacingTitle(session.title);
            const bagLine = bagworkHistoryLine(session);
            const roundLine = bagLine ? null : roundHistoryLine(session);
            const bikeLine = bikeHistoryLine(session);
            const detailLine = bagLine ?? roundLine;
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
                  {new Date(session.performedAt).toLocaleString("en-US", { timeZone })} · {label}
                  {detailLine ? ` · ${detailLine}` : ` · ${setCount} set${setCount === 1 ? "" : "s"}`}
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
            {session.backfilled ? (
              <div className="flex flex-wrap gap-2">
                <LogPastWorkoutButton entry="edit" sessionId={session.id} label="Edit" compact />
                <LogPastWorkoutButton entry="delete" sessionId={session.id} label="Delete" compact />
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
