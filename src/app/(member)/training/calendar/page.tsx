import Link from "next/link";
import { CalendarList } from "@/components/training/CalendarList";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import { requireUser } from "@/lib/session";
import { formatCalendarHeading, getCalendarSchedule, weekdayName } from "@/lib/calendar";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { formatDayParam, parseDayParam } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  moveDayChoices,
  planForDate,
  planWeekIndex,
  weekStrip,
  withBikeChipLogHrefs,
  type MoveListedSession,
} from "@/lib/week-plan";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { easeWeekStripDays } from "@/lib/recovery-ease";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { addZonedDays, mondayOfZoned, zonedParts } from "@/lib/timezone";
import { isPlanWeekday, weekStartInRange, weekStartKey } from "@/lib/week-plan-swaps";
import { completedLocalDayKeys } from "@/lib/workouts";

function parseLevelParam(value: string | undefined): ScaleBand | null {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return null;
}

export default async function TrainingCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; level?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const profile = await getProfileForUser(user.id);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const selected = parseDayParam(params.day, now, tz);
  const [schedule, swaps, catalog] = await Promise.all([
    getCalendarSchedule(user.id, now, selected),
    getWeekPlanSwapsForUser(user.id),
    findDemoTrainingCatalog(),
  ]);
  const levelOverride = parseLevelParam(params.level);
  const profileBand = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const band = levelOverride ?? profileBand;
  const fromProfile = Boolean(profile?.experienceLevel) && !levelOverride;
  const camp = await getActiveCampSnapshot(user.id, selected, tz);
  const campWeekIndex = campPlanWeekIndex(camp);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: user.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
    forcedWeekIndex: campWeekIndex,
  };
  const corePlan = planForDate(prefs, selected, tz, swaps);
  const dayPlan =
    camp && camp.weightClass.trim() && camp.phase !== "complete" && camp.phase !== "pre-camp"
      ? shapeDayPlan(corePlan, camp.phase)
      : corePlan;
  const weekIndex = campWeekIndex ?? planWeekIndex(selected, tz, profile?.onboardingCompletedAt ?? null);
  const scaledCatalog = scaleDemoCatalog(catalog, {
    experienceLevel: band,
    competitionStatus: levelOverride ? null : profile?.competitionStatus,
    weightAccess: normalizeWeightAccess(profile?.weightAccess),
    weekIndex,
  });
  const strip = withBikeChipLogHrefs(
    await easeWeekStripDays(
      user.id,
      prefs,
      weekStrip(prefs, now, tz, selected, swaps, selected),
      tz,
      swaps,
    ),
    prefs,
    scaledCatalog,
    tz,
    swaps,
  );
  const dayParam = formatDayParam(selected, tz);
  const viewedMonday = mondayOfZoned(selected, tz);
  const viewedWeek = weekStartKey(selected, tz);
  const currentWeek = weekStartKey(now, tz);
  const canEditWeek = weekStartInRange(viewedWeek, currentWeek);
  const previousMonday = addZonedDays(viewedMonday, -7, tz);
  const nextMonday = addZonedDays(viewedMonday, 7, tz);
  const canPrev = weekStartInRange(weekStartKey(previousMonday, tz), currentWeek);
  const canNext = weekStartInRange(weekStartKey(nextMonday, tz), currentWeek);
  const activityDays = schedule.days
    .filter((day) =>
      day.activities.some((item) => item.kind === "workout" && item.status === "complete"),
    )
    .map((day) => formatDayParam(day.date, tz));
  const loggedDays = await completedLocalDayKeys(
    user.id,
    addZonedDays(viewedMonday, -1, tz),
    addZonedDays(viewedMonday, 8, tz),
    tz,
  );
  const completedDays = [...new Set([...activityDays, ...loggedDays])];
  const selectedLogged = completedDays.includes(dayParam);
  const selectedPast = dayParam < formatDayParam(now, tz);
  const selectedSummary = schedule.days
    .find((day) => formatDayParam(day.date, tz) === dayParam)
    ?.activities.find((item) => item.kind === "workout" && item.status === "complete")?.subtitle;
  const selectedRow = schedule.days.find((day) => formatDayParam(day.date, tz) === dayParam);
  const selectedMissed = selectedPast && (selectedRow?.active ?? dayPlan.active) && !selectedLogged;
  const missedWorkouts = schedule.days.reduce(
    (count, day) => count + day.activities.filter((item) => item.subtitle.startsWith("Missed")).length,
    0,
  );
  const weekTitle =
    viewedWeek === currentWeek
      ? "This week"
      : `Week of ${viewedMonday.toLocaleDateString("en-US", { month: "short", timeZone: tz })} ${zonedParts(viewedMonday, tz).day}`;
  const titles: Partial<Record<(typeof strip)[number]["weekday"], MoveListedSession[]>> = {};
  for (const day of schedule.days) {
    const name = weekdayName(day.date, tz);
    if (!isPlanWeekday(name)) continue;
    titles[name] = day.activities
      .filter((item) => item.kind === "workout")
      .map((item) => ({
        title: item.title,
        sessionKey: item.sessionKey,
        completed: item.status === "complete",
        heavy: item.heavy,
      }));
  }
  const moveDays = moveDayChoices(prefs, now, tz, selected, swaps, titles);
  const levelQuery = levelOverride ? `&level=${levelOverride}` : "";
  const weekHref = (date: Date) =>
    `/training/calendar?day=${formatDayParam(date, tz)}${levelQuery}`;

  return (
    <WorkoutMoveProvider
      editable={canEditWeek}
      weekStart={viewedWeek}
      days={moveDays}
    >
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">Calendar</h1>
            <p className="mt-1 text-sm text-muted">
              Tap Move on a session to do it today, move it, or swap it.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
      <nav aria-label="Week" data-week-nav className="flex items-center justify-between gap-2">
        {canPrev ? (
          <Link
            href={weekHref(previousMonday)}
            data-week-prev
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-3 text-sm font-semibold"
          >
            Previous
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center px-3 text-sm text-muted">Previous</span>
        )}
        <p className="text-center text-sm font-semibold" data-week-label>
          {weekTitle}
        </p>
        {canNext ? (
          <Link
            href={weekHref(nextMonday)}
            data-week-next
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-3 text-sm font-semibold"
          >
            Next
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center px-3 text-sm text-muted">Next</span>
        )}
      </nav>

      <WeekStrip
        days={strip}
        basePath="/training/calendar"
        rearrange={canEditWeek}
        weekStart={viewedWeek}
        completedDays={completedDays}
      />
      </div>

      {fromProfile ? null : (
        <TrainingLevelToggle
          band={band}
          dayParam={dayParam}
          fromProfile={fromProfile}
          basePath="/training/calendar"
        />
      )}

      <section data-selected-day-plan className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wide text-accent">
          {formatCalendarHeading(selected, now, tz)}
          {selectedLogged ? " · Logged" : selectedMissed ? " · Missed" : ""}
          {dayPlan.movedFrom ? ` · ${dayPlan.movedFrom}’s workout` : ""}
          {dayPlan.mesoLabel ? ` · ${dayPlan.mesoLabel}` : ""}
        </p>
        <h2 className="text-lg" data-calendar-day-summary>
          {selectedRow?.summary || dayPlan.summary}
        </h2>
        {(selectedRow?.movedFrom || dayPlan.movedFrom) ? (
          <p className="text-sm text-muted" data-moved-workout>
            {(selectedRow?.movedFrom || dayPlan.movedFrom)}’s workout, on {dayPlan.weekday} this week.
          </p>
        ) : null}
        {selectedSummary ? (
          <p className="text-sm text-muted" data-completed-summary>
            {selectedSummary}
          </p>
        ) : null}
        {dayPlan.skipReason && !dayPlan.active ? (
          <p className="text-sm text-muted">{dayPlan.skipReason}</p>
        ) : null}
      </section>

      {schedule.days.every((day) => day.activities.every((item) => item.kind !== "workout")) ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          Training days are not loaded on this preview yet. Your account is fine. Open
          Training when the template is seeded.
        </p>
      ) : null}

      {missedWorkouts > 0 ? (
        <aside data-missed-note className="rounded-2xl bg-black px-4 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-wide text-highlighter">
            Missed a workout?
          </p>
          <p className="mt-1 text-sm text-white/80">
            Move one session, or the whole day, onto a day that fits.
          </p>
        </aside>
      ) : null}

      <h2 className="text-lg">{weekTitle}</h2>
      <CalendarList
        days={schedule.days}
        coachName={schedule.coachName}
        coachImage={schedule.coachImage}
      />
    </main>
    </WorkoutMoveProvider>
  );
}
