import Link from "next/link";
import { Suspense } from "react";
import { CalendarList } from "@/components/training/CalendarList";
import { CalendarWeekFollow, type CalendarMoveBundle } from "@/components/training/CalendarWeekFollow";
import type { WeekCarouselWeek } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { requireUser } from "@/lib/session";
import {
  calendarFocusStatusSuffix,
  calendarPlanDoses,
  formatCalendarHeading,
  getCalendarSchedule,
  loggedSessionCardLine,
  subtitleCountsAsMissed,
  subtitleShowsPartial,
  weekdayName,
} from "@/lib/calendar";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { formatDayParam, parseDayParam } from "@/lib/home";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  moveDayChoices,
  planForDate,
  planWeekIndex,
  withBikeChipLogHrefs,
  withChipSessionIds,
  type MoveListedSession,
} from "@/lib/week-plan";
import {
  carouselFocusOffset,
  carouselLoggedRange,
  carouselWeekStrips,
  packCarouselWeeks,
} from "@/lib/week-carousel";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { easeWeekStripDays } from "@/lib/recovery-ease";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { isPlanWeekday, weekStartInRange, weekStartKey } from "@/lib/week-plan-swaps";
import { completedSessionIdsByLocalDay, offPlanMarksByLocalDay, partialLocalDayKeys, partialProgramIdsByLocalDay } from "@/lib/chip-completion";
import { chipDayRefs, chipMarksAfterPlans, chipPlanMarksByDay, withOverlaySessionIds } from "@/lib/chip-days";
import { listDayPlansForUser } from "@/lib/my-workouts";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { backfillDayState } from "@/lib/backfill-rules";

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
  const [swaps, catalog] = await Promise.all([
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
  const builtWeeks = carouselWeekStrips(prefs, now, tz, selected, swaps);
  const linkedWeeks = withBikeChipLogHrefs(
    await easeWeekStripDays(user.id, prefs, builtWeeks.days, tz, swaps),
    prefs,
    scaledCatalog,
    tz,
    swaps,
  );
  const chipWeeks: WeekCarouselWeek[] = packCarouselWeeks(
    builtWeeks.anchors,
    withChipSessionIds(linkedWeeks, prefs, scaledCatalog, tz, swaps),
  ).map((week) => ({
    ...week,
    rearrange: weekStartInRange(week.weekStart, weekStartKey(now, tz)),
  }));
  const focusOffset = carouselFocusOffset(chipWeeks);
  const dayParam = formatDayParam(selected, tz);
  const todayKey = formatDayParam(now, tz);
  const viewedWeek = weekStartKey(selected, tz);
  const currentWeek = weekStartKey(now, tz);
  const canEditWeek = weekStartInRange(viewedWeek, currentWeek);
  const loggedWindow = carouselLoggedRange(now, tz);
  const planByDay = await calendarPlanDoses(user.id, now);
  const carouselKeys = chipWeeks.flatMap((week) => week.days.map((day) => day.dayParam));
  const [completedByDay, partialDays, partialByDay, offPlan, carouselPlans, weekSchedules] = await Promise.all([
    completedSessionIdsByLocalDay(user.id, loggedWindow.from, loggedWindow.to, tz, now),
    partialLocalDayKeys(user.id, loggedWindow.from, loggedWindow.to, tz, planByDay),
    partialProgramIdsByLocalDay(user.id, loggedWindow.from, loggedWindow.to, tz, planByDay),
    offPlanMarksByLocalDay(user.id, loggedWindow.from, loggedWindow.to, tz),
    listDayPlansForUser(user.id, carouselKeys),
    Promise.all(chipWeeks.map((week) => getCalendarSchedule(user.id, now, week.days[0]?.date ?? now))),
  ]);
  const marks = chipMarksAfterPlans({
    days: chipDayRefs(chipWeeks),
    completedByDay,
    partialDays,
    partialByDay,
    plansByDay: chipPlanMarksByDay(carouselPlans),
    offPlan,
  });
  const markedWeeks = withOverlaySessionIds(chipWeeks, marks.sessionIdsByDay);
  const selectedWeekday = weekdayName(selected, tz);
  const levelQuery = levelOverride ? `&level=${levelOverride}` : "";
  const todayHref = `/training/calendar?day=${todayKey}${levelQuery}`;
  const logPastDayKeys = [
    ...new Set(
      chipWeeks
        .flatMap((week) => week.days.map((day) => day.dayParam))
        .filter((key) => backfillDayState(key, now, tz) === "ok"),
    ),
  ];
  const moves: Record<string, CalendarMoveBundle> = {};
  const panels = markedWeeks.map((week, index) => {
    const weekSchedule = weekSchedules[index];
    if (!weekSchedule) return null;
    const focus =
      weekSchedule.days.find((day) => weekdayName(day.date, tz) === selectedWeekday) ??
      weekSchedule.days[0];
    const focusPlan = focus ? planForDate(prefs, focus.date, tz, swaps) : dayPlan;
    const workouts = focus?.activities.filter((item) => item.kind === "workout") ?? [];
    const focusKey = focus ? formatDayParam(focus.date, tz) : dayParam;
    const statusSuffix = calendarFocusStatusSuffix({
      workouts,
      past: focusKey < todayKey,
      active: focus?.active ?? focusPlan.active,
    });
    const loggedSessions = workouts.filter(
      (item) => item.status === "complete" || subtitleShowsPartial(item.subtitle),
    );
    const missedWorkouts = weekSchedule.days.reduce(
      (count, day) => count + day.activities.filter((item) => subtitleCountsAsMissed(item.subtitle)).length,
      0,
    );
    const titles: Partial<Record<(typeof week.days)[number]["weekday"], MoveListedSession[]>> = {};
    for (const day of weekSchedule.days) {
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
    moves[week.weekStart] = {
      editable: Boolean(week.rearrange),
      days: moveDayChoices(prefs, now, tz, week.days[0]?.date ?? selected, swaps, titles),
    };
    const visible = week.weekStart === viewedWeek;
    return (
      <div
        key={week.weekStart}
        data-calendar-panel={week.weekStart}
        hidden={visible ? undefined : true}
        inert={visible ? undefined : true}
        className="space-y-6"
      >
        <section data-selected-day-plan className="space-y-2">
          <p className="font-display text-xs uppercase tracking-wide text-accent">
            {focus ? formatCalendarHeading(focus.date, now, tz) : formatCalendarHeading(selected, now, tz)}
            {statusSuffix}
            {focus?.movedFrom || focusPlan.movedFrom
              ? ` · ${(focus?.movedFrom || focusPlan.movedFrom)}’s workout`
              : ""}
            {focusPlan.mesoLabel ? ` · ${focusPlan.mesoLabel}` : ""}
          </p>
          <h2 className="text-lg" data-calendar-day-summary>
            {focus?.summary || focusPlan.summary}
          </h2>
          {focus?.movedFrom || focusPlan.movedFrom ? (
            <p className="text-sm text-muted" data-moved-workout>
              {(focus?.movedFrom || focusPlan.movedFrom)}’s workout, on {focusPlan.weekday} this week.
            </p>
          ) : null}
          {loggedSessions.map((item, index) => (
            <p
              key={`${item.title}-${item.subtitle}-${index}`}
              className="text-sm text-muted"
              data-completed-summary
            >
              {loggedSessionCardLine(item)}
            </p>
          ))}
          {focusPlan.skipReason && !(focus?.active ?? focusPlan.active) ? (
            <p className="text-sm text-muted">{focusPlan.skipReason}</p>
          ) : null}
          {backfillDayState(focusKey, now, tz) === "ok" ? (
            <LogPastWorkoutButton dayKey={focusKey} entry="calendar" label="Log a completed workout" />
          ) : null}
        </section>

        {weekSchedule.days.every((day) => day.activities.every((item) => item.kind !== "workout")) ? (
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

        <div>
          <h2 className="text-lg" data-calendar-week-title>
            {week.label}
          </h2>
          <p data-calendar-week-range className="text-sm text-muted">
            {week.rangeLabel}
          </p>
        </div>
        <CalendarList
          days={weekSchedule.days}
          coachName={weekSchedule.coachName}
          coachImage={weekSchedule.coachImage}
          weekLabel={week.label}
        />
      </div>
    );
  });

  return (
    <main className="min-w-0 space-y-6" data-coach-page>
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">Calendar</h1>
          </div>
        </div>
      </div>

      <CalendarWeekFollow
        weeks={markedWeeks}
        completedDays={marks.loggedDays}
        completedByDay={marks.completedByDay}
        partialDays={marks.partialDays}
        focusOffset={focusOffset}
        todayHref={todayHref}
        initialWeekStart={viewedWeek}
        logPastDayKeys={logPastDayKeys}
        level={levelOverride}
        moves={moves}
        rearrange={canEditWeek}
      >
        {fromProfile ? null : (
          <Suspense fallback={null}>
            <TrainingLevelToggle
              band={band}
              dayParam={dayParam}
              fromProfile={fromProfile}
              basePath="/training/calendar"
            />
          </Suspense>
        )}
        {panels}
      </CalendarWeekFollow>
    </main>
  );
}
