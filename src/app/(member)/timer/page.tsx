import Link from "next/link";
import { BikeClockScreen } from "@/components/timer/BikeClockScreen";
import { RoundTimer } from "@/components/timer/RoundTimer";
import type { BagworkQuery } from "@/lib/bagwork";
import { resolveBagworkLaunch } from "@/lib/bagwork-store";
import { bikeSessionForLogger, isBikeIntervalName, type BikeSession } from "@/lib/bike-sessions";
import { activePlanWeekIndex } from "@/lib/fight-camp";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { requireUser } from "@/lib/session";
import { isTimerMode } from "@/lib/timer-session";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";

type TimerQuery = BagworkQuery & {
  mode?: string;
  workout?: string;
  day?: string;
};

async function bikePlanFromDay(userId: string, dayId?: string): Promise<BikeSession | null> {
  if (!dayId) return null;
  try {
    const [raw, profile] = await Promise.all([getProgramDayById(dayId), getProfileForUser(userId)]);
    const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
    const doseWeek = await activePlanWeekIndex(
      userId,
      new Date(),
      tz,
      profile?.onboardingCompletedAt ?? null,
    );
    const day = scaleProgramDay(raw, {
      band: scaleBandFromPrefs({
        experienceLevel: profile?.experienceLevel,
        competitionStatus: profile?.competitionStatus,
      }),
      programSlug: raw.program.slug,
      weightAccess: profile?.weightAccess,
      weekIndex: doseWeek.weekIndex,
      campPhase: doseWeek.camp?.phase ?? null,
    });
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
  if (query.mode === "bike" && query.day) {
    const plan = await bikePlanFromDay(user.id, query.day);
    return (
      <main>
        <BikeClockScreen token={query.workout ?? null} session={plan} dayId={query.day ?? null} />
      </main>
    );
  }
  const launch = await resolveBagworkLaunch(user.id, query);
  const mode = query.mode === "bike" ? "bike" : isTimerMode(query.mode) ? query.mode : null;
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
