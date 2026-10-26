import { prisma } from "@/lib/prisma";
import { isScOnly } from "@/lib/member-plan";
import { getSparringLog } from "@/lib/outside-log";
import { easePlanForUser, easeWeekStripDays } from "@/lib/recovery-ease";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  isPastEmptyDraft,
  listDraftSessionsForUser,
  listRecentSessionsForUser,
  listResumableSessionsForUser,
} from "@/lib/workouts";
import { CUSTOM_HOME_RESUME, openCustomLog, openLogsByProgramDay } from "@/lib/today-start";
import { listDayPlansForUser } from "@/lib/my-workouts";
import { homePlanDayId, homeSessionsAfterPlans, type HomeDayPlan } from "@/lib/my-workout-plan";
import { calendarPlanDoses } from "@/lib/calendar";
import { getNutritionSummaryForDay, startOfLocalDay } from "@/lib/nutrition";
import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey as zonedDayKey,
  endOfZonedDay,
  mondayOfZoned,
  sameZonedDay,
  sundayOfZoned,
  zonedCivilToUtc,
} from "@/lib/timezone";
import { listPublishedLessons, listLessonProgressForUser } from "@/lib/lessons";
import {
  getProfileForUser,
  firstNameFrom,
  nutritionTargetsFromProfile,
  timeZoneForUser,
} from "@/lib/profile";
import {
  competitionNote,
  demoSuggestionCopy,
  needsDeepOnboardingPrompt,
  preferredLearnLevel,
  preferredLearnTopic,
  sessionLengthHint,
  trainingLocationHint,
} from "@/lib/onboarding";
import {
  nextActiveDate,
  planForDate,
  planWeekIndex,
  resolvePlanSessions,
  weekdayInAppZone,
  weekStrip,
  withBikeChipLogHrefs,
  type CatalogDayLike,
  type ResolvedPlanSession,
} from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import {
  loggedSetSome,
  prescribedSetTotal,
  sessionCountsAsPlannedCompletion,
} from "@/lib/logged-work";
import { sessionProgress, type ProgressDose } from "@/lib/session-progress";
import { visibleDoseForSession, withVisiblePlanExercises, type MemberExerciseEdits } from "@/lib/finish-plan";
import { loadMemberExerciseEdits } from "@/lib/member-exercise-edits";
import { trainingBlockKey } from "@/lib/exercise-swap";

export type WeeklyActivity = {
  daysActive: number;
  totalDays: 7;
  message: string;
};

function startOfLocalWeek(now = new Date(), timeZone = APP_TIMEZONE) {
  return sundayOfZoned(now, timeZone);
}

export function weeklyActivityCopy(daysActive: number): string {
  if (daysActive <= 0) {
    return "No workout or food logs this week yet. That is okay — one entry is a start when you are ready.";
  }
  if (daysActive >= 7) {
    return "You logged something on every day this week. Nice consistency.";
  }
  return `You logged a workout and/or food on ${daysActive} day${daysActive === 1 ? "" : "s"} this week.`;
}

export async function getWeeklyActivity(
  userId: string,
  now = new Date(),
  timeZone = APP_TIMEZONE,
): Promise<WeeklyActivity> {
  const weekStart = startOfLocalWeek(now, timeZone);
  const [workouts, foods] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        sets: loggedSetSome,
        performedAt: { gte: weekStart },
      },
      select: {
        status: true,
        plannedSetCount: true,
        performedAt: true,
        sets: {
          select: {
            exerciseName: true,
            completed: true,
            reps: true,
            loadValue: true,
            durationSeconds: true,
          },
        },
        programDay: { select: { exercises: { select: { sets: true } } } },
      },
    }),
    prisma.nutritionEntry.findMany({
      where: { userId, eatenAt: { gte: weekStart } },
      select: { eatenAt: true },
    }),
  ]);
  const days = new Set<string>();
  for (const row of workouts) {
    if (!sessionCountsAsPlannedCompletion(row, [], prescribedSetTotal(row.programDay?.exercises))) {
      continue;
    }
    days.add(zonedDayKey(row.performedAt, timeZone));
  }
  for (const row of foods) days.add(zonedDayKey(row.eatenAt, timeZone));
  const daysActive = days.size;
  return {
    daysActive,
    totalDays: 7,
    message: weeklyActivityCopy(daysActive),
  };
}

export function parseDayParam(
  value: string | undefined,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  if (!value) return startOfLocalDay(now, timeZone);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfLocalDay(now, timeZone);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return startOfLocalDay(now, timeZone);
  }
  return zonedCivilToUtc(year, month, day, timeZone);
}

export function mondayOf(date: Date, timeZone = APP_TIMEZONE) {
  return mondayOfZoned(date, timeZone);
}

export function weekStripDays(selected: Date, timeZone = APP_TIMEZONE) {
  const monday = mondayOf(selected, timeZone);
  return Array.from({ length: 7 }, (_, index) => addZonedDays(monday, index, timeZone));
}

export function sameLocalDay(a: Date, b: Date, timeZone = APP_TIMEZONE) {
  return sameZonedDay(a, b, timeZone);
}

export function formatDayParam(date: Date, timeZone = APP_TIMEZONE) {
  return zonedDayKey(date, timeZone);
}

export async function hasActivityOnLocalDay(
  userId: string,
  day: Date,
  timeZone = APP_TIMEZONE,
) {
  const start = startOfLocalDay(day, timeZone);
  const end = endOfZonedDay(day, timeZone);
  const [workouts, foods] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        sets: loggedSetSome,
        performedAt: { gte: start, lt: end },
      },
      select: {
        status: true,
        plannedSetCount: true,
        sets: {
          select: {
            exerciseName: true,
            completed: true,
            reps: true,
            loadValue: true,
            durationSeconds: true,
          },
        },
        programDay: { select: { exercises: { select: { sets: true } } } },
      },
    }),
    prisma.nutritionEntry.count({
      where: { userId, eatenAt: { gte: start, lt: end } },
    }),
  ]);
  const finished = workouts.filter((row) =>
    sessionCountsAsPlannedCompletion(row, [], prescribedSetTotal(row.programDay?.exercises)),
  ).length;
  return finished + foods > 0;
}

export async function homeLoad<T>(
  label: string,
  task: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[home] ${label} failed`, error);
    return fallback;
  }
}

export function emptyHomeToday(selectedDay = new Date(), timeZone = APP_TIMEZONE) {
  const selected = startOfLocalDay(selectedDay, timeZone);
  return {
    selected,
    isToday: sameLocalDay(selected, new Date(), timeZone),
    suggestedDay: null as CatalogDayLike | null,
    plannedSessions: [] as ReturnType<typeof resolvePlanSessions>,
    weekStrip: [] as ReturnType<typeof weekStrip>,
    timeZone,
    planWeekday: weekdayInAppZone(selected, timeZone),
    planSummary: "",
    mesoLabel: "",
    outsideKind: null as "class" | "sparring" | null,
    outsideLabel: "",
    dayNote: "",
    easeNote: "",
    coachCheckIn: null as { name: string; image: string; message: string } | null,
    sparringLog: null as Awaited<ReturnType<typeof getSparringLog>>,
    suggestionCopy:
      "Training days are not loaded on this preview yet. Your account and logs still work.",
    draft: undefined,
    resumeByDay: {} as Record<string, { id: string; partial: boolean; ticked?: number; planned?: number }>,
    completedDayIds: [] as string[],
    partialDayIds: [] as string[],
    loggedOnSelected: null,
    foodToday: { entryCount: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    foodNudge: "No food logged this day yet. A rough estimate is enough.",
    incompleteLesson: null,
    activity: {
      daysActive: 0,
      totalDays: 7 as const,
      message: weeklyActivityCopy(0),
    },
    targets: nutritionTargetsFromProfile(null),
    firstName: "",
    goals: "",
    nextSession: null as ResolvedPlanSession | null,
    nextSessionWeekday: "" as string,
    sessions: [] as Awaited<ReturnType<typeof listRecentSessionsForUser>>,
    needsDeepPrompt: false,
    sessionHint: "",
    locationHint: "",
    competitionNote: "",
  };
}

function homeProgress(
  session: {
    id?: string;
    status: string;
    performedAt?: Date;
    programDayId?: string | null;
    plannedSetCount?: number | null;
    sets: {
      completed?: boolean | null;
      reps?: number | null;
      loadValue?: number | null;
      durationSeconds?: number | null;
      exerciseName?: string | null;
    }[];
    programDay?: {
      dayNumber?: number;
      program?: { slug: string };
      exercises?: { sets?: number | null; name?: string | null }[];
    } | null;
  },
  plan: ProgressDose | undefined,
  fallback: { name?: string | null; sets?: number | null }[],
  edits: MemberExerciseEdits,
  timeZone: string,
  anchor: Date | null,
) {
  const exercises = plan?.exercises && plan.exercises.length > 0 ? plan.exercises : fallback;
  const visible = visibleDoseForSession({
    exercises,
    catalogDose: typeof plan?.dose === "number" ? plan.dose : undefined,
    sessionId: session.id ?? "",
    blockKey: trainingBlockKey(session.performedAt ?? new Date(), timeZone, anchor),
    programSlug: session.programDay?.program?.slug,
    dayNumber: session.programDay?.dayNumber,
    edits,
    loggedSets: session.sets,
  });
  return sessionProgress(session, {
    dose: visible.dose,
    names: visible.names,
    exercises: visible.exercises,
  });
}

function partialProgramDayIds(
  sessions: {
    status: string;
    programDayId: string | null;
    performedAt: Date;
    plannedSetCount?: number | null;
    sets: {
      completed?: boolean | null;
      reps?: number | null;
      loadValue?: number | null;
      durationSeconds?: number | null;
      exerciseName?: string | null;
    }[];
    programDay?: { exercises?: { sets?: number | null; name?: string | null }[] } | null;
  }[],
  selected: Date,
  tz: string,
  plannedSessions: { dayId?: string | null; day?: { exercises?: { name?: string | null; sets?: number | null }[] } | null }[],
  planByDay: ReadonlyMap<string, ProgressDose>,
  edits: MemberExerciseEdits,
  anchor: Date | null,
) {
  return [
    ...new Set(
      sessions
        .filter((session) => {
          if (!session.programDayId || !sameLocalDay(session.performedAt, selected, tz)) return false;
          const planned = plannedSessions.find((row) => row.dayId === session.programDayId);
          const progress = homeProgress(
            session,
            planByDay.get(session.programDayId),
            planned?.day?.exercises ?? session.programDay?.exercises ?? [],
            edits,
            tz,
            anchor,
          );
          return progress.ticked > 0 && !(session.status === "complete" && progress.done);
        })
        .map((session) => session.programDayId as string),
    ),
  ];
}

export async function getHomeToday(
  userId: string,
  selectedDay = new Date(),
  timeZone?: string,
) {
  const profileForZone = timeZone
    ? null
    : await getProfileForUser(userId);
  const tz =
    timeZone ??
    (await timeZoneForUser(userId, profileForZone?.timeZone ?? null));
  const selected = startOfLocalDay(selectedDay, tz);
  const now = new Date();
  const selectedKey = zonedDayKey(selected, tz);
  const [catalog, sessions, drafts, resumable, planByDay, foodToday, allLessons, progress, activity, profile, swaps, account, dayPlans, edits] =
    await Promise.all([
      findDemoTrainingCatalog(),
      listRecentSessionsForUser(userId),
      listDraftSessionsForUser(userId),
      listResumableSessionsForUser(userId),
      calendarPlanDoses(userId, selected),
      getNutritionSummaryForDay(userId, selected, tz),
      listPublishedLessons(),
      listLessonProgressForUser(userId),
      getWeeklyActivity(userId, now, tz),
      profileForZone ? Promise.resolve(profileForZone) : getProfileForUser(userId),
      getWeekPlanSwapsForUser(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      listDayPlansForUser(userId, [selectedKey]),
      loadMemberExerciseEdits(userId),
    ]);
  const { strength, skill } = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    weekIndex: planWeekIndex(selected, tz, profile?.onboardingCompletedAt ?? null),
  });
  const hasCatalog = Boolean(strength || skill);

  const todayKey = zonedDayKey(now, tz);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
  };
  const builtToday = planForDate(prefs, selected, tz, swaps);
  const easedToday = await easePlanForUser(userId, selected, tz, builtToday);
  const todayPlan = easedToday.plan;
  const programSessions = resolvePlanSessions(todayPlan, { strength, skill });
  const homePlans: HomeDayPlan[] = dayPlans
    .filter((plan) => plan.dayKey === selectedKey)
    .map((plan) => ({
      id: plan.id,
      mode: plan.mode,
      name: plan.name,
      exerciseNames: plan.exerciseNames,
      exercises: plan.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        restSeconds: exercise.restSeconds,
      })),
      complete: plan.complete,
      partial: plan.partial,
      draftId: plan.draftId,
    }));
  const plannedSessions = homeSessionsAfterPlans(programSessions, homePlans) as ResolvedPlanSession[];
  const nextDate = todayPlan.active ? null : nextActiveDate(prefs, selected, tz, swaps);
  const nextBuilt = nextDate ? planForDate(prefs, nextDate, tz, swaps) : null;
  const nextEased = nextBuilt && nextDate ? await easePlanForUser(userId, nextDate, tz, nextBuilt) : null;
  const nextPlan = nextEased?.plan ?? null;
  const nextSessions = nextPlan ? resolvePlanSessions(nextPlan, { strength, skill }) : [];
  const nextSession: ResolvedPlanSession | null =
    nextSessions.find((session) => session.day) ?? nextSessions[0] ?? null;
  const suggestedDay =
    plannedSessions.find((session) => session.day)?.day ??
    nextSession?.day ??
    plannedSessions[0]?.day ??
    null;
  const completedDayIds = [
    ...new Set([
      ...sessions
        .filter((session) => {
          if (!session.programDayId || !sameLocalDay(session.performedAt, selected, tz)) {
            return false;
          }
          const planned = plannedSessions.find((row) => row.dayId === session.programDayId);
          const progress = homeProgress(
            session,
            planByDay.get(session.programDayId),
            planned?.day?.exercises ?? session.programDay?.exercises ?? [],
            edits,
            tz,
            profile?.onboardingCompletedAt ?? null,
          );
          return session.status === "complete" && progress.done;
        })
        .map((session) => session.programDayId as string),
      ...homePlans.filter((plan) => plan.complete).map((plan) => homePlanDayId(plan.id)),
    ]),
  ];
  const finishedToday = new Set(completedDayIds);
  const resumeByDay: Record<string, { id: string; partial: boolean; ticked?: number; planned?: number }> = {};
  if (sameLocalDay(selected, now, tz)) {
    for (const [dayId, log] of openLogsByProgramDay(resumable, todayKey, tz, planByDay, {
      edits,
      anchor: profile?.onboardingCompletedAt ?? null,
    })) {
      if (finishedToday.has(dayId) && !log.partial) continue;
      resumeByDay[dayId] = { id: log.id, partial: log.partial, ticked: log.ticked, planned: log.planned };
    }
    const custom = openCustomLog(resumable, todayKey, tz);
    if (custom) {
      resumeByDay[CUSTOM_HOME_RESUME] = {
        id: custom.id,
        partial: custom.partial,
        ticked: custom.ticked,
        planned: custom.planned,
      };
    }
    for (const plan of homePlans) {
      if (plan.complete || !plan.draftId) continue;
      resumeByDay[homePlanDayId(plan.id)] = { id: plan.draftId, partial: plan.partial };
    }
  }
  const draft =
    drafts.find(
      (row) =>
        !isPastEmptyDraft(row, todayKey, tz) &&
        !(row.programDayId && finishedToday.has(row.programDayId)),
    ) ??
    sessions.find(
      (row) =>
        row.status === "draft" &&
        !isPastEmptyDraft(row, todayKey, tz) &&
        !(row.programDayId && finishedToday.has(row.programDayId)),
    );
  const loggedOnSelected = sessions.find(
    (session) =>
      sessionCountsAsPlannedCompletion(
        session,
        [],
        prescribedSetTotal(session.programDay?.exercises),
      ) &&
      sameLocalDay(session.performedAt, selected, tz),
  );

  const completedLessonIds = new Set(
    progress.filter((row) => row.completed).map((row) => row.lessonId),
  );
  const preferredLevel = preferredLearnLevel(profile);
  const preferredTopic = preferredLearnTopic(profile);
  const matchedLessons = allLessons.filter((lesson) => {
    const levelOk = lesson.skillLevel === preferredLevel;
    const topicOk = !preferredTopic || lesson.topic === preferredTopic;
    return levelOk && topicOk;
  });
  const fallbackLessons = allLessons.filter((lesson) => lesson.skillLevel === "beginner");
  const lessonPool = matchedLessons.length > 0 ? matchedLessons : fallbackLessons;
  const scOnly = isScOnly(profile?.trainingFocus);
  const incompleteLesson = scOnly
    ? null
    : (lessonPool.find((lesson) => !completedLessonIds.has(lesson.id)) ??
      allLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ??
      null);
  const sparringLog =
    todayPlan.outside?.kind === "sparring"
      ? await getSparringLog(userId, zonedDayKey(selected, tz))
      : null;

  const anchor = profile?.onboardingCompletedAt ?? null;
  const withVisiblePlan = <T extends ResolvedPlanSession>(session: T, onDate: Date): T => {
    const log = [...resumable, ...sessions].find(
      (row) =>
        Boolean(session.dayId) &&
        row.programDayId === session.dayId &&
        sameLocalDay(row.performedAt, onDate, tz),
    );
    return withVisiblePlanExercises(session, {
      edits,
      blockKey: trainingBlockKey(log?.performedAt ?? onDate, tz, anchor),
      sessionId: log?.id ?? "",
    });
  };

  return {
    selected,
    timeZone: tz,
    isToday: sameLocalDay(selected, now, tz),
    suggestedDay,
    plannedSessions: plannedSessions.map((session) => withVisiblePlan(session, selected)),
    nextSession: nextSession ? withVisiblePlan(nextSession, nextDate ?? selected) : null,
    nextSessionWeekday: nextPlan?.weekday ?? "",
    weekStrip: withBikeChipLogHrefs(
      await easeWeekStripDays(
        userId,
        prefs,
        weekStrip(prefs, now, tz, selected, swaps, selected),
        tz,
        swaps,
      ),
      prefs,
      { strength, skill },
      tz,
      swaps,
    ),
    planWeekday: todayPlan.weekday,
    planSummary: todayPlan.summary,
    mesoLabel: todayPlan.mesoLabel,
    outsideKind: todayPlan.outside?.kind ?? null,
    outsideLabel: todayPlan.outside?.label ?? "",
    dayNote: todayPlan.dayNote ?? "",
    easeNote: todayPlan.easeNote ?? "",
    coachCheckIn: easedToday.checkIn,
    sparringLog,
    suggestionCopy: hasCatalog
      ? demoSuggestionCopy({
          goalKey: profile?.goalKey,
          primaryFocus: profile?.primaryFocus,
        })
      : "Training days are not loaded on this preview yet. Your account and logs still work.",
    draft: sameLocalDay(selected, now, tz) ? draft : undefined,
    resumeByDay,
    completedDayIds,
    partialDayIds: [
      ...partialProgramDayIds(
        sessions,
        selected,
        tz,
        plannedSessions,
        planByDay,
        edits,
        profile?.onboardingCompletedAt ?? null,
      ),
      ...homePlans.filter((plan) => plan.partial && !plan.complete).map((plan) => homePlanDayId(plan.id)),
    ],
    loggedOnSelected: loggedOnSelected ?? null,
    foodToday,
    foodNudge:
      foodToday.entryCount === 0
        ? "No food logged this day yet. A rough estimate is enough."
        : null,
    incompleteLesson,
    activity,
    targets: nutritionTargetsFromProfile(profile),
    firstName: firstNameFrom(profile?.displayName ?? ""),
    goals: profile?.goals ?? "",
    sessions,
    needsDeepPrompt: needsDeepOnboardingPrompt(profile),
    sessionHint: sessionLengthHint(profile?.sessionLengthMin ?? null),
    locationHint: trainingLocationHint(profile?.trainingLocation ?? ""),
    competitionNote: competitionNote(
      profile?.competitionStatus ?? "",
      profile?.nextFightDate ?? null,
    ),
  };
}
