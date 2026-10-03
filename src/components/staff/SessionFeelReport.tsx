import { distributionSummary, type DifficultyBucket, type DifficultyFeedbackView } from "@/lib/difficulty";

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function BucketList({
  title,
  buckets,
  empty,
}: {
  title: string;
  buckets: DifficultyBucket[];
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-base">{title}</h3>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {buckets.map((bucket) => (
            <li
              key={bucket.key}
              className="rounded-2xl border border-line bg-background px-4 py-3"
              data-feel-bucket={bucket.key}
              data-feel-average={bucket.average ?? ""}
              data-feel-count={bucket.count}
            >
              <p className="font-semibold">{bucket.label}</p>
              <p className="mt-1 text-sm">
                Average {bucket.average?.toFixed(1)} of 5 · {bucket.count} rated
              </p>
              <p className="mt-1 text-sm text-muted">{distributionSummary(bucket.distribution)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SessionFeelReport({ feedback }: { feedback: DifficultyFeedbackView }) {
  return (
    <section id="session-feel" className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <div>
        <h2>Session feel</h2>
        <p className="mt-1 text-sm text-muted">
          How finished workouts felt. 1 is too easy, 5 is extremely difficult. Not a grade, and
          load does not change from this.
        </p>
        <p className="mt-2 text-sm">
          {feedback.ratedCount} rated · {feedback.unratedCount} not rated in this recent window
        </p>
      </div>

      <BucketList
        title="By workout type"
        buckets={feedback.byWorkoutType}
        empty="No ratings yet."
      />
      <BucketList
        title="By program day"
        buckets={feedback.byProgramDay}
        empty="No program-day ratings yet. Bag and pad rounds show under workout type."
      />

      <div className="space-y-2">
        <h3 className="text-base">Recent sessions</h3>
        {feedback.sessions.length === 0 ? (
          <p className="text-sm text-muted">No finished sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {feedback.sessions.map((session) => (
              <li
                key={session.sessionId}
                className="rounded-2xl border border-line bg-background px-4 py-3"
                data-feel-session={session.sessionId}
                data-feel-rating={session.difficultyRating}
              >
                <p className="font-semibold">{session.displayName}</p>
                <p className="mt-1 text-sm">
                  {session.title}
                  {session.programDayTitle && session.programDayTitle !== session.title
                    ? ` · ${session.programDayTitle}`
                    : ""}{" "}
                  · {session.workoutType}
                </p>
                <p className="mt-1 text-sm">
                  {session.difficultyLabel}
                  {session.score != null ? ` (${session.score} of 5)` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">{formatWhen(session.performedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
