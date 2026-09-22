import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  getHeartAnalysisForUser,
  getHeartDeviceStatus,
  hrSourceLabel,
  listRestingSamplesForUser,
  listWorkoutHrForUser,
} from "@/lib/heart";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";
import { PolarConnectCard } from "@/components/heart/PolarConnectCard";
import { HrRestingForm } from "@/components/heart/HrRestingForm";
import { HrWorkoutForm } from "@/components/heart/HrWorkoutForm";
import { HeartImportForm } from "@/components/heart/HeartImportForm";
import { ZoneChart } from "@/components/heart/ZoneChart";
import { deleteRestingHrAction, deleteWorkoutHrAction } from "@/app/actions/heart";

function polarFlash(value?: string) {
  if (value === "connected") return "Polar connected. Pull recent activities when you want a refresh.";
  if (value === "not-configured") {
    return "Polar keys are not set on this preview. Connect Polar (TEST) stays off until env is added.";
  }
  if (value === "error") return "Polar authorization did not finish. Try Connect Polar again.";
  return undefined;
}

export default async function HeartPage({
  searchParams,
}: {
  searchParams: Promise<{ polar?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const [status, analysis, resting, workouts] = await Promise.all([
    getHeartDeviceStatus(user.id),
    getHeartAnalysisForUser(user.id),
    listRestingSamplesForUser(user.id),
    listWorkoutHrForUser(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Heart rate</h1>
        <p className="mt-1 text-sm text-muted">
          Polar when env keys exist. Otherwise manual, CSV import, or labeled DEMO. Apple
          Watch is not connected on the web.
        </p>
      </div>

      <PolarConnectCard status={status} message={polarFlash(query.polar)} />

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Breakdown</h2>
        <p className="mt-1 text-xs text-muted">{analysis.disclaimer}</p>
        {!analysis.latestRhr && !analysis.lastWorkout ? (
          <EmptyState title="No heart-rate data yet">
            Type a resting HR, record avg/max after a workout, import a CSV, connect Polar
            when keys exist, or load labeled DEMO samples.
          </EmptyState>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase text-muted">RHR 7-day</p>
                <p className="mt-1 text-2xl font-semibold">
                  {analysis.rhr7 !== null ? `${analysis.rhr7}` : "—"}
                </p>
              </article>
              <article className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase text-muted">RHR 30-day</p>
                <p className="mt-1 text-2xl font-semibold">
                  {analysis.rhr30 !== null ? `${analysis.rhr30}` : "—"}
                </p>
              </article>
            </div>
            {analysis.lastWorkout ? (
              <article className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase text-muted">Last workout HR</p>
                  {analysis.lastWorkout.source === "demo" ? <DemoBadge /> : null}
                </div>
                <p className="mt-1 text-lg font-semibold">
                  {analysis.lastWorkout.avgBpm} avg · {analysis.lastWorkout.maxBpm} max
                </p>
                <p className="mt-1 text-xs text-muted">
                  {hrSourceLabel(analysis.lastWorkout.source)} ·{" "}
                  {analysis.lastWorkout.startedAt.toLocaleString()}
                </p>
                <ZoneChart
                  zone1={analysis.lastWorkout.zones.zone1}
                  zone2={analysis.lastWorkout.zones.zone2}
                  zone3={analysis.lastWorkout.zones.zone3}
                  zone4={analysis.lastWorkout.zones.zone4}
                  zone5={analysis.lastWorkout.zones.zone5}
                />
              </article>
            ) : null}
            <article className="rounded-xl border border-line p-3">
              <p className="text-xs uppercase text-muted">Weekly zone distribution</p>
              {analysis.weeklyZones.totalSeconds === 0 ? (
                <p className="mt-2 text-sm text-muted">No workout zones in the last 7 days.</p>
              ) : (
                <ZoneChart
                  zone1={analysis.weeklyZones.zone1}
                  zone2={analysis.weeklyZones.zone2}
                  zone3={analysis.weeklyZones.zone3}
                  zone4={analysis.weeklyZones.zone4}
                  zone5={analysis.weeklyZones.zone5}
                />
              )}
            </article>
            <article className="rounded-xl border border-line p-3">
              <p className="text-xs uppercase text-muted">Insights</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {analysis.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">{analysis.disclaimer}</p>
            </article>
          </div>
        )}
      </section>

      <HrRestingForm />
      <HrWorkoutForm />
      <HeartImportForm />

      {resting.length > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Resting samples</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {resting.slice(0, 14).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0"
              >
                <span>
                  {row.bpm} bpm
                  <span className="block text-xs text-muted">
                    {row.recordedAt.toLocaleString()} · {hrSourceLabel(row.source)}
                    {row.source === "demo" ? " · DEMO" : ""}
                  </span>
                </span>
                <form action={deleteRestingHrAction}>
                  <input type="hidden" name="sampleId" value={row.id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {workouts.length > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Workout HR logs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {workouts.slice(0, 10).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0"
              >
                <span>
                  {row.avgBpm} / {row.maxBpm} bpm
                  <span className="block text-xs text-muted">
                    {row.startedAt.toLocaleString()} · {hrSourceLabel(row.source)}
                    {row.source === "demo" ? " · DEMO" : ""}
                  </span>
                </span>
                <form action={deleteWorkoutHrAction}>
                  <input type="hidden" name="sessionId" value={row.id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-muted">
        Also on{" "}
        <Link href="/progress" className="text-accent underline">
          My Progress
        </Link>
        . Record HR after a logged workout from the session screen.
      </p>
    </main>
  );
}
