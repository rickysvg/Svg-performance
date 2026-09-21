import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { ProgressBars } from "@/components/progress/ProgressBars";
import { EmptyState } from "@/components/EmptyState";
import { BodyMetricForm } from "@/components/progress/BodyMetricForm";
import { PhotoPlaceholderForm } from "@/components/progress/PhotoPlaceholderForm";
import {
  deleteBodyMetricAction,
  deletePhotoPlaceholderAction,
} from "@/app/actions/body-metrics";
import {
  getLatestBodyMetricsForUser,
  listPhotoPlaceholdersForUser,
  PHOTO_SLOTS,
} from "@/lib/body-metrics";
import { getNutritionSummaryForDay, getRecentNutritionDays } from "@/lib/nutrition";

function MetricTile({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </article>
  );
}

export default async function ProgressPage() {
  const user = await requireUser();
  const [profile, sessions, latestMetrics, photos, foodToday, foodWeek] = await Promise.all([
    getProfileForUser(user.id),
    listWorkoutSessionsForUser(user.id),
    getLatestBodyMetricsForUser(user.id),
    listPhotoPlaceholdersForUser(user.id),
    getNutritionSummaryForDay(user.id),
    getRecentNutritionDays(user.id, 7),
  ]);
  const units = profile?.preferredUnits ?? "lb";
  const summary = buildProgressSummary(sessions, units);
  const weight = latestMetrics.get("weight");
  const sleep = latestMetrics.get("sleepHours");
  const hr = latestMetrics.get("restingHr");
  const lean = latestMetrics.get("leanMass");
  const fat = latestMetrics.get("bodyFat");
  const photosBySlot = new Map(photos.map((row) => [row.slot, row]));
  const weekCalories = foodWeek.reduce((sum, day) => sum + day.calories, 0);
  const daysWithFood = foodWeek.filter((day) => day.entryCount > 0).length;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Progress</h1>
          <p className="mt-1 text-sm text-muted">
            Body numbers you type plus workouts and food you logged. Coming soon — no fake
            wearable sync.
          </p>
        </div>
        <Link
          href="/profile"
          className="touch-target inline-flex items-center rounded-full border border-line px-3 text-sm"
          aria-label="Progress settings (profile)"
        >
          Settings
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <MetricTile
          title="Resting Heart Rate"
          value={hr ? `${hr.value} ${hr.unit}` : "—"}
          hint={hr ? "Typed by you" : "Manual, or Coming soon — no fake device sync"}
        />
        <MetricTile
          title="Sleep"
          value={sleep ? `${sleep.value} ${sleep.unit}` : "—"}
          hint={sleep ? "Last night, typed by you" : "Manual, or Coming soon — no fake device sync"}
        />
        <MetricTile
          title="Caloric Intake"
          value={`${Math.round(foodToday.calories)} cal`}
          hint={
            daysWithFood
              ? `Today from food logs · ${Math.round(weekCalories / Math.max(daysWithFood, 1))} avg on days you logged this week`
              : "From food logs you typed. Empty until you log a meal."
          }
        />
        <MetricTile
          title="Body Weight"
          value={weight ? `${weight.value} ${weight.unit}` : "—"}
          hint={weight ? "Manual scale log" : "Log a weigh-in below. No scale pairing."}
        />
        <MetricTile
          title="Lean Body Mass"
          value={lean ? `${lean.value} ${lean.unit}` : "—"}
          hint={lean ? "Manual estimate" : "Manual, or Coming soon — no fake device sync"}
        />
        <MetricTile
          title="Body Fat"
          value={fat ? `${fat.value}%` : "—"}
          hint={fat ? "Manual estimate" : "Manual, or Coming soon — no fake device sync"}
        />
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Photos</h2>
        <p className="mt-1 text-sm text-muted">
          Gray boxes are placeholders. We do not store camera files in this preview.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {PHOTO_SLOTS.map((slot) => {
            const row = photosBySlot.get(slot);
            return (
              <div
                key={slot}
                className="flex aspect-square flex-col items-center justify-center rounded-xl bg-line/70 text-center text-xs text-muted"
              >
                <span className="capitalize">{slot}</span>
                {row ? (
                  <>
                    <span className="mt-1 text-foreground">
                      {row.recordedAt.toLocaleDateString()}
                    </span>
                    {row.caption ? <span className="mt-1 px-1">{row.caption}</span> : null}
                    <form action={deletePhotoPlaceholderAction} className="mt-2">
                      <input type="hidden" name="photoId" value={row.id} />
                      <button type="submit" className="text-[11px] text-danger underline">
                        Clear
                      </button>
                    </form>
                  </>
                ) : (
                  <span className="mt-1">Empty</span>
                )}
              </div>
            );
          })}
        </div>
        <PhotoPlaceholderForm />
      </section>

      <BodyMetricForm preferredUnits={units} />

      {latestMetrics.size > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Latest typed metrics</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[...latestMetrics.values()].map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
                <span>
                  {row.kind} · {row.value} {row.unit}
                  <span className="block text-xs text-muted">
                    {row.recordedAt.toLocaleString()}
                  </span>
                </span>
                <form action={deleteBodyMetricAction}>
                  <input type="hidden" name="metricId" value={row.id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">Workout history</h2>
        <p className="mt-1 text-sm text-muted">
          Built only from workouts you logged. Volume is reps × load, converted
          to your preferred unit ({units}).
        </p>
      </div>

      {summary.sessionCount === 0 ? (
        <EmptyState
          title="Nothing to chart yet"
          action={
            <Link href="/training" className="text-accent underline">
              Log a DEMO session
            </Link>
          }
        >
          Progress is built only from workouts you save.
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs uppercase text-muted">Sessions</p>
              <p className="mt-1 text-2xl font-semibold">{summary.sessionCount}</p>
            </article>
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs uppercase text-muted">Last session</p>
              <p className="mt-1 text-sm font-semibold">
                {summary.lastSessionTitle}
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Session volume ({units})</h2>
            <ProgressBars points={summary.points} />
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Best logged load</h2>
            {summary.exerciseBests.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Add a load on a set to see bests here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {summary.exerciseBests.map((best) => (
                  <li
                    key={best.exerciseName}
                    className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                  >
                    <span>{best.exerciseName}</span>
                    <span className="text-accent">
                      {best.bestLoad} {best.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
