import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  countWorkoutSessionsForUser,
  listDraftSessionsForUser,
} from "@/lib/workouts";
import { canUseFeature } from "@/lib/entitlements";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { skillEquipmentNote } from "@/lib/skill-programs";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { mesoBlockForWeekIndex, mesoBlockLabel } from "@/lib/mesocycle";
import { isDeloadWeek, isTestingWeek, DELOAD_LABEL } from "@/lib/training-cycle";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { bikeZoneForDayNumber, emphasisAccessoryLine } from "@/lib/train-extras";
import { TrainWeekBoard } from "@/components/training/TrainWeekBoard";
import { plyoBlockFor, PLYO_CREDITS, PLYO_MINUTES } from "@/lib/training-emphasis";
import {
  buildCoreWeekPlan,
  nextActiveWeekday,
  planForDate,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { RirExplainer } from "@/components/training/RirExplainer";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { ProPill } from "@/components/pro/ProPill";
import { formatDayParam, parseDayParam, sameLocalDay } from "@/lib/home";

function parseLevelParam(value: string | undefined): ScaleBand | null {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return null;
}

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; level?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const [catalog, drafts, sessionCount, conditioning, profile] = await Promise.all([
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
    countWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
  ]);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
  };
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const selected = parseDayParam(params.day, now, tz);
  const levelOverride = parseLevelParam(params.level);
  const profileBand = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const band = levelOverride ?? profileBand;
  const fromProfile = Boolean(profile?.experienceLevel) && !levelOverride;
  const camp = await getActiveCampSnapshot(user.id, selected, tz);
  const dayPlan =
    camp && camp.phase !== "complete"
      ? shapeDayPlan(planForDate(prefs, selected, tz), camp.phase)
      : planForDate(prefs, selected, tz);
  const planned = resolvePlanSessions(
    dayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: band,
      competitionStatus: levelOverride ? null : profile?.competitionStatus,
    }),
  );
  const strip = weekStrip(prefs, now, tz, selected);
  const week = buildCoreWeekPlan(prefs, bikeWeekIndex(selected, tz));
  const nextDay = dayPlan.active ? null : nextActiveWeekday(prefs, selected, tz);
  const weekIndex = bikeWeekIndex(selected, tz);
  const deload = isDeloadWeek(selected, tz);
  const testing = isTestingWeek(selected, tz);
  const emphasis = profile?.trainingEmphasis ?? "balanced";
  const showPlyo = dayPlan.weekday === "Monday" || dayPlan.weekday === "Wednesday";
  const plyo = showPlyo && dayPlan.active ? plyoBlockFor(emphasis) : [];
  const hasSkill = planned.some((session) => session.kind === "skill");
  const equipmentNote = hasSkill ? skillEquipmentNote(profile?.equipment) : "";
  const isToday = sameLocalDay(selected, now, tz);
  const dayParam = formatDayParam(selected, tz);
  const draftsByDay = new Map(
    drafts
      .filter((session) => session.programDayId)
      .map((session) => [session.programDayId as string, session.id]),
  );

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Training</h1>
          <p className="mt-1 text-sm text-muted">
            {camp && camp.phase !== "complete" && camp.phase !== "pre-camp"
              ? `Fight camp is on. This day follows the ${camp.phaseLabel.toLowerCase()}.`
              : "Core week plan (DEMO) — tap a day chip to open that day’s bag, lift, and bike. Not Elite coaching or a custom fight camp."}
          </p>
          <p className="font-display mt-2 text-xs uppercase tracking-wide text-accent">
            {mesoBlockLabel(mesoBlockForWeekIndex(weekIndex))}
          </p>
        </div>
        <DemoBadge />
      </div>

      <RirExplainer />

      {camp ? (
        <Link href="/fight-camp" className="block rounded-[1.75rem] bg-black px-5 py-5 text-white">
          <span className="flex items-center gap-2">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Today&apos;s camp focus</span>
            <ProPill />
          </span>
          <span className="mt-2 block font-display text-2xl uppercase tracking-wide text-white">
            {camp.weekNumber
              ? `Week ${camp.weekNumber} of ${camp.templateWeeks} · ${camp.phaseLabel}`
              : camp.phaseLabel}
          </span>
          <span className="mt-2 block text-sm text-white/80">{camp.todayFocus}</span>
        </Link>
      ) : (
        <Link href="/fight-camp" className="block rounded-[1.5rem] border border-line bg-white px-4 py-4">
          <span className="flex items-center gap-2">
            <span className="font-display text-lg uppercase tracking-wide">Fight camp</span>
            <ProPill />
          </span>
          <span className="mt-1 block text-sm text-muted">
            Week-by-week camp from your fight date.
          </span>
        </Link>
      )}

      <WeekStrip days={strip} basePath="/training" />

      <TrainingLevelToggle
        band={band}
        dayParam={dayParam}
        fromProfile={fromProfile}
        basePath="/training"
      />

      <TrainWeekBoard week={week} weekIndex={weekIndex} emphasis={emphasis} />

      {deload ? (
        <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
      ) : null}
      {testing ? (
        <Link href="/training/testing" className="block rounded-[1.5rem] bg-black px-5 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">This week</p>
          <h2 className="mt-1 text-2xl text-white">Testing Week</h2>
          <p className="mt-1 text-sm text-white/70">Broad jump, strength estimate, bike sprint, 5-minute bike.</p>
        </Link>
      ) : (
        <p className="text-sm">
          <Link href="/training/testing" className="font-semibold text-accent">
            Testing Week
          </Link>
          <span className="text-muted"> — every 8 weeks. Results stay on your account.</span>
        </p>
      )}

      <Link
        href="/timer"
        className="block rounded-[2rem] bg-black px-5 py-5 text-white"
      >
        <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">
          Free tool
        </p>
        <h2 className="mt-2 text-2xl text-white">Round timer</h2>
        <p className="mt-1 text-sm text-white/70">
          Bag, pads, or sparring. 3 × 3 min, 5 × 5 min, or set your own rounds.
        </p>
      </Link>

      <p className="text-sm">
        <Link href="/training/calendar" className="font-semibold text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        <span className="text-muted"> — this week’s Core days in a list</span>
      </p>

      <section className="space-y-3" data-selected-day-plan>
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">
            {isToday ? "Today’s plan" : "Selected day"} · {dayPlan.weekday}
          </p>
          <h2 className="mt-1 text-lg">
            {dayPlan.active
              ? dayPlan.summary
              : nextDay
                ? `Rest · next up ${nextDay}`
                : "Rest day"}
          </h2>
          {dayPlan.skipReason && !dayPlan.active ? (
            <p className="mt-1 text-sm text-muted">{dayPlan.skipReason}</p>
          ) : null}
          {equipmentNote ? <p className="mt-1 text-sm text-muted">{equipmentNote}</p> : null}
        </div>
        {dayPlan.active ? (
          <Link href="/mobility/daily-warmup/play" className="block rounded-2xl border border-line bg-card px-4 py-4">
            <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
            <h3 className="mt-1 text-lg">Dynamic warm-up · 3–4 min</h3>
            <p className="mt-1 text-sm text-muted">Joint circles and leg swings. Save long holds for the cooldown.</p>
          </Link>
        ) : null}
        {plyo.length > 0 ? (
          <section className="rounded-2xl border border-line bg-card px-4 py-4">
            <p className="font-display text-xs uppercase tracking-wide text-accent">
              Before the lifts · {PLYO_MINUTES}
            </p>
            <h3 className="mt-1 text-lg">Plyo / power</h3>
            <p className="mt-1 text-sm text-muted">{emphasisAccessoryLine(emphasis)}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {plyo.map((drill) => (
                <li key={drill.name}>
                  <span className="font-semibold">{drill.name}</span> · {drill.prescription}
                  <span className="block text-muted">{drill.cues}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Landing idea from{" "}
              <a href={PLYO_CREDITS[0].url} className="underline" target="_blank" rel="noreferrer">
                {PLYO_CREDITS[0].coach}
              </a>
              . Not their program.
            </p>
          </section>
        ) : null}
        {planned.map((session) => {
          const zone = bikeZoneForDayNumber(session.dayNumber);
          return (
          <div key={`${session.slot}-${session.dayId ?? session.label}`} className="space-y-2">
            {zone ? <BikeZoneNote zone={zone} /> : null}
          <PlanSessionCard
            session={session}
            compact
            highlight={session.slot === "A" && planned.length > 1}
            draftId={session.dayId ? draftsByDay.get(session.dayId) : undefined}
          />
          </div>
          );
        })}
        {dayPlan.active ? (
          <Link href="/mobility" className="block rounded-2xl border border-line bg-card px-4 py-4">
            <p className="font-display text-xs uppercase tracking-wide text-accent">Cooldown-off</p>
            <h3 className="mt-1 text-lg">Mobility / cooldown</h3>
            <p className="mt-1 text-sm text-muted">Hips, splits, neck, and the long holds after you train.</p>
          </Link>
        ) : null}
      </section>

      <p className="text-sm">
        <Link href="/training/travel" className="font-semibold text-accent">
          No gym / travel day
        </Link>
        <span className="text-muted"> — kettlebell or a bodyweight circuit.</span>
      </p>
      <p className="text-sm">
        <Link href="/mobility" className="font-semibold text-accent">
          Mobility
        </Link>
        <span className="text-muted"> — hips, splits, neck, and the cooldown. </span>
        <Link href="/mobility/drills" className="font-semibold text-accent">
          Hip and kick drill ideas
        </Link>
        <span className="text-muted"> sit with the plyo add-ons.</span>
      </p>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>Fighter Conditioning</h2>
        {conditioning ? (
          <p className="mt-2 text-sm text-muted">
            Shared combat S&amp;C / mobility blocks publish here when ready. This Core
            week stays labeled DEMO and is not a 1:1 assigned fight camp.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Structured fighter conditioning is on the $49 / $59 plan.{" "}
            <Link href="/pricing" className="text-accent underline">
              See App Plans
            </Link>
          </p>
        )}
      </section>

      <details className="rounded-2xl border border-line bg-card p-5">
        <summary className="cursor-pointer font-semibold">This Core week</summary>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.values(week).map((day) => (
            <li key={day.weekday} className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0">
              <span className="font-medium">{day.weekday}</span>
              <span className="text-right text-muted">
                {day.active
                  ? day.sessions.map((session) => session.label).join(" + ")
                  : day.summary}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-sm">
        <Link href="/training/calendar" className="text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        {" · "}
        <Link href="/training/history" className="text-accent underline-offset-4 hover:underline">
          Workout history ({sessionCount})
        </Link>
      </p>
    </main>
  );
}
