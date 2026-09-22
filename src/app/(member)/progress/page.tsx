import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { ProgressBars } from "@/components/progress/ProgressBars";
import { EmptyState } from "@/components/EmptyState";
import { BodyMetricForm } from "@/components/progress/BodyMetricForm";
import { PhotoUploadForm } from "@/components/progress/PhotoUploadForm";
import { deleteBodyMetricAction, deleteProgressPhotoAction } from "@/app/actions/body-metrics";
import { getLatestBodyMetricsForUser } from "@/lib/body-metrics";
import { listProgressPhotosForUser, progressPhotoSrc } from "@/lib/progress-photos";
import { getNutritionSummaryForDay, getRecentNutritionDays } from "@/lib/nutrition";
import { getPersonalRecordsForUser } from "@/lib/records";
import { PersonalRecordsBoard } from "@/components/progress/PersonalRecordsBoard";
import { getProgressHeartTiles } from "@/lib/heart";

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
  const [profile, sessions, latestMetrics, photos, foodToday, foodWeek, heartTiles] =
    await Promise.all([
      getProfileForUser(user.id),
      listWorkoutSessionsForUser(user.id),
      getLatestBodyMetricsForUser(user.id),
      listProgressPhotosForUser(user.id),
      getNutritionSummaryForDay(user.id),
      getRecentNutritionDays(user.id, 7),
      getProgressHeartTiles(user.id),
    ]);
  const units = profile?.preferredUnits ?? "lb";
  const records = await getPersonalRecordsForUser(user.id, units);
  const summary = buildProgressSummary(sessions, units);
  const weight = latestMetrics.get("weight");
  const sleep = latestMetrics.get("sleepHours");
  const typedHr = latestMetrics.get("restingHr");
  const lean = latestMetrics.get("leanMass");
  const fat = latestMetrics.get("bodyFat");
  const weekCalories = foodWeek.reduce((sum, day) => sum + day.calories, 0);
  const daysWithFood = foodWeek.filter((day) => day.entryCount > 0).length;

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Progress</h1>
          <p className="mt-1 text-sm text-muted">
            Body numbers you type, Polar when it is connected, or a labeled import. Apple
            Watch is not connected on the web.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/heart"
            className="touch-target inline-flex items-center rounded-full border border-accent px-3 text-sm"
          >
            Heart rate
          </Link>
          <Link
            href="/profile"
            className="touch-target inline-flex items-center rounded-full border border-line px-3 text-sm"
            aria-label="Progress settings (profile)"
          >
            Settings
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <MetricTile
          title="Resting Heart Rate"
          value={heartTiles.rhr?.value ?? (typedHr ? `${typedHr.value} ${typedHr.unit}` : "—")}
          hint={
            heartTiles.rhr?.hint ??
            (typedHr
              ? "Typed by you"
              : "Empty until you type one, import a CSV, or pull Polar")
          }
        />
        <MetricTile
          title="Last workout HR"
          value={heartTiles.lastWorkout?.value ?? "—"}
          hint={
            heartTiles.lastWorkout?.hint ??
            "Avg / max after a session — manual, Polar, import, or DEMO"
          }
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
        <h2 className="font-semibold">Progress photos</h2>
        <p className="mt-1 text-sm text-muted">
          Private to you. Coaches and admins cannot see these in this preview. Photos are
          not written into analytics events.
        </p>
        {photos.length === 0 ? (
          <EmptyState title="No photos yet">
            Upload a jpeg, png, or webp from your camera roll. 5 MB max. Only you can open it.
          </EmptyState>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-xl border border-line">
                <Link href={`/progress/photos/${photo.id}`} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={progressPhotoSrc(photo.id)}
                    alt={photo.caption || "Progress photo"}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block px-2 py-2 text-xs text-muted">
                    {photo.recordedAt.toLocaleDateString()}
                    {photo.caption ? ` · ${photo.caption}` : ""}
                  </span>
                </Link>
                <form action={deleteProgressPhotoAction} className="px-2 pb-2">
                  <input type="hidden" name="photoId" value={photo.id} />
                  <button type="submit" className="text-[11px] text-danger underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <PhotoUploadForm />
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

      <PersonalRecordsBoard records={records} />

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

        </>
      )}
    </main>
  );
}
