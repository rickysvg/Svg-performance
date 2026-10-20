import Link from "next/link";
import { requireUser } from "@/lib/session";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  completedProgramDayIdsOnDay,
  countWorkoutSessionsForUser,
  listDraftSessionsForUser,
} from "@/lib/workouts";
import { canUseFeature } from "@/lib/entitlements";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { skillEquipmentNote } from "@/lib/skill-programs";
import { mesoBlockForWeekIndex, mesoBlockLabel } from "@/lib/mesocycle";
import { isDeloadWeekIndex, isTestingWeekIndex, DELOAD_LABEL } from "@/lib/training-cycle";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { bikeZoneForDayNumber, emphasisAccessoryLine } from "@/lib/train-extras";
import { beginnerPlyoBlock, floorPlyoBlock, plyoBlockFor, PLYO_MINUTES } from "@/lib/training-emphasis";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { WeightAccessToggle } from "@/components/training/WeightAccessToggle";
import {
  moveDayChoices,
  nextActiveWeekday,
  planForDate,
  planWeekIndex,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import { weekStartInRange, weekStartKey } from "@/lib/week-plan-swaps";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { WorkoutMoveProvider } from "@/components/training/WorkoutMove";
import { NextSessionCta } from "@/components/training/NextSessionCta";
import { SessionDetails } from "@/components/training/SessionDetails";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { equipmentForExercises, estimateSessionMinutes } from "@/lib/exercise-media";
import { nextTrainAction } from "@/lib/train-next";
import { todayStartAction } from "@/lib/today-start";
import { StartTodayButton } from "@/components/training/StartTodayButton";
import { getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { FightCampOptIn } from "@/components/training/FightCampOptIn";
import { dayKey } from "@/lib/timezone";
import { ProPill } from "@/components/pro/ProPill";
import { formatCalendarHeading } from "@/lib/calendar";
import { formatDayParam, parseDayParam, sameLocalDay } from "@/lib/home";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { getSparringLog, latestSparringSessionRating } from "@/lib/outside-log";
import { sparringTileHint } from "@/lib/sparring-tile";
import { SparringLogTile } from "@/components/home/SparringLogTile";
import { tileSrc } from "@/lib/athlete-imagery";
import { easePlanForUser } from "@/lib/recovery-ease";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { resolveAiCoach } from "@/lib/coaches";

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
  const [catalog, drafts, sessionCount, conditioning, profile, swaps, sparringRating] = await Promise.all([
    findDemoTrainingCatalog(),
    listDraftSessionsForUser(user.id),
    countWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
    getWeekPlanSwapsForUser(user.id),
    latestSparringSessionRating(user.id),
  ]);
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
  const campOn = Boolean(camp && camp.weightClass.trim());
  const weekIndex = planWeekIndex(selected, tz, profile?.onboardingCompletedAt);
  const corePlan = planForDate(prefs, selected, tz, swaps);
  const shaped =
    campOn && camp && camp.phase !== "complete" ? shapeDayPlan(corePlan, camp.phase) : corePlan;
  const easedSelected = await easePlanForUser(user.id, selected, tz, shaped);
  const dayPlan = easedSelected.plan;
  const weightAccess = normalizeWeightAccess(profile?.weightAccess);
  const planned = resolvePlanSessions(
    dayPlan,
    scaleDemoCatalog(catalog, {
      experienceLevel: band,
      competitionStatus: levelOverride ? null : profile?.competitionStatus,
      weightAccess,
      weekIndex,
      campPhase: campOn && camp ? camp.phase : null,
    }),
  );
  const strip = weekStrip(prefs, now, tz, selected, swaps);
  const nextDay = dayPlan.active ? null : nextActiveWeekday(prefs, selected, tz, swaps);
  const deload = isDeloadWeekIndex(weekIndex);
  const testing = isTestingWeekIndex(weekIndex);
  const emphasis = profile?.trainingEmphasis ?? "balanced";
  const showPlyo = planned.some((session) => session.kind === "strength");
  const plyo =
    showPlyo && dayPlan.active
      ? profile?.experienceLevel === "beginner"
        ? beginnerPlyoBlock()
        : weightAccess === "none"
          ? floorPlyoBlock()
          : plyoBlockFor(emphasis)
      : [];
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
  const todayBase = planForDate(prefs, now, tz, swaps);
  const todayShaped =
    campOn && camp && camp.phase !== "complete" ? shapeDayPlan(todayBase, camp.phase) : todayBase;
  const todayEased = await easePlanForUser(user.id, now, tz, todayShaped);
  const todaySessions = resolvePlanSessions(
    todayEased.plan,
    scaleDemoCatalog(catalog, {
      experienceLevel: profileBand,
      competitionStatus: profile?.competitionStatus,
      weightAccess,
      weekIndex: planWeekIndex(now, tz, profile?.onboardingCompletedAt),
      campPhase: campOn && camp ? camp.phase : null,
    }),
  );
  const doneToday = new Set(
    await completedProgramDayIdsOnDay(
      user.id,
      todaySessions.flatMap((session) => (session.dayId ? [session.dayId] : [])),
      now,
      tz,
    ),
  );
  const doneOnView = isToday
    ? doneToday
    : new Set(
        await completedProgramDayIdsOnDay(
          user.id,
          planned.flatMap((session) => (session.dayId ? [session.dayId] : [])),
          selected,
          tz,
        ),
      );
  const todayAction = todayStartAction(
    todaySessions.map((session) => ({
      kind: session.kind,
      label: session.label,
      title: session.title,
      subtitle: session.subtitle,
      dayId: session.dayId,
      href: session.href,
      minutes: session.day ? estimateSessionMinutes(session.day.exercises) : 0,
      completed: session.dayId ? doneToday.has(session.dayId) : false,
    })),
    (dayId) => draftsByDay.get(dayId),
  );
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
    ...(profile?.trainingFocus === "sc_only"
      ? []
      : [{ href: "/mobility/drills", label: "Hip and kick drills" }]),
  ];

  const viewedWeek = weekStartKey(selected, tz);
  const moveDays = moveDayChoices(prefs, now, tz, selected, swaps);
  const coach = resolveAiCoach(profile?.aiCoachId);
  const sparringSaved =
    dayPlan.outside?.kind === "sparring" ? await getSparringLog(user.id, dayParam) : null;

  return (
    <WorkoutMoveProvider
      editable={weekStartInRange(viewedWeek, weekStartKey(now, tz))}
      weekStart={viewedWeek}
      days={moveDays}
    >
    <main className="space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Training</h1>
          <p className="mt-1 text-sm text-muted">
            {campOn && camp && camp.phase !== "complete" && camp.phase !== "pre-camp"
              ? `Fight camp is on. This day follows the ${camp.phaseLabel.toLowerCase()}.`
              : "Today’s session."}
          </p>
          <p className="font-display mt-2 text-xs uppercase tracking-wide text-accent">
            {mesoBlockLabel(mesoBlockForWeekIndex(weekIndex))}
          </p>
        </div>
      </div>

      <FightCampOptIn
        enabled={campOn}
        todayKey={dayKey(now, tz)}
        fightDate={camp?.fightDateKey ?? ""}
        weightClass={camp?.weightClass ?? ""}
        summary={
          campOn && camp ? `${camp.fightDateLabel} · ${camp.weightClass}` : ""
        }
      />

      {campOn && camp ? (
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

      {todayAction ? <StartTodayButton action={todayAction} /> : null}
      <SparringLogTile
        hint={sparringTileHint(sparringRating)}
        layout="row"
        src={tileSrc("/tiles/sparring.webp", profile?.athleteImagery)}
      />

      <WeekStrip days={strip} basePath="/training" />

      <WeightAccessToggle access={weightAccess} nextPath={`/training?day=${dayParam}`} />

      <section className="space-y-3" data-selected-day-plan>
        <div data-session-phase="first">
          <p className="font-display text-xs uppercase tracking-wide text-accent" data-day-heading>
            {formatCalendarHeading(selected, now, tz)}
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
          {dayPlan.easeNote || easedSelected.checkIn ? (
            <div className="mt-3">
              <RecoveryNotice
                note={dayPlan.easeNote}
                coachName={easedSelected.checkIn?.name}
                coachImage={easedSelected.checkIn?.image}
                message={easedSelected.checkIn?.message}
              />
            </div>
          ) : null}
        </div>

        {nextAction && !isToday ? <NextSessionCta action={nextAction} /> : null}
        {deload ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
        ) : null}
      </section>

      {dayPlan.outside?.kind === "sparring" ? (
        <SparringLogForm
          dateKey={dayParam}
          weekday={dayPlan.weekday}
          timeLabel={dayPlan.outside.label.replace(/^Sparring\s*·\s*/, "")}
          saved={sparringSaved}
          coachName={coach.name}
          coachImage={coach.circle}
        />
      ) : null}

      <section className="space-y-3" data-session-phase="next">
        {planned.map((session, index) => (
          <div
            key={`${session.sessionKey ?? session.slot}-${session.dayId ?? session.label}`}
            {...(index === bagIndex ? { "data-bag-session": "" } : {})}
          >
            <PlanSessionCard
              session={session}
              compact
              calendarWeekday={dayPlan.weekday}
              highlight={session.slot === "A" && planned.length > 1}
              draftId={session.dayId ? draftsByDay.get(session.dayId) : undefined}
              completed={session.dayId ? doneOnView.has(session.dayId) : false}
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
          {weightAccess === "gym"
            ? zones.map((zone) => <BikeZoneNote key={zone.label} zone={zone} />)
            : null}
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

      <details className="overflow-hidden rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-3 font-semibold">More training</summary>
        <nav aria-label="More training">
          <ul className="divide-y divide-line border-t border-line">
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
      </details>

      <details className="rounded-2xl border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer font-semibold">Fighter conditioning</summary>
        {conditioning ? (
          <p className="mt-2 text-sm text-muted">
            Shared combat S&amp;C / mobility blocks publish here when ready. This Core
            week stays labeled DEMO and is not a 1:1 assigned fight camp.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Full plans, including fighter conditioning, are on SVG Performance. Verified
            academy members get the app free.{" "}
            <Link href="/pricing" className="text-accent underline">
              See pricing
            </Link>
          </p>
        )}
      </details>
    </main>
    </WorkoutMoveProvider>
  );
}
