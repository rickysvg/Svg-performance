import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getCompanionProgress } from "@/lib/progress-companion";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import {
  filterChartPoints,
  isChartRange,
  labelChartWeeks,
  resolveChartWindow,
  weeklyBestLoad,
} from "@/lib/exercise-charts";
import { findExerciseBySlug } from "@/lib/personal-bests";
import { ExerciseChart } from "@/components/progress/ExerciseChart";
import { RecordsList } from "@/components/progress/RecordsList";

export default async function ExerciseRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const query = await searchParams;
  const profile = await getProfileForUser(user.id);
  const units = profile?.preferredUnits ?? "lb";
  const [companion, paid, trial] = await Promise.all([
    getCompanionProgress(user.id, units),
    canUseFeature(user.id, "progress_history"),
    getTrialState(user.id),
  ]);
  const names = companion.records.map((row) => row.exerciseName);
  const exerciseName = findExerciseBySlug(names, slug);
  if (!exerciseName) notFound();

  const requested = isChartRange(query.range) ? query.range : "12w";
  const window = resolveChartWindow({
    range: requested,
    paid,
    timeZone: companion.timeZone,
  });
  const raw = weeklyBestLoad(companion.datedSets, exerciseName, units, companion.timeZone);
  const filtered = filterChartPoints(
    raw,
    window.start,
    new Date(),
    paid,
    companion.timeZone,
  );
  const points = labelChartWeeks(filtered.visible);
  const row = companion.records.find((item) => item.exerciseName === exerciseName);

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/progress/records"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none"
          aria-label="Back to Records"
        >
          ‹
        </Link>
        <h1 className="text-xl">Records</h1>
        <span className="w-8" aria-hidden />
      </div>

      <ExerciseChart
        exerciseName={exerciseName}
        unit={units === "kg" ? "kg" : "lbs"}
        points={points}
        range={window.locked ? requested : window.range}
        slug={slug}
        locked={window.locked}
        canStartTrial={trial.canStartTrial}
        trialDays={trial.trialLengthDays}
      />

      {row ? (
        <section>
          <h2 className="text-lg">Personal records</h2>
          <div className="mt-3">
            <RecordsList records={[row]} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
