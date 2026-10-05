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
import { plyoBlockFor, PLYO_CREDITS, PLYO_MINUTES } from "@/lib/training-emphasis";
import {
  nextActiveWeekday,
  planForDate,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { NextSessionCta } from "@/components/training/NextSessionCta";
import { SessionDetails } from "@/components/training/SessionDetails";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { equipmentForExercises } from "@/lib/exercise-media";
import { nextTrainAction } from "@/lib/train-next";
import { getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { ProPill } from "@/components/pro/ProPill";
import { formatDayParam, parseDayParam, sameLocalDay } from "@/lib/home";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";

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
  const [catalog, drafts, sessionCount, conditioning, profile, swaps] = await Promise.all([
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
    countWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
    getWeekPlanSwapsForUser(user.id),
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
  const corePlan = planForDate(prefs, selected, tz, swaps);
  const dayPlan =
    camp && camp.phase !== "complete" ? shapeDayPlan(corePlan, camp.phase) : corePlan;
  const planned = resolvePlanSessions(
    dayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: band,
      competitionStatus: levelOverride ? null : profile?.competitionStatus,
    }),
  );
  const strip = weekStrip(prefs, now, tz, selected, swaps);
  const nextDay = dayPlan.active ? null : nextActiveWeekday(prefs, selected, tz, swaps);
  const weekIndex = bikeWeekIndex(selected, tz);
  const deload = isDeloadWeek(selected, tz);
  const testing = isTestingWeek(selected, tz);
  const emphasis = profile?.trainingEmphasis ?? "balanced";
  const showPlyo = dayPlan.weekday === "Monday" || dayPlan.weekday === "Wednesday";
  const plyo = showPlyo && dayPlan.active ? plyoBlockFor(emphasis) : [];
  const hasSkill = planned.some((session) => session.kind === "skill");
  const equipmentNote = hasSkill ? skillEquipmentNote(profile?.equipment) : "";
  const gear = equipmentForExercises(
    planned.flatMap((session) =>
      ((session.day?.exercises ?? []) as { name?: string }[]).map((exercise) => exercise.name ?? ""),
    ),
  );
  const zones = [
    ...new Map(
      planned.flatMap((session) => {
        const zone = bikeZoneForDayNumber(session.dayNumber);
        return zone ? [[zone.label, zone] as const] : [];
      }),
    ).values(),
  ];
  const isToday = sameLocalDay(selected, now, tz);
  const dayParam = formatDayParam(selected, tz);
  const draftsByDay = new Map(
    drafts
      .filter((session) => session.programDayId)
      .map((session) => [session.programDayId as string, session.id]),
  );
  const nextAction = dayPlan.active
    ? nextTrainAction(planned, (dayId) => draftsByDay.get(dayId))
    : null;
  const bagIndex = planned.findIndex((session) => session.kind === "skill");
  const showDetails =
    dayPlan.active && (plyo.length > 0 || zones.length > 0 || gear.length > 0 || Boolean(equipmentNote));

  const moreLinks = [
    { href: "/training/calendar", label: "Calendar" },
    { href: "/training/history", label: `Workout history (${sessionCount})` },
    { href: "/timer", label: "Round timer" },
    ...(testing ? [] : [{ href: "/training/testing", label: "Testing week" }]),
    { href: "/training/travel", label: "No gym / travel day" },
    { href: "/mobility", label: "Mobility" },
    { href: "/mobility/drills", label: "Hip and kick drills" },
    ...(camp ? [] : [{ href: "/fight-camp", label: "Fight camp" }]),
  ];

  return (
    <main className="space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Training</h1>
          <p className="mt-1 text-sm text-muted">
            {camp && camp.phase !== "complete" && camp.phase !== "pre-camp"
              ? `Fight camp is on. This day follows the ${camp.phaseLabel.toLowerCase()}.`
              : "Today’s session. Not a custom fight camp."}
          </p>
          <p className="font-display mt-2 text-xs uppercase tracking-wide text-accent">
            {mesoBlockLabel(mesoBlockForWeekIndex(weekIndex))}
          </p>
        </div>
        <DemoBadge />
      </div>

      <WeekStrip days={strip} basePath="/training" />

      <section className="space-y-3" data-selected-day-plan>
        <div data-session-phase="first">
          <p className="font-display text-xs uppercase tracking-wide text-accent">
            {isToday ? "Today’s plan" : "Selected day"} · {dayPlan.weekday}
            {dayPlan.movedFrom ? ` · ${dayPlan.movedFrom}’s workout` : ""}
          </p>
          <h2 className="mt-1 text-lg">
            {dayPlan.active
              ? dayPlan.summary
              : nextDay
                ? `Rest · next up ${nextDay}`
                : "Rest day"}
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

        {nextAction ? <NextSessionCta action={nextAction} /> : null}
        {deload ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
        ) : null}
      </section>

      <section className="space-y-3" data-session-phase="next">
        {planned.map((session, index) => (
          <div
            key={`${session.slot}-${session.dayId ?? session.label}`}
            {...(index === bagIndex ? { "data-bag-session": "" } : {})}
          >
            <PlanSessionCard
              session={session}
              compact
              highlight={session.slot === "A" && planned.length > 1}
              draftId={session.dayId ? draftsByDay.get(session.dayId) : undefined}
            />
          </div>
        ))}
      </section>

      {showDetails || dayPlan.active ? (
        <SessionDetails>
          {dayPlan.active ? (
            <Link href="/mobility/daily-warmup/play" className="block rounded-2xl border border-line bg-background px-4 py-3">
              <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
              <p className="mt-1 font-semibold">Dynamic warm-up · 3–4 min</p>
              <p className="mt-1 text-sm text-muted">Joint circles and leg swings. Save long holds for the cooldown.</p>
            </Link>
          ) : null}
          {zones.map((zone) => (
            <BikeZoneNote key={zone.label} zone={zone} />
          ))}
          {plyo.length > 0 ? (
            <div className="rounded-2xl border border-line bg-background px-4 py-3">
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
            </div>
          ) : null}
          {equipmentNote ? <p className="text-sm text-muted">{equipmentNote}</p> : null}
          <EquipmentRow chips={gear} />
        </SessionDetails>
      ) : null}

      {dayPlan.active ? (
        <section data-session-phase="finish">
          <p className="font-display text-xs uppercase tracking-wide text-accent">Finish</p>
          <Link href="/mobility" className="mt-2 block rounded-2xl border border-line bg-card px-4 py-4">
            <h3 className="text-lg">Mobility / cooldown</h3>
            <p className="mt-1 text-sm text-muted">Hips, splits, neck, and the long holds after you train.</p>
          </Link>
        </section>
      ) : null}

      {camp ? (
        <Link href="/fight-camp" className="block rounded-[1.75rem] bg-black px-5 py-5 text-white">
          <span className="flex items-center gap-2">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Camp focus</span>
            <ProPill />
          </span>
          <span className="mt-2 block font-display text-2xl uppercase tracking-wide text-white">
            {camp.weekNumber
              ? `Week ${camp.weekNumber} of ${camp.templateWeeks} · ${camp.phaseLabel}`
              : camp.phaseLabel}
          </span>
          <span className="mt-2 block text-sm text-white/80">{camp.todayFocus}</span>
        </Link>
      ) : null}

      {testing ? (
        <Link href="/training/testing" className="block rounded-[1.5rem] bg-black px-5 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Testing</p>
          <h2 className="mt-1 text-2xl text-white">Testing Week</h2>
          <p className="mt-1 text-sm text-white/70">Broad jump, strength estimate, bike sprint, 5-minute bike.</p>
        </Link>
      ) : null}

      {fromProfile ? null : (
        <TrainingLevelToggle
          band={band}
          dayParam={dayParam}
          fromProfile={fromProfile}
          basePath="/training"
        />
      )}

      <nav aria-label="More training" className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {moreLinks.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <details className="rounded-2xl border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer font-semibold">Fighter conditioning</summary>
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
      </details>
    </main>
  );
}
