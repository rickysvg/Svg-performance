import Link from "next/link";
import type { PersonalRecords } from "@/lib/records";

export function PersonalRecordsBoard({ records }: { records: PersonalRecords }) {
  return (
    <section id="personal-records" className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <div>
        <h2 className="font-semibold">Personal records</h2>
        <p className="mt-1 text-sm text-muted">
          Recalculated from workouts and activity you already logged. Not a live leaderboard.
        </p>
      </div>
      {records.empty ? (
        <div>
          <p className="text-sm text-muted">
            No records yet. Save a workout with a load, or log a day of training or food, and
            this board fills in.
          </p>
          <Link href="/training" className="mt-3 inline-block text-sm text-accent underline">
            Log a DEMO session
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-xl border border-line p-3">
              <p className="text-xs uppercase text-muted">Longest days-active streak</p>
              <p className="mt-1 text-2xl font-semibold">{records.longestActiveStreak}</p>
              <p className="mt-1 text-xs text-muted">
                Days in a row with a workout or food log. Current: {records.currentActiveStreak}.
              </p>
            </article>
            <article className="rounded-xl border border-line p-3">
              <p className="text-xs uppercase text-muted">Load PRs</p>
              <p className="mt-1 text-2xl font-semibold">{records.loadRecords.length}</p>
              <p className="mt-1 text-xs text-muted">Heaviest logged load per exercise name.</p>
            </article>
          </div>
          {records.loadRecords.length === 0 ? (
            <p className="text-sm text-muted">
              Add a load on a set to see heaviest-per-exercise records.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {records.loadRecords.map((best) => (
                <li
                  key={best.exerciseName}
                  className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                >
                  <span>
                    {best.exerciseName}
                    <span className="block text-xs text-muted">
                      {best.date.toLocaleDateString()}
                    </span>
                  </span>
                  <span className="text-accent">
                    {best.bestLoad} {best.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
