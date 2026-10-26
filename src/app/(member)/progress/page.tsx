import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser, PROGRESS_HISTORY_DAYS } from "@/lib/workouts";
import { buildProgressSummary, sessionAppearsOnProgress } from "@/lib/progress";
import { ProgressBars } from "@/components/progress/ProgressBars";
import { EmptyState } from "@/components/EmptyState";
import { BodyMetricForm } from "@/components/progress/BodyMetricForm";
import {
  displayBodyMetric,
  formatOneDecimal,
  getLatestBodyMetricsForUser,
  listBodyMetricsForUser,
  weightSeriesPoints,
} from "@/lib/body-metrics";
import { massCaption, massGaugeScale } from "@/lib/mass-caption";
import { BodyWeightChart } from "@/components/progress/BodyWeightChart";
import { HomeTelemetry } from "@/components/home/HomeTelemetry";
import { getHomeTelemetry } from "@/lib/home-telemetry";
import { getFightCampRow } from "@/lib/fight-camp";
import { telemetryGraphTitle } from "@/lib/telemetry-title";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import { HomeBodyWeight } from "@/components/home/HomeBodyWeight";
import { WeighInDisclosure } from "@/components/progress/WeighInDisclosure";
import { DeleteBodyMetricButton } from "@/components/progress/DeleteBodyMetricButton";
import { listProgressPhotosForUser } from "@/lib/progress-photos";
import { getNutritionSummaryForDay, getRecentNutritionDays } from "@/lib/nutrition";
import { getPersonalRecordsForUser } from "@/lib/records";
import { PersonalRecordsBoard } from "@/components/progress/PersonalRecordsBoard";
import { getProgressHeartTiles } from "@/lib/heart";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { getCompanionProgress, summarizeBadges } from "@/lib/progress-companion";
import { StreakHero } from "@/components/progress/StreakHero";
import { BadgesGrid } from "@/components/progress/BadgesGrid";
import { RecordsList } from "@/components/progress/RecordsList";
import { roundTypeLabel, sparringLogDateLabel, sparringLogsForWeek, sparringMinutes, sparringTrend } from "@/lib/outside-log";
import { WeighInList } from "@/components/progress/WeighInList";
import { SparringTrend } from "@/components/progress/SparringTrend";
import { formatWorkoutCompleteDate } from "@/lib/workout-complete";
import { civilDayInstant } from "@/lib/performed-at";
import { memberFacingTitle } from "@/lib/member-copy";

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
    <article className="rounded-xl border border-line bg-card px-2.5 py-2">
      <p className="text-xs text-muted">{title}</p>
      <p className="font-telemetry mt-1 text-xl leading-none text-[#CBF805]">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
    </article>
  );
}

export default async function ProgressPage() {
  const user = await requireUser();
  const [profile, sessions, latestMetrics, weightHistory, photos, foodToday, foodWeek, heartTiles, showCharts, trial] =
    await Promise.all([
      getProfileForUser(user.id),
      listWorkoutSessionsForUser(user.id, {
        since: new Date(Date.now() - PROGRESS_HISTORY_DAYS * 86_400_000),
      }),
      getLatestBodyMetricsForUser(user.id),
      listBodyMetricsForUser(user.id, "weight"),
      listProgressPhotosForUser(user.id),
      getNutritionSummaryForDay(user.id),
      getRecentNutritionDays(user.id, 7),
      getProgressHeartTiles(user.id),
      canUseFeature(user.id, "progress"),
      getTrialState(user.id),
    ]);
  const showTrends = await canUseFeature(user.id, "sparring_trends");
  const units = profile?.preferredUnits ?? "lb";
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const sparringWeek = await sparringLogsForWeek(user.id, new Date(), tz);
  const trend = await sparringTrend(user.id, 16);
  const weightPoints = weightSeriesPoints(weightHistory, tz);
  const telemetry = await getHomeTelemetry({ userId: user.id, timeZone: tz });
  const camp = await getFightCampRow(user.id);
  const telemetryTitle = telemetryGraphTitle({
    status: camp?.status,
    fightDateKey: camp?.fightDateKey,
    todayKey: zonedDayKey(new Date(), tz),
  });
  const chartNow = new Date().toISOString();
  const shownWeights = weightHistory.map((row) => displayBodyMetric(row));
  const weighInDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const weighIns = shownWeights.map((row) => ({
    id: row.id,
    label: weighInDate.format(row.recordedAt),
    value: row.value,
    unit: row.unit,
  }));
  const massLine = massCaption(shownWeights[0] ?? null, shownWeights[1] ?? null, tz);
  const massGauge = massGaugeScale({
    value: shownWeights[0]?.value ?? null,
    goal: profile?.goalWeight ?? null,
    recent: shownWeights.map((row) => row.value),
  });
  const records = await getPersonalRecordsForUser(user.id, units);
  const companion = await getCompanionProgress(user.id, units);
  const badgeCounts = summarizeBadges(companion.badges);
  const summary = buildProgressSummary(sessions, units);
  const lastComplete = sessions.find((session) => sessionAppearsOnProgress(session));
  const lastWhen = lastComplete
    ? formatWorkoutCompleteDate(civilDayInstant(lastComplete.performedAt, tz), tz)
    : null;
  const lastTitle = summary.lastSessionTitle ? memberFacingTitle(summary.lastSessionTitle) : null;
  const weight = latestMetrics.get("weight");
  const sleep = latestMetrics.get("sleepHours");
  const typedHr = latestMetrics.get("restingHr");
  const lean = latestMetrics.get("leanMass");
  const fat = latestMetrics.get("bodyFat");
  const weekCalories = foodWeek.reduce((sum, day) => sum + day.calories, 0);
  const daysWithFood = foodWeek.filter((day) => day.entryCount > 0).length;

  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl uppercase tracking-wide">Progress</h1>
        <p className="font-display rounded-full bg-black px-3 py-1 text-sm uppercase tracking-wide text-highlighter">
          {badgeCounts.earned}/{badgeCounts.total} earned
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/heart"
          className="touch-target inline-flex min-h-11 items-center rounded-full border border-accent px-3 text-sm"
        >
          Heart rate
        </Link>
        <Link
          href="/training/history/bike"
          data-bike-history-link
          className="inline-flex h-8 items-center rounded-full border border-line px-3 text-sm"
        >
          Bike history
        </Link>
        <Link
          href="/profile"
          className="touch-target inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm"
          aria-label="Progress settings (profile)"
        >
          Settings
        </Link>
      </div>

      <section className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg">Streak</h2>
          <Link href="/progress/streaks" className="text-sm text-accent underline">
            Board
          </Link>
        </div>
        <StreakHero streak={companion.streak} />
      </section>

      <section className="hc-panel px-3 py-2">
        <p className="hc-kicker">Last session</p>
        <p className="mt-0.5 text-base font-semibold">
          {summary.sessionCount === 0 ? "None yet" : lastTitle}
          {lastWhen ? (
            <span data-last-session-date className="mt-1 block text-sm font-medium text-muted">
              {lastWhen}
            </span>
          ) : null}
        </p>
        {lastComplete ? (
          <Link
            href={`/training/log/${lastComplete.id}/done`}
            className="mt-1 inline-flex items-center text-sm text-accent underline"
          >
            Open
          </Link>
        ) : null}
      </section>

      <div data-progress-charts className="space-y-3">
      <section className="hc-panel hc-carbon space-y-2 px-2.5 py-2">
        <div>
          <p className="hc-kicker">Mass</p>
          <p className="font-telemetry mt-1 text-3xl leading-none text-[#CBF805]">
            {weight ? formatOneDecimal(weight.value) : "—"}
            {weight ? <span className="ml-2 text-base text-muted">{weight.unit}</span> : null}
          </p>
          <p className="mt-1 font-telemetry text-sm text-[#CBF805]" data-progress-body-fat>
            Body fat {fat ? `${fat.value}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {weight ? "Typed by you. The line is every weigh-in." : "Log a weigh-in below."}
          </p>
        </div>
        <BodyWeightChart
          points={weightPoints}
          unit={weightPoints[0]?.unit || weight?.unit || "lb"}
          now={chartNow}
        />
        {weight ? (
          <WeighInDisclosure startOpen={!fat}>
            <summary className="cursor-pointer text-sm font-semibold">Log another weigh-in</summary>
            <div className="mt-2">
              <HomeBodyWeight
                carbon={false}
                value={weight.value}
                unit={units === "kg" ? "lb" : units || "lb"}
                caption={massLine}
                gauge={massGauge}
                bodyFatValue={fat?.value ?? null}
              />
            </div>
          </WeighInDisclosure>
        ) : (
          <div id="log-body-fat" className="scroll-mt-4">
            <HomeBodyWeight
              carbon={false}
              value={null}
              unit={units === "kg" ? "lb" : units || "lb"}
              caption={massLine}
              gauge={massGauge}
              bodyFatValue={fat?.value ?? null}
            />
          </div>
        )}
      </section>

      <WeighInList rows={weighIns} />

      <HomeTelemetry data={telemetry} title={telemetryTitle} compact />

      <section className="hc-panel px-2.5 py-2" data-sparring-week>
        <p className="hc-kicker">Sparring</p>
        <h2 className="mt-0.5 text-base">This week</h2>
        <p className="font-telemetry mt-1 text-2xl leading-none text-[#CBF805]">
          {sparringWeek.rounds} rounds · {sparringWeek.minutes} min
        </p>
        <p className="mt-1 text-xs text-muted">
          Saved sparring logs only. Class and drilling days are not counted.
        </p>
        {sparringWeek.logs.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-sm">
            {sparringWeek.logs.map((log) => (
              <li key={log.dateKey}>
                {sparringLogDateLabel(log)}: {log.rounds} × {log.minutesPerRound} min
                {roundTypeLabel(log.roundType) ? ` · ${roundTypeLabel(log.roundType)}` : ""}
                {log.intensity ? ` · ${log.intensity}` : ""} ({sparringMinutes(log)} min)
                {log.partner ? ` · ${log.partner}` : ""}
                {log.sessionRating ? ` · session ${log.sessionRating}/5` : ""}
                {log.bodyRating ? ` · body ${log.bodyRating}/5` : ""}
                {log.notes ? <span className="mt-0.5 block text-muted">{log.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No sparring logged this week.</p>
        )}
      </section>

      {showTrends ? (
        <SparringTrend logs={trend} />
      ) : trend.length > 0 ? (
        <section data-trend-locked className="relative overflow-hidden rounded-2xl border border-line">
          <div aria-hidden className="pointer-events-none select-none p-4 blur-sm">
            <p className="text-xs uppercase tracking-wide text-muted">Sparring and body trend</p>
            <div className="mt-3 flex h-20 items-end gap-2">
              {[3, 4, 2, 5, 3, 4, 2, 4].map((h, i) => (
                <div key={i} className="w-full rounded bg-black/20" style={{ height: `${h * 18}%` }} />
              ))}
            </div>
          </div>
          <div className="border-t border-line bg-card">
            <UpgradePreview
              kind="charts"
              canStartTrial={trial.canStartTrial}
              trialDays={trial.trialLengthDays}
              next="/progress"
              framed={false}
            />
          </div>
        </section>
      ) : null}
      </div>

      <Link
        href="/progress/photos"
        className="hc-panel flex items-center justify-between gap-3 px-3 py-2"
      >
        <span>
          <span className="block font-semibold">Progress photos</span>
          <span className="text-sm text-muted">
            {photos.length === 0
              ? "Upload a date-stamped photo"
              : `${photos.length} saved · private to you`}
          </span>
        </span>
        <span aria-hidden className="text-muted">
          ›
        </span>
      </Link>

      <details className="rounded-2xl border border-line bg-card px-3 py-2">
        <summary className="cursor-pointer font-semibold">Badges</summary>
        <div className="mt-2 space-y-2">
          <nav className="flex items-center gap-2" aria-label="Progress sections">
            <Link
              href="/progress/records"
              className="progress-tab inline-flex h-8 items-center rounded-full border border-line px-3 text-sm"
            >
              Records
            </Link>
            <Link
              href="/progress/streaks"
              className="progress-tab inline-flex h-8 items-center rounded-full border border-line px-3 text-sm"
            >
              Streaks
            </Link>
            <span className="progress-tab inline-flex h-8 items-center rounded-full bg-black px-3 text-sm text-highlighter">
              Badges
            </span>
          </nav>
          <BadgesGrid
            badges={companion.badges}
            earned={badgeCounts.earned}
            total={badgeCounts.total}
            unit={units}
            showHeading={false}
          />
        </div>
      </details>

      <details className="rounded-2xl border border-line bg-card px-3 py-2">
        <summary className="cursor-pointer font-semibold">More</summary>
        <div className="mt-2 space-y-3">

      <section className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg">Personal records</h2>
          <Link href="/progress/records" className="text-sm text-accent underline">
            Charts
          </Link>
        </div>
        <RecordsList records={companion.records.slice(0, 4)} />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <MetricTile
          title="Resting Heart Rate"
          value={heartTiles.rhr?.value ?? (typedHr ? `${typedHr.value} ${typedHr.unit}` : "—")}
          hint={
            heartTiles.rhr?.hint ??
            (typedHr
              ? "Typed by you"
              : "Empty until you import Apple Health, type one, or pull Polar")
          }
        />
        <MetricTile
          title="Last workout HR"
          value={heartTiles.lastWorkout?.value ?? "—"}
          hint={
            heartTiles.lastWorkout?.hint ??
            "Avg / max — Apple Health import, manual, or Polar"
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
          value={weight ? `${formatOneDecimal(weight.value)} ${weight.unit}` : "—"}
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

      <BodyMetricForm preferredUnits={units} />

      {latestMetrics.size > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2>Latest typed metrics</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...latestMetrics.values()].map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
                <span>
                  {row.kind} · {row.value} {row.unit}
                  <span className="block text-xs text-muted">
                    {row.recordedAt.toLocaleString()}
                  </span>
                </span>
                <DeleteBodyMetricButton metricId={row.id} testId={`progress-form-${row.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PersonalRecordsBoard records={records} />

      <div>
        <h2 className="text-lg">Workout history</h2>
        <p className="mt-1 text-sm text-muted">
          Built only from workouts you logged. Lifting volume is reps × load in {units}.
          Bagwork adds rounds × minutes × RPE.
        </p>
      </div>

      {summary.sessionCount === 0 ? (
        <EmptyState
          title="Nothing to chart yet"
          action={
            <Link href="/training" className="text-accent underline">
              Log a session
            </Link>
          }
        >
          Progress is built only from workouts you save.
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2">
            <article className="rounded-xl border border-line bg-card px-2.5 py-2">
              <p className="text-xs uppercase text-muted">Sessions</p>
              <p className="mt-0.5 text-xl font-semibold leading-none">{summary.sessionCount}</p>
            </article>
            <article className="rounded-xl border border-line bg-card px-2.5 py-2">
              <p className="text-xs uppercase text-muted">Last session</p>
              <p className="mt-1 text-sm font-semibold">
                {lastTitle}
                {lastWhen ? (
                  <span className="mt-1 block text-xs font-medium text-muted">{lastWhen}</span>
                ) : null}
              </p>
              {lastComplete ? (
                <Link
                  href={`/training/log/${lastComplete.id}/done`}
                  className="mt-1 inline-flex items-center text-sm text-accent underline-offset-4 hover:underline"
                >
                  Share card
                </Link>
              ) : null}
            </article>
          </section>

          <section className="rounded-2xl border border-line bg-card p-3">
            <h2>Session volume ({units})</h2>
            {showCharts ? (
              <ProgressBars points={summary.points} timeZone={tz} />
            ) : (
              <div className="mt-3">
                <UpgradePreview
                  kind="charts"
                  canStartTrial={trial.canStartTrial}
                  trialDays={trial.trialLengthDays}
                  next="/progress"
                />
              </div>
            )}
          </section>

        </>
      )}
        </div>
      </details>
    </main>
  );
}
