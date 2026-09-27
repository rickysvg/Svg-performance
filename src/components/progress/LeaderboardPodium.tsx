import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/leaderboard";

function Place({
  entry,
  place,
  tall,
}: {
  entry?: LeaderboardEntry;
  place: 1 | 2 | 3;
  tall?: boolean;
}) {
  const height = tall ? "h-28" : "h-20";
  return (
    <li className="flex flex-1 flex-col items-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          place === 1 ? "bg-accent text-black" : "bg-black text-accent"
        }`}
      >
        <span className="font-display text-sm uppercase tracking-wide">
          {entry?.initials ?? "—"}
        </span>
      </div>
      <p className="mt-2 max-w-[6.5rem] truncate text-center text-xs">
        {entry?.displayName ?? "Open"}
      </p>
      <div
        className={`mt-2 flex w-full ${height} flex-col items-center justify-center rounded-t-xl ${
          place === 1 ? "bg-accent text-black" : "bg-black text-accent"
        }`}
      >
        <p className="font-display text-3xl leading-none">{place}</p>
        <p className="mt-1 text-xs">{entry ? `${entry.workouts}` : "—"}</p>
      </div>
    </li>
  );
}

export function LeaderboardPodium({
  entries,
  you,
  viewerWorkouts,
  nextAhead,
  optedIn,
  scope,
}: {
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
  viewerWorkouts: number;
  nextAhead: LeaderboardEntry | null;
  optedIn: boolean;
  scope: "all" | "academy";
}) {
  const first = entries.find((row) => row.rank === 1);
  const second = entries.find((row) => row.rank === 2);
  const third = entries.find((row) => row.rank === 3);
  const toPass = nextAhead ? Math.max(0, nextAhead.workouts - viewerWorkouts + 1) : 0;

  return (
    <section id="leaderboard" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg">{scope === "academy" ? "Academy leaderboard" : "Leaderboard"}</h2>
        <p className="text-sm text-muted">{optedIn ? "Opted in · this month" : "Opt-in · this month"}</p>
      </div>
      <ol className="flex items-end gap-2">
        <Place entry={second} place={2} />
        <Place entry={first} place={1} tall />
        <Place entry={third} place={3} />
      </ol>
      <div className="rounded-full border border-line bg-card px-4 py-3 text-center text-sm">
        {optedIn && you ? (
          <>
            You · #{you.rank}
            {nextAhead
              ? ` · ${viewerWorkouts} workouts · ${toPass} to pass #${nextAhead.rank}`
              : ` · ${viewerWorkouts} workouts`}
          </>
        ) : (
          <>
            Your count: {viewerWorkouts} workouts.{" "}
            <Link href="/profile#leaderboard" className="text-accent underline">
              Opt in on Profile
            </Link>{" "}
            to appear. Display name only — never email.
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Link
          href="/progress/streaks?scope=all#leaderboard"
          className={`touch-target inline-flex flex-1 items-center justify-center rounded-full border text-sm ${
            scope === "all" ? "border-black bg-accent text-black" : "border-line bg-white"
          }`}
        >
          All
        </Link>
        <Link
          href="/progress/streaks?scope=academy#leaderboard"
          className={`touch-target inline-flex flex-1 items-center justify-center rounded-full border text-sm ${
            scope === "academy" ? "border-black bg-accent text-black" : "border-line bg-white"
          }`}
        >
          Academy
        </Link>
      </div>
    </section>
  );
}
