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
  const [schedule, profile, catalog, drafts] = await Promise.all([
    getCalendarSchedule(user.id),
    getProfileForUser(user.id),
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
  ]);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const selected = parseDayParam(params.day, now, tz);
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
  const dayPlan = planForDate(prefs, selected, tz);
  const planned = resolvePlanSessions(
    dayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: band,
      competitionStatus: levelOverride ? null : profile?.competitionStatus,
    }),
  );
  const strip = weekStrip(prefs, now, tz, selected);
  const dayParam = formatDayParam(selected, tz);
  const isToday = sameLocalDay(selected, now, tz);
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
              Tap a day chip to open that day’s full Core plan
              {schedule.programTitle ? ` · ${schedule.programTitle}` : ""}. Not a live
              coach calendar, Watch sync, or Gymdesk.
            </p>
          </div>
          <DemoBadge />
        </div>
      </div>

      <WeekStrip days={strip} basePath="/training/calendar" />

      {fromProfile ? null : (
        <TrainingLevelToggle
          band={band}
          dayParam={dayParam}
          fromProfile={fromProfile}
          basePath="/training/calendar"
        />
      )}

      <section className="space-y-3" data-selected-day-plan>
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">
            {isToday ? "Today" : "Selected"} · {dayPlan.weekday}
            {dayPlan.mesoLabel ? ` · ${dayPlan.mesoLabel}` : ""}
          </p>
          <h2 className="mt-1 text-lg">
            {dayPlan.active ? dayPlan.summary : dayPlan.summary}
          </h2>
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

      <h2 className="text-lg">Upcoming list</h2>
      <CalendarList days={schedule.days} />
    </main>
  );
}
