import Link from "next/link";
import { requireUser } from "@/lib/session";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  completedProgramDayIdsOnDay,
  countWorkoutSessionsForUser,
  finalizePastLoggedDrafts,
  listDraftSessionsForUser,
  listResumableSessionsForUser,
} from "@/lib/workouts";
import { completedSessionIdsByLocalDay, offPlanMarksByLocalDay, partialLocalDayKeys, partialProgramIdsByLocalDay } from "@/lib/chip-completion";
import { chipDayRefs, chipMarksAfterPlans, chipPlanMarksByDay, withOverlaySessionIds } from "@/lib/chip-days";
import { explicitStartHref, primaryTrainCta } from "@/lib/train-cta";
import { sessionCompletionDay } from "@/lib/performed-at";
import { draftHasResumeWork } from "@/lib/logged-work";
import { calendarPlanDoses } from "@/lib/calendar";
import { canUseFeature } from "@/lib/entitlements";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { skillEquipmentNote } from "@/lib/skill-programs";
import { mesoBlockForWeekIndex, mesoBlockLabel } from "@/lib/mesocycle";
import { blockWeekLabel } from "@/lib/plan-structure";
import { isDeloadWeekIndex, isTestingWeekIndex, DELOAD_LABEL } from "@/lib/training-cycle";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
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
  weekdayInAppZone,
  withBikeChipLogHrefs,
  withChipSessionIds,
} from "@/lib/week-plan";
import {
  carouselFocusOffset,
  carouselLoggedRange,
  carouselWeekStrips,
  packCarouselWeeks,
} from "@/lib/week-carousel";
import { weekStartInRange, weekStartKey } from "@/lib/week-plan-swaps";
import { scaleBandFromPrefs, scaleDemoCatalog, type ScaleBand } from "@/lib/training-scale";
import { Suspense } from "react";
import { WeekStrip } from "@/components/training/WeekStrip";
import { TrainWeekFollow } from "@/components/training/TrainWeekFollow";
import { TrainingLevelToggle } from "@/components/training/TrainingLevelToggle";
import { PlanSessionCard } from "@/components/training/PlanSessionCard";
import { MoveBackButton } from "@/components/training/MoveBackButton";
import { SessionDetails } from "@/components/training/SessionDetails";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { equipmentForExercises, estimateSessionMinutes } from "@/lib/exercise-media";
import { openLogsByProgramDay, todayStartAction } from "@/lib/today-start";
import { withVisiblePlanExercises } from "@/lib/finish-plan";
import { loadMemberExerciseEdits } from "@/lib/member-exercise-edits";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { TodaySummary } from "@/components/training/TodaySummary";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { FightCampOptIn } from "@/components/training/FightCampOptIn";
import { dayKey, memberDayTimeZone, readTimeZoneCookie } from "@/lib/timezone";
import { ProPill } from "@/components/pro/ProPill";
import { formatCalendarHeading } from "@/lib/calendar";
import { formatDayParam, parseDayParam } from "@/lib/home";
import { getSessionIntentSeqForUser, getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { getSparringLog, sparringDateError } from "@/lib/outside-log";
import { easePlanForUser, easeWeekStripDays } from "@/lib/recovery-ease";
import { SparringLogForm } from "@/components/training/SparringLogForm";
import { RecoveryNotice } from "@/components/training/RecoveryNotice";
import { resolveAiCoach } from "@/lib/coaches";
import { listDayPlansForUser } from "@/lib/my-workouts";
import { applyPlansToProgramCards } from "@/lib/my-workout-plan";
import { CustomWorkoutCard } from "@/components/training/CustomWorkoutCard";
import { RevertDayButton } from "@/components/training/RevertDayButton";
import { LogPastWorkoutButton } from "@/components/training/LogPastWorkoutSheet";
import { backfillDayState } from "@/lib/backfill-rules";

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
  const [catalog, sessionCount, conditioning, profile, swaps, intentSeqs] = await Promise.all([
    findDemoTrainingCatalog(),
    countWorkoutSessionsForUser(user.id),
    canUseFeature(user.id, "conditioning"),
    getProfileForUser(user.id),
    getWeekPlanSwapsForUser(user.id),
    getSessionIntentSeqForUser(user.id),
  ]);
  const tzEarly = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  await finalizePastLoggedDrafts(user.id, now, tzEarly);
  const [drafts, resumable] = await Promise.all([
    listDraftSessionsForUser(user.id),
    listResumableSessionsForUser(user.id),
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
    forcedWeekIndex: null as number | null,
  };
  const tz = tzEarly;
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
  const campWeekIndex = campPlanWeekIndex(camp);
  if (campWeekIndex != null) prefs.forcedWeekIndex = campWeekIndex;
  const weekIndex = campWeekIndex ?? planWeekIndex(selected, tz, profile?.onboardingCompletedAt);
  const weightAccess = normalizeWeightAccess(profile?.weightAccess);
  const scaledCatalog = scaleDemoCatalog(catalog, {
    experienceLevel: band,
    competitionStatus: levelOverride ? null : profile?.competitionStatus,
    weightAccess,
    weekIndex,
    campPhase: campOn && camp ? camp.phase : null,
  });
  const builtWeeks = carouselWeekStrips(prefs, now, tz, selected, swaps);
  const linkedWeeks = withBikeChipLogHrefs(
    await easeWeekStripDays(user.id, prefs, builtWeeks.days, tz, swaps),
    prefs,
    scaledCatalog,
    tz,
    swaps,
  );
  const weeks = packCarouselWeeks(
    builtWeeks.anchors,
    withChipSessionIds(linkedWeeks, prefs, scaledCatalog, tz, swaps),
  );
  const focusOffset = carouselFocusOffset(weeks);
  const testing = isTestingWeekIndex(weekIndex);
  const emphasis = profile?.trainingEmphasis ?? "balanced";
  const dayParam = formatDayParam(selected, tz);
  const memberTz = memberDayTimeZone(profile?.timeZone ?? null, await readTimeZoneCookie());
  const [planByDay, edits] = await Promise.all([
    calendarPlanDoses(user.id, now),
    loadMemberExerciseEdits(user.id),
  ]);
  const visibleEdits = { edits, anchor: profile?.onboardingCompletedAt ?? null };
  const openToday = openLogsByProgramDay(
    resumable,
    formatDayParam(now, tz),
    tz,
    planByDay,
    visibleEdits,
  );
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
      weekIndex,
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
  const todayAction = todayStartAction(
    todaySessions.map((session) => ({
      kind: session.kind,
      label: session.label,
      title: session.title,
      subtitle: session.subtitle,
      dayId: session.dayId,
      href: session.href,
      logHref: session.logHref,
      startHref: session.startHref,
      minutes: session.day ? estimateSessionMinutes(session.day.exercises) : 0,
      completed: session.dayId ? doneToday.has(session.dayId) : false,
    })),
    (dayId) => openToday.get(dayId),
  );
  const todayKey = dayKey(now, tz);
  const draftsOn = (day: string) => drafts.filter((row) => sessionCompletionDay(row, tz) === day);
  const todayDrafts = draftsOn(todayKey);
  const resumeDraft =
    todayDrafts.find(
      (row) => draftHasResumeWork(row.sets) && (!row.programDayId || !doneToday.has(row.programDayId)),
    ) ?? null;
  const resumeId =
    todayAction?.verb === "Resume" && todayAction.draftId ? todayAction.draftId : resumeDraft?.id;
  const inProgressDay = resumeDraft ? sessionCompletionDay(resumeDraft, tz) : undefined;
  const loggedRange = carouselLoggedRange(now, tz);
  const carouselKeys = weeks.flatMap((week) => week.days.map((day) => day.dayParam));
  const [completedByDay, partialDays, partialByDay, offPlan, carouselPlans] = await Promise.all([
    completedSessionIdsByLocalDay(user.id, loggedRange.from, loggedRange.to, tz, now),
    partialLocalDayKeys(user.id, loggedRange.from, loggedRange.to, tz, planByDay),
    partialProgramIdsByLocalDay(user.id, loggedRange.from, loggedRange.to, tz, planByDay),
    offPlanMarksByLocalDay(user.id, loggedRange.from, loggedRange.to, tz),
    listDayPlansForUser(user.id, carouselKeys),
  ]);
  const marks = chipMarksAfterPlans({
    days: chipDayRefs(weeks),
    completedByDay,
    partialDays,
    partialByDay,
    plansByDay: chipPlanMarksByDay(carouselPlans),
    offPlan,
  });
  const markedWeeks = withOverlaySessionIds(weeks, marks.sessionIdsByDay);
  const selectedWeekday = weekdayInAppZone(selected, tz);
  const focusDays = markedWeeks.map((week) => {
    const day = week.days.find((item) => item.weekday === selectedWeekday) ?? week.days[0]!;
    return { weekStart: week.weekStart, day };
  });
  const savedDayPlans = carouselPlans.filter((plan) =>
    focusDays.some((focus) => focus.day.dayParam === plan.dayKey),
  );
  const focusModels = await Promise.all(
    focusDays.map(async (focus) => {
      const date = focus.day.date;
      const focusParam = focus.day.dayParam;
      const core = planForDate(prefs, date, tz, swaps);
      const shaped =
        campOn && camp && camp.phase !== "complete" ? shapeDayPlan(core, camp.phase) : core;
      const eased = await easePlanForUser(user.id, date, tz, shaped);
      const focusPlan = eased.plan;
      const focusWeekIndex =
        campWeekIndex ?? planWeekIndex(date, tz, profile?.onboardingCompletedAt);
      const focusCatalog = scaleDemoCatalog(catalog, {
        experienceLevel: band,
        competitionStatus: levelOverride ? null : profile?.competitionStatus,
        weightAccess,
        weekIndex: focusWeekIndex,
        campPhase: campOn && camp ? camp.phase : null,
      });
      const focusPlanned = resolvePlanSessions(focusPlan, focusCatalog);
      const focusDayPlans = savedDayPlans.filter((plan) => plan.dayKey === focusParam);
      const overlay = applyPlansToProgramCards(focusPlanned, focusDayPlans);
      const openOnDay = openLogsByProgramDay(resumable, focusParam, tz, planByDay, visibleEdits);
      const cards = overlay.cards.map((session) => {
        const openId = session.dayId ? openOnDay.get(session.dayId)?.id : undefined;
        const logged = resumable.find(
          (row) =>
            Boolean(session.dayId) &&
            row.programDayId === session.dayId &&
            sessionCompletionDay(row, tz) === focusParam,
        );
        return withVisiblePlanExercises(session, {
          edits,
          blockKey: trainingBlockKey(date, tz, profile?.onboardingCompletedAt ?? null),
          sessionId: openId ?? logged?.id ?? "",
        });
      });
      const plyo =
        focusPlanned.some((session) => session.kind === "strength") && focusPlan.active
          ? profile?.experienceLevel === "beginner"
            ? beginnerPlyoBlock()
            : weightAccess === "none"
              ? floorPlyoBlock()
              : plyoBlockFor(emphasis)
          : [];
      const hasSkill = focusPlanned.some((session) => session.kind === "skill");
      const equipmentNote = hasSkill ? skillEquipmentNote(profile?.equipment) : "";
      const gear = equipmentForExercises(
        focusPlanned.flatMap((session) =>
          ((session.day?.exercises ?? []) as { name?: string }[]).map((exercise) => exercise.name ?? ""),
        ),
      );
      const zones = [
        ...new Map(
          focusPlanned.flatMap((session) => {
            const zone = bikeZoneForDayNumber(session.dayNumber);
            return zone ? [[zone.label, zone] as const] : [];
          }),
        ).values(),
      ];
      return {
        weekStart: focus.weekStart,
        dayParam: focusParam,
        dateLabel: formatCalendarHeading(date, now, tz),
        dayPlan: focusPlan,
        checkIn: eased.checkIn,
        cards,
        replaced: overlay.replaced,
        dayPlans: focusDayPlans,
        openOnDay,
        doneIds: new Set(marks.completedByDay[focusParam] ?? []),
        isToday: focus.day.isToday,
        deload: campWeekIndex == null && isDeloadWeekIndex(focusWeekIndex),
        testing: isTestingWeekIndex(focusWeekIndex),
        plyo,
        zones,
        gear,
        equipmentNote,
        showDetails:
          focusPlan.active &&
          (plyo.length > 0 || zones.length > 0 || gear.length > 0 || Boolean(equipmentNote)),
        sparringSaved:
          focusPlan.outside?.kind === "sparring" ? await getSparringLog(user.id, focusParam) : null,
        sparringFuture:
          focusPlan.outside?.kind === "sparring" ? sparringDateError(focusParam, now, memberTz) : null,
        nextDay: focusPlan.active ? null : nextActiveWeekday(prefs, date, tz, swaps),
        bagIndex: focusPlanned.findIndex((session) => session.kind === "skill"),
        plannedCount: focusPlanned.length,
      };
    }),
  );
  const moves = Object.fromEntries(
    focusDays.map((focus) => [
      focus.weekStart,
      {
        editable: weekStartInRange(focus.weekStart, weekStartKey(now, tz)),
        days: moveDayChoices(prefs, now, tz, focus.day.date, swaps),
      },
    ]),
  );

  const moreLinks = [
    { href: "/training/my-workouts", label: "My Workouts" },
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
  const coach = resolveAiCoach(profile?.aiCoachId);
  const logPastDayKeys = [
    ...new Set(
      weeks
        .flatMap((week) => week.days.map((day) => day.dayParam))
        .filter((key) => backfillDayState(key, now, tz) === "ok"),
    ),
  ];

  return (
    <main className="min-w-0 space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]" data-coach-page>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Training</h1>
          <p className="mt-1 text-sm text-muted">
            {campOn && camp && camp.phase !== "complete" && camp.phase !== "pre-camp"
              ? `Fight camp is on. This day follows the ${camp.phaseLabel.toLowerCase()}.`
              : "Today’s session."}
          </p>
          <p className="font-display mt-2 text-xs uppercase tracking-wide text-accent" data-block-week>
            {mesoBlockLabel(mesoBlockForWeekIndex(weekIndex))} · {blockWeekLabel(weekIndex)}
          </p>
        </div>
        <Link
          href="/training/my-workouts"
          data-my-workouts-link
          className="touch-target inline-flex shrink-0 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
        >
          My Workouts
        </Link>
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

      <TrainWeekFollow
        initialWeekStart={viewedWeek}
        level={levelOverride}
        moves={moves}
        intentSeqs={intentSeqs}
      >
      <WeekStrip
        days={markedWeeks.find((week) => week.offset === 0)?.days ?? []}
        weeks={markedWeeks}
        basePath="/training"
        completedDays={marks.loggedDays}
        completedByDay={marks.completedByDay}
        partialDays={marks.partialDays}
        inProgressDay={inProgressDay}
        focusOffset={focusOffset}
        todayHref={`/training?day=${formatDayParam(now, tz)}`}
        logPastDayKeys={logPastDayKeys}
        timeZone={tz}
      />

      <WeightAccessToggle access={weightAccess} nextPath={`/training?day=${dayParam}`} />

      {focusModels.map((focus) => {
        const planDateLabel = focus.dateLabel;
        const dayPlan = focus.dayPlan;
        const visible = focus.weekStart === viewedWeek;
        const replacement = focus.dayPlans.find((plan) => plan.mode === "replace");
        const openPlan = focus.dayPlans.find((plan) => !plan.complete && plan.draftId);
        const planResume = openPlan?.draftId;
        const trainCta = focus.isToday
          ? primaryTrainCta({
              resumeHref: focus.replaced
                ? planResume
                  ? `/training/log/${planResume}`
                  : null
                : resumeId
                  ? `/training/log/${resumeId}`
                  : null,
              startHref: explicitStartHref({
                replaced: focus.replaced,
                plans: focus.dayPlans,
                action: todayAction,
              }),
            })
          : null;
        const cards = dayPlan.active ? focus.cards : focus.cards.filter((session) => session.kind !== "rest");
        return (
          <div
            key={focus.weekStart}
            data-train-panel={focus.weekStart}
            hidden={visible ? undefined : true}
            inert={visible ? undefined : true}
            className="space-y-4"
          >
      {focus.isToday ? (
        <TodaySummary
          modality={
            replacement
              ? replacement.name
              : todayAction?.modality || (dayPlan.active ? "Session" : "Rest")
          }
          note={
            replacement
              ? replacement.exerciseNames.slice(0, 4).join(" · ")
              : todayAction?.theme || dayPlan.skipReason || ""
          }
          minutes={replacement ? 0 : (todayAction?.minutes ?? 0)}
        />
      ) : null}
      {trainCta?.verb === "Resume" &&
      (focus.replaced ? openPlan?.partial && openPlan.draftId : todayAction?.partial && todayAction.draftId) ? (
        <ContinueWorkoutButton
          workoutId={(focus.replaced ? openPlan?.draftId : todayAction?.draftId) ?? ""}
          label="Resume"
          className="touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black"
          testId="training-primary-resume"
          primary
        />
      ) : trainCta ? (
        <Link
          href={trainCta.href}
          prefetch={trainCta.verb === "Start" ? false : undefined}
          data-primary-train-cta
          data-resume-workout={trainCta.verb === "Resume" ? "true" : undefined}
          data-start-today={trainCta.verb === "Start" ? "true" : undefined}
          data-prime-coach-audio
          className="relative z-30 flex w-full touch-target scroll-mt-20 items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black"
        >
          {trainCta.verb}
        </Link>
      ) : null}
      <section className="space-y-3" data-selected-day-plan>
        <div data-session-phase="first">
          <p className="font-display text-xs uppercase tracking-wide text-accent" data-day-heading>
            {planDateLabel}
            {dayPlan.movedFrom ? ` · ${dayPlan.movedFrom}’s workout` : ""}
          </p>
          <h2 className={`mt-1 text-lg${focus.replaced ? " normal-case" : ""}`}>
            {focus.replaced
              ? focus.dayPlans.map((plan) => plan.name).join(" · ")
              : dayPlan.active
                ? dayPlan.summary
                : focus.nextDay
                  ? `Rest · next up ${focus.nextDay}`
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
          {backfillDayState(focus.dayParam, now, tz) === "ok" ? (
            <div className="pt-2">
              <LogPastWorkoutButton
                dayKey={focus.dayParam}
                entry="train"
                label={focus.dayParam === dayKey(now, tz) ? "Log a workout" : "Log a past workout"}
                timeZone={tz}
              />
            </div>
          ) : null}
          {dayPlan.easeNote || focus.checkIn ? (
            <div className="mt-3">
              <RecoveryNotice
                note={dayPlan.easeNote}
                coachName={focus.checkIn?.name}
                coachImage={focus.checkIn?.image}
                message={focus.checkIn?.message}
              />
            </div>
          ) : null}
        </div>

        {focus.deload ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
        ) : null}
      </section>

      {dayPlan.outside?.kind === "sparring" ? (
        focus.sparringFuture ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm" data-sparring-future>
            {focus.sparringFuture}
          </p>
        ) : (
          <SparringLogForm
            dateKey={focus.dayParam}
            weekday={dayPlan.weekday}
            timeLabel={dayPlan.outside.label.replace(/^Sparring\s*·\s*/, "")}
            saved={focus.sparringSaved}
            coachName={coach.name}
            coachImage={coach.circle}
          />
        )
      ) : null}

      <section className="space-y-3" data-session-phase="next">
        {cards.map((session, index) => (
          <div
            key={`${session.sessionKey ?? session.slot}-${session.dayId ?? session.label}`}
            {...(index === focus.bagIndex ? { "data-bag-session": "" } : {})}
          >
            <PlanSessionCard
              session={session}
              compact
              calendarWeekday={dayPlan.weekday}
              highlight={session.slot === "A" && focus.plannedCount > 1}
              resume={session.dayId ? focus.openOnDay.get(session.dayId) : undefined}
              draftId={session.dayId ? draftsOn(focus.dayParam).find((row) => row.programDayId === session.dayId)?.id : undefined}
              completed={
                session.dayId
                  ? focus.doneIds.has(session.dayId) && !focus.openOnDay.get(session.dayId)?.partial
                  : false
              }
              dateLabel={planDateLabel}
            />
            {session.sessionKey && session.sourceWeekday && session.sourceWeekday !== dayPlan.weekday ? (
              <div className="mt-2">
                <MoveBackButton
                  sessionKey={session.sessionKey}
                  weekStart={focus.weekStart}
                  home={session.sourceWeekday}
                />
              </div>
            ) : null}
          </div>
        ))}
        {focus.dayPlans.map((plan) => (
          <CustomWorkoutCard key={plan.id} plan={plan} />
        ))}
        {focus.dayPlans.length > 0 ? (
          <RevertDayButton dayKey={focus.dayParam} next={`/training?day=${focus.dayParam}`} />
        ) : null}
      </section>

      {focus.showDetails || dayPlan.active ? (
        <SessionDetails>
          {dayPlan.active ? (
            <Link href="/mobility/daily-warmup/play" className="block rounded-2xl border border-line bg-background px-4 py-3">
              <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
              <p className="mt-1 font-semibold">Dynamic warm-up · 3–4 min</p>
              <p className="mt-1 text-sm text-muted">Joint circles and leg swings. Save long holds for the cooldown.</p>
            </Link>
          ) : null}
          {weightAccess === "gym"
            ? focus.zones.map((zone) => <BikeZoneNote key={zone.label} zone={zone} />)
            : null}
          {focus.plyo.length > 0 ? (
            <div className="rounded-2xl border border-line bg-background px-4 py-3">
              <p className="font-display text-xs uppercase tracking-wide text-accent">
                Before the lifts · {PLYO_MINUTES}
              </p>
              <h3 className="mt-1 text-lg">Plyo / power</h3>
              <p className="mt-1 text-sm text-muted">{emphasisAccessoryLine(emphasis)}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {focus.plyo.map((drill) => (
                  <li key={drill.name}>
                    <span className="font-semibold">{drill.name}</span> · {drill.prescription}
                    <span className="block text-muted">{drill.cues}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {focus.equipmentNote ? <p className="text-sm text-muted">{focus.equipmentNote}</p> : null}
          <EquipmentRow chips={focus.gear} />
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

      {focus.testing ? (
        <Link href="/training/testing" className="block rounded-[1.5rem] bg-black px-5 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Testing</p>
          <h2 className="mt-1 text-2xl text-white">Testing Week</h2>
          <p className="mt-1 text-sm text-white/70">Broad jump, strength estimate, bike sprint, 5-minute bike.</p>
        </Link>
      ) : null}
          </div>
        );
      })}
      </TrainWeekFollow>

      {fromProfile ? null : (
        <Suspense fallback={null}>
          <TrainingLevelToggle
            band={band}
            dayParam={dayParam}
            fromProfile={fromProfile}
            basePath="/training"
          />
        </Suspense>
      )}

      <details className="overflow-hidden rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-3 font-semibold">More training</summary>
        <nav aria-label="More training">
          <ul className="divide-y divide-line border-t border-line">
            {moreLinks.map((item) => (
              <li key={item.href}>
                <Link data-testid={`training-link-${item.href.split("/").filter(Boolean).join("-")}`} href={item.href} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
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
            The sessions above are the combat plan: warm-up, power, strength, then
            conditioning, in 3-week blocks. Fight camp uses that same plan.
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
  );
}
