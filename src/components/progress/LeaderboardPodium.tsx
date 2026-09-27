import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/leaderboard";

function Place({
  entry,
  place,
  tall,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  tall?: boolean;
}) {
  const height = tall ? "h-28" : "h-20";
  const first = place === 1;
  return (
    <li className="flex flex-1 flex-col items-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          first ? "bg-accent text-black" : "bg-black text-highlighter"
        }`}
      >
        <span className={`font-display text-sm uppercase tracking-wide ${first ? "text-black" : "text-highlighter"}`}>
          {entry.initials}
        </span>
      </div>
      <p className="mt-2 max-w-[6.5rem] truncate text-center text-xs">{entry.displayName}</p>
      <div
        className={`mt-2 flex w-full ${height} flex-col items-center justify-center rounded-t-xl ${
          first ? "bg-accent text-black" : "bg-black text-highlighter"
        }`}
      >
        <p className={`font-display text-3xl leading-none ${first ? "text-black" : "text-highlighter"}`}>
          {place}
        </p>
        <p className={`mt-1 text-xs ${first ? "text-black" : "text-white"}`}>{entry.workouts}</p>
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
  const others = entries.filter((row) => !row.isYou);
  const first = others.find((row) => row.rank === 1) ?? entries.find((row) => row.rank === 1);
  const second = entries.find((row) => row.rank === 2);
  const third = entries.find((row) => row.rank === 3);
  const toPass = nextAhead ? Math.max(0, nextAhead.workouts - viewerWorkouts + 1) : 0;
  const showPodium = others.length > 0;

  return (
    <section id="leaderboard" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg">{scope === "academy" ? "Academy leaderboard" : "Leaderboard"}</h2>
        <p className="text-sm text-muted">{optedIn ? "Opted in · this month" : "Opt-in · this month"}</p>
      </div>
      {showPodium ? (
        <ol className="flex items-end gap-2">
          {second ? <Place entry={second} place={2} /> : <li className="flex-1" />}
          {first ? <Place entry={first} place={1} tall /> : <li className="flex-1" />}
          {third ? <Place entry={third} place={3} /> : <li className="flex-1" />}
        </ol>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-4 py-5 text-sm text-muted">
          No one else has opted in this month. The board stays empty until another
          athlete turns it on in Profile. Display names only — never emails.
        </p>
      )}
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
            <Link href="/profile#leaderboard" className="underline">
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
