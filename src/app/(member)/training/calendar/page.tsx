import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { CalendarList } from "@/components/training/CalendarList";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { SessionDetails } from "@/components/training/SessionDetails";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { requireUser } from "@/lib/session";
import { getCalendarSchedule } from "@/lib/calendar";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { formatDayParam, parseDayParam, sameLocalDay } from "@/lib/home";
import {
  planForDate,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import {
  scaleBandFromPrefs,
  scaleDemoCatalog,
  type ScaleBand,
} from "@/lib/training-scale";
import { bikeZoneForDayNumber } from "@/lib/train-extras";
import { listDraftSessionsForUser } from "@/lib/workouts";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { addZonedDays, mondayOfZoned, zonedParts } from "@/lib/timezone";
import { weekStartInRange, weekStartKey } from "@/lib/week-plan-swaps";

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
  const [schedule, catalog, drafts, swaps] = await Promise.all([
    getCalendarSchedule(user.id, now, selected),
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
    getWeekPlanSwapsForUser(user.id),
  ]);
  const levelOverride = parseLevelParam(params.level);
  const profileBand = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const band = levelOverride ?? profileBand;
  const fromProfile = Boolean(profile?.experienceLevel) && !levelOverride;
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
  };
  const dayPlan = planForDate(prefs, selected, tz, swaps);
  const planned = resolvePlanSessions(
    dayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: band,
      competitionStatus: levelOverride ? null : profile?.competitionStatus,
    }),
  );
  const strip = weekStrip(prefs, now, tz, selected, swaps, selected);
  const dayParam = formatDayParam(selected, tz);
  const isToday = sameLocalDay(selected, now, tz);
  const viewedMonday = mondayOfZoned(selected, tz);
  const viewedWeek = weekStartKey(selected, tz);
  const currentWeek = weekStartKey(now, tz);
  const canEditWeek = weekStartInRange(viewedWeek, currentWeek);
  const previousMonday = addZonedDays(viewedMonday, -7, tz);
  const nextMonday = addZonedDays(viewedMonday, 7, tz);
  const canPrev = weekStartInRange(weekStartKey(previousMonday, tz), currentWeek);
  const canNext = weekStartInRange(weekStartKey(nextMonday, tz), currentWeek);
  const completedDays = schedule.days
    .filter((day) =>
      day.activities.some((item) => item.kind === "workout" && item.status === "complete"),
    )
    .map((day) => formatDayParam(day.date, tz));
  const selectedLogged = completedDays.includes(dayParam);
  const selectedPast = dayParam < formatDayParam(now, tz);
  const selectedMissed = selectedPast && dayPlan.active && !selectedLogged;
  const weekTitle =
    viewedWeek === currentWeek
      ? "This week"
      : `Week of ${viewedMonday.toLocaleDateString("en-US", { month: "short", timeZone: tz })} ${zonedParts(viewedMonday, tz).day}`;
  const levelQuery = levelOverride ? `&level=${levelOverride}` : "";
  const weekHref = (date: Date) =>
    `/training/calendar?day=${formatDayParam(date, tz)}${levelQuery}`;
  const zones = [
    ...new Map(
      planned.flatMap((session) => {
        const zone = bikeZoneForDayNumber(session.dayNumber);
        return zone ? [[zone.label, zone] as const] : [];
      }),
    ).values(),
  ];
  const draftsByDay = new Map(
    drafts
      .filter((session) => session.programDayId)
      .map((session) => [session.programDayId as string, session.id]),
  );

  return (
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl">Calendar</h1>
            <p className="mt-1 text-sm text-muted">
              Previous shows days you already had, including logged workouts. Hold a day,
              then tap another, to move a missed workout onto a later day
              {schedule.programTitle ? ` · ${schedule.programTitle}` : ""}. Not a live
              coach calendar, Watch sync, or Gymdesk.
            </p>
          </div>
          <DemoBadge />
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

      <section
        className="space-y-3"
        data-selected-day-plan
        data-day-history={selectedLogged ? "logged" : selectedMissed ? "missed" : undefined}
      >
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">
            {isToday ? "Today" : selectedPast ? "Past" : "Selected"} · {dayPlan.weekday}
            {selectedLogged ? " · Logged" : selectedMissed ? " · Missed" : ""}
            {dayPlan.movedFrom ? ` · ${dayPlan.movedFrom}’s workout` : ""}
            {dayPlan.mesoLabel ? ` · ${dayPlan.mesoLabel}` : ""}
          </p>
          <h2 className="mt-1 text-lg">
            {dayPlan.active ? dayPlan.summary : dayPlan.summary}
          </h2>
          {dayPlan.movedFrom ? (
            <p className="mt-1 text-sm text-muted" data-moved-workout>
              {dayPlan.movedFrom}’s workout, on {dayPlan.weekday} this week.
            </p>
          ) : null}
          {dayPlan.skipReason && !dayPlan.active ? (
            <p className="mt-1 text-sm text-muted">{dayPlan.skipReason}</p>
          ) : null}
        </div>
        {planned.map((session) => (
          <PlanSessionCard
            key={`${session.slot}-${session.dayId ?? session.label}`}
            session={session}
            compact
            highlight={session.slot === "A" && planned.length > 1}
            draftId={session.dayId ? draftsByDay.get(session.dayId) : undefined}
          />
        ))}
        {dayPlan.active ? (
          <SessionDetails>
            <Link
              href="/mobility/daily-warmup/play"
              className="block rounded-2xl border border-line bg-background px-4 py-3"
            >
              <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
              <p className="mt-1 font-semibold">Dynamic warm-up · 3–4 min</p>
              <p className="mt-1 text-sm text-muted">
                Joint circles and leg swings before bag or lifts.
              </p>
            </Link>
            {zones.map((zone) => (
              <BikeZoneNote key={zone.label} zone={zone} />
            ))}
          </SessionDetails>
        ) : null}
        {dayPlan.active ? (
          <Link href="/mobility" className="block rounded-2xl border border-line bg-card px-4 py-4">
            <p className="font-display text-xs uppercase tracking-wide text-accent">Cool-down</p>
            <h3 className="mt-1 text-lg">Mobility / cooldown</h3>
            <p className="mt-1 text-sm text-muted">Hips, splits, neck after you train.</p>
          </Link>
        ) : null}
      </section>

      {schedule.days.every((day) => day.activities.every((item) => item.kind !== "workout")) ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          DEMO training days are not loaded on this preview yet. Your account is fine. Open
          Training when the template is seeded.
        </p>
      ) : null}

      <h2 className="text-lg">{weekTitle}</h2>
      <CalendarList days={schedule.days} />
    </main>
  );
}
