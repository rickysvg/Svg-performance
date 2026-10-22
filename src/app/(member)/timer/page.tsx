import Link from "next/link";
import { BikeClockScreen } from "@/components/timer/BikeClockScreen";
import { RoundTimer } from "@/components/timer/RoundTimer";
import type { BagworkQuery } from "@/lib/bagwork";
import { resolveBagworkLaunch } from "@/lib/bagwork-store";
import { bikeSessionForLogger, isBikeIntervalName, type BikeSession } from "@/lib/bike-sessions";
import { getProgramDayById } from "@/lib/programs";
import { requireUser } from "@/lib/session";
import { isTimerMode } from "@/lib/timer-session";

type TimerQuery = BagworkQuery & {
  mode?: string;
  workout?: string;
  day?: string;
};

async function bikePlanFromDay(dayId?: string): Promise<BikeSession | null> {
  if (!dayId) return null;
  try {
    const day = await getProgramDayById(dayId);
    const exercise = day.exercises.find((row) => isBikeIntervalName(row.name));
    if (!exercise) return null;
    return bikeSessionForLogger(exercise.name, {
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
    });
  } catch {
    return null;
  }
}

export default async function TimerPage({
  searchParams,
}: {
  searchParams: Promise<TimerQuery>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  if (query.mode === "bike") {
    const plan = await bikePlanFromDay(query.day);
    return (
      <main>
        <BikeClockScreen token={query.workout ?? null} session={plan} dayId={query.day ?? null} />
      </main>
    );
  }
  const launch = await resolveBagworkLaunch(user.id, query);
  const mode = isTimerMode(query.mode) ? query.mode : null;
  return (
    <main>
      {query.bagwork && !launch ? (
        <p className="mb-4 text-sm">
          That bag workout is not on your list.{" "}
          <Link href="/bagwork" className="text-accent underline">
            Back to Bagwork
          </Link>
        </p>
      ) : null}
      <RoundTimer launch={launch} mode={mode} />
    </main>
  );
}
