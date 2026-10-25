import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  bikeTimerLogSets,
  bikeTimerSessionSeconds,
  scheduledRoundPlanTarget,
} from "@/lib/bike-timer-log";
import { bikeTimerRoundCount, type BikeChoice } from "@/lib/bike-chooser";
import {
  roundLogSets,
  roundSaveStatus,
  roundSessionDuration,
  roundTargetForProgramDay,
  ROUND_SESSION_TITLES,
  sameRoundClock,
  sessionMatchesRoundType,
  setBelongsToRoundType,
  setIsSavedRoundWork,
  trimRoundSessionSeconds,
  trimRoundSetSeconds,
  type RoundSessionType,
} from "@/lib/round-session";
import { textIsBikeWorkout } from "@/lib/timer-session";
import { ForbiddenError, NotFoundError, AppError, StaleDraftError } from "@/lib/errors";
import { APP_LOAD_UNIT, convertLoad, isLoadUnit, roundLoadForInput, type LoadUnit } from "@/lib/units";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { rirFromLoadText } from "@/lib/rir";
import { sessionCivilDay, sessionCompletionDay } from "@/lib/performed-at";
import { APP_TIMEZONE, dayKey, endOfZonedDay, startOfZonedDay, zonedCivilToUtc } from "@/lib/timezone";
import { getProgramDayById } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { calendarPlanDoses, withCalendarScaleMemory } from "@/lib/plan-doses";
import { sessionProgress } from "@/lib/session-progress";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { parseDifficultyRating } from "@/lib/difficulty";
import { parseSessionRpe } from "@/lib/bagwork";
import { isBikeIntervalName, memberWeekIndex } from "@/lib/bike-sessions";
import { halvedSetCount } from "@/lib/recovery-ease";
import { gymExerciseKey, loggedExerciseName } from "@/lib/gym-exercise";
import { getActiveCampSnapshot } from "@/lib/fight-camp";
import {
  hidesLoad,
  isDurationMode,
  isLogMode,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  scaleBandFromPrefs,
  scaleProgramDay,
  type ScalePrefs,
} from "@/lib/training-scale";
import { DELOAD_LABEL } from "@/lib/training-cycle";
import { memberFacingTitle } from "@/lib/member-copy";
import { SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import { applySwapsToExercises, trainingBlockKey } from "@/lib/exercise-swap";
import { visibleDoseForSession, namedSetRows } from "@/lib/finish-plan";
import { loadMemberExerciseEdits } from "@/lib/member-exercise-edits";
import { bindPendingSwaps, listSwapsForDay } from "@/lib/exercise-swap-store";
import { omitRemovedSlots } from "@/lib/exercise-removal";
import {
  activeRemovalsForSession,
  bindPendingRemovals,
  listRemovalsForDay,
  setsKeepingRemovals,
} from "@/lib/exercise-removal-store";
import {
  draftHasResumeWork,
  loggedSetSome,
  offPlanSessionDone,
  prescribedSetTotal,
  prepareSetsForPersist,
  resolvedPlannedSetCount,
  sessionCountsAsPlannedCompletion,
  sessionHasLoggedWork,
  sessionOpensFinishScreen,
  setHasLoggedWork,
  tickedSetCount,
  withTickedPlanWork,
} from "@/lib/logged-work";
import {
  freezeElapsedOnSave,
  plausibleElapsed,
  resolveSessionElapsed,
  resumeStoredElapsed,
  sessionRecordsActivity,
  usableStoredElapsed,
} from "@/lib/session-elapsed";
import {
  attachWorkoutTimer,
  readDraftTimerFields,
  readTimerFieldsByIds,
  readWorkoutTimerFields,
  workoutTimerColumnsAvailable,
  type WorkoutTimerFields,
} from "@/lib/workout-timer-columns";

export type WorkoutSetInput = {
  id?: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: LoadUnit;
  logMode?: LogMode;
  durationSeconds?: number | null;
  completed: boolean;
  notes?: string;
  prescriptionKey?: string;
  rir?: string;
};

function assertOwnSession<T extends { userId: string }>(
  session: T | null,
  userId: string,
): T {
  if (!session) {
    throw new NotFoundError("Workout not found.");
  }
  if (session.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's workout.");
  }
  return session;
}

const WORKOUT_LIST_INCLUDE = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
  programDay: { include: { program: true, exercises: { select: { name: true, sets: true } } } },
  savedWorkout: { select: { name: true } },
};

export const RECENT_SESSION_TAKE = 20;
export const DRAFT_SESSION_TAKE = 8;
export const PROGRESS_SESSION_TAKE = 40;

export async function listWorkoutSessionsForUser(userId: string) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    include: WORKOUT_LIST_INCLUDE,
  });
}

export async function listRecentSessionsForUser(
  userId: string,
  take = RECENT_SESSION_TAKE,
) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take,
    include: WORKOUT_LIST_INCLUDE,
  });
}

export async function listDraftSessionsForUser(
  userId: string,
  take = DRAFT_SESSION_TAKE,
) {
  return prisma.workoutSession.findMany({
    where: { userId, status: "draft" },
    orderBy: { performedAt: "desc" },
    take,
    include: WORKOUT_LIST_INCLUDE,
  });
}

/**
 * Drafts, partials, and recent saves the member can open again. Newest first.
 * A short save stays status complete until the prescription is finished, so
 * those rows are included and the caller drops a planned completion.
 * A draft counts only when a set was ticked or the member edited one.
 * Unticked library prefills stay out.
 */
export async function listResumableSessionsForUser(userId: string, take = 40) {
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      sets: loggedSetSome,
      status: { in: ["draft", "partial", "complete"] },
    },
    orderBy: { performedAt: "desc" },
    take: Math.max(take * 5, take),
    include: {
      sets: {
        select: {
          exerciseName: true,
          completed: true,
          reps: true,
          loadValue: true,
          durationSeconds: true,
          notes: true,
          prescriptionKey: true,
          logMode: true,
        },
      },
      programDay: {
        include: {
          program: true,
          exercises: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  const kept = rows
    .filter((row) => row.status !== "draft" || draftHasResumeWork(row.sets))
    .slice(0, take);
  const timers = await readTimerFieldsByIds(
    kept.map((row) => row.id),
    prisma,
  );
  return kept.map((row) => {
    const timer = timers.get(row.id);
    return timer ? { ...row, ...timer } : row;
  });
}

export async function countWorkoutSessionsForUser(userId: string) {
  return prisma.workoutSession.count({ where: { userId } });
}

export type PreviousSetLookup = Record<
  string,
  Record<
    number,
    {
      reps: number | null;
      loadValue: number | null;
      loadUnit: string;
      logMode?: string;
      durationSeconds?: number | null;
      rir?: string;
      prescriptionKey?: string;
    }
  >
>;

export type PreviousSlotQuery = {
  exerciseName: string;
  prescriptionKey: string;
};

function toPreviousSet(set: {
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode: string;
  durationSeconds: number | null;
  rir: string;
  prescriptionKey: string;
}) {
  return {
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: set.durationSeconds,
    rir: set.rir ?? "",
    prescriptionKey: set.prescriptionKey ?? "",
  };
}

/**
 * Last completed session per exercise name for this member only.
 * Used for the Previous column on the logger. Empty for first-time moves.
 */
export async function getPreviousLoadsForUser(
  userId: string,
  exerciseNames: string[],
  excludeWorkoutId?: string,
): Promise<PreviousSetLookup> {
  const unique = [...new Set(exerciseNames.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return {};
  }

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { in: ["complete", "partial"] },
      ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
      sets: { some: { exerciseName: { in: unique } } },
    },
    orderBy: { performedAt: "desc" },
    include: {
      sets: {
        where: { exerciseName: { in: unique } },
        orderBy: [{ setNumber: "asc" }, { sortOrder: "asc" }],
      },
    },
    take: 40,
  });

  const result: PreviousSetLookup = {};
  for (const name of unique) {
    const session = sessions.find((row) =>
      row.sets.some((set) => set.exerciseName === name && setHasLoggedWork(set)),
    );
    if (!session) continue;
    result[name] = {};
    for (const set of session.sets) {
      if (set.exerciseName !== name || !setHasLoggedWork(set)) continue;
      result[name][set.setNumber] = toPreviousSet(set);
    }
  }
  return result;
}

/**
 * Last completed set for each prescription slot. A keyed 8–12 session is not
 * reused as the previous load for a 5×5 slot. Unkeyed history is only a
 * fallback when this slot has never been logged with a key.
 */
export async function getPreviousLoadsForSlots(
  userId: string,
  slots: PreviousSlotQuery[],
  excludeWorkoutId?: string,
): Promise<PreviousSetLookup> {
  const unique = new Map<string, PreviousSlotQuery>();
  for (const slot of slots) {
    const exerciseName = slot.exerciseName.trim();
    const prescriptionKey = slot.prescriptionKey.trim();
    if (!exerciseName) continue;
    const id = prescriptionKey || `name:${exerciseName}`;
    if (!unique.has(id)) unique.set(id, { exerciseName, prescriptionKey });
  }
  const list = [...unique.values()];
  if (list.length === 0) return {};

  const names = [...new Set(list.map((slot) => slot.exerciseName))];
  const keys = list.map((slot) => slot.prescriptionKey).filter(Boolean);
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { in: ["complete", "partial"] },
      ...(excludeWorkoutId ? { id: { not: excludeWorkoutId } } : {}),
      sets: {
        some: {
          OR: [
            ...(keys.length ? [{ prescriptionKey: { in: keys } }] : []),
            { exerciseName: { in: names }, prescriptionKey: "" },
          ],
        },
      },
    },
    orderBy: { performedAt: "desc" },
    include: {
      sets: {
        where: {
          OR: [
            ...(keys.length ? [{ prescriptionKey: { in: keys } }] : []),
            { exerciseName: { in: names }, prescriptionKey: "" },
          ],
        },
        orderBy: [{ setNumber: "asc" }, { sortOrder: "asc" }],
      },
    },
    take: 40,
  });

  const result: PreviousSetLookup = {};
  for (const slot of list) {
    const exact = slot.prescriptionKey
      ? sessions.find((row) =>
          row.sets.some(
            (set) => set.prescriptionKey === slot.prescriptionKey && setHasLoggedWork(set),
          ),
        )
      : undefined;
    const legacy = sessions.find((row) =>
      row.sets.some(
        (set) =>
          set.exerciseName === slot.exerciseName &&
          set.prescriptionKey === "" &&
          setHasLoggedWork(set),
      ),
    );
    const chosen = exact ?? legacy;
    if (!chosen) continue;
    const keyed = Boolean(exact);
    if (!result[slot.exerciseName]) result[slot.exerciseName] = {};
    for (const set of chosen.sets) {
      const matches = keyed
        ? set.prescriptionKey === slot.prescriptionKey
        : set.exerciseName === slot.exerciseName && !set.prescriptionKey;
      if (!matches || !setHasLoggedWork(set)) continue;
      result[slot.exerciseName][set.setNumber] = toPreviousSet(set);
    }
  }
  return result;
}

export async function completedProgramDayIdsOnDay(
  userId: string,
  dayIds: string[],
  day: Date,
  timeZone: string,
) {
  const ids = [...new Set(dayIds.filter(Boolean))];
  if (ids.length === 0) return [] as string[];
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      programDayId: { in: ids },
      performedAt: {
        gte: new Date(startOfZonedDay(day, timeZone).getTime() - DAY_PAD_MS),
        lt: new Date(endOfZonedDay(day, timeZone).getTime() + DAY_PAD_MS),
      },
      sets: loggedSetSome,
    },
    select: {
      id: true,
      status: true,
      programDayId: true,
      performedAt: true,
      plannedSetCount: true,
      programDay: {
        select: { dayNumber: true, program: { select: { slug: true } } },
      },
      sets: {
        select: {
          exerciseName: true,
          completed: true,
          reps: true,
          loadValue: true,
          durationSeconds: true,
          prescriptionKey: true,
          logMode: true,
        },
      },
    },
  });
  const [targets, doses, edits, profile] = await Promise.all([
    plannedTargetsByDay(ids),
    calendarPlanDoses(userId, day),
    loadMemberExerciseEdits(userId),
    getProfileForUser(userId),
  ]);
  const anchor = profile?.onboardingCompletedAt ?? null;
  const key = dayKey(day, timeZone);
  return [
    ...new Set(
      rows
        .filter((row) => {
          if (!row.programDayId || sessionCompletionDay(row, timeZone) !== key) return false;
          const plan = doses.get(row.programDayId);
          const names =
            plan && plan.names.length > 0 ? [...plan.names] : (targets.names.get(row.programDayId) ?? []);
          const dose = plan && plan.dose > 0 ? plan.dose : (targets.doses.get(row.programDayId) ?? 0);
          const programmed = namedSetRows(plan?.exercises);
          const visible =
            programmed.length > 0
              ? visibleDoseForSession({
                  exercises: programmed,
                  catalogDose: dose,
                  sessionId: row.id,
                  blockKey: trainingBlockKey(row.performedAt, timeZone, anchor),
                  programSlug: row.programDay?.program.slug,
                  dayNumber: row.programDay?.dayNumber,
                  edits,
                  loggedSets: row.sets,
                })
              : null;
          return sessionProgress(
            {
              status: row.status,
              programDayId: row.programDayId,
              plannedSetCount: row.plannedSetCount,
              sets: row.sets,
            },
            {
              dose: visible?.dose ?? dose,
              names: visible?.names ?? names,
              exercises: visible?.exercises ?? plan?.exercises,
            },
          ).done;
        })
        .map((row) => row.programDayId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

async function plannedTargetsByDay(dayIds: string[]) {
  const exercises = await prisma.programExercise.findMany({
    where: { programDayId: { in: dayIds } },
    select: { programDayId: true, name: true, sets: true },
  });
  const names = new Map<string, string[]>();
  const doses = new Map<string, number>();
  for (const exercise of exercises) {
    const list = names.get(exercise.programDayId) ?? [];
    list.push(exercise.name);
    names.set(exercise.programDayId, list);
    const count = Math.max(0, Math.round(exercise.sets ?? 0));
    doses.set(exercise.programDayId, (doses.get(exercise.programDayId) ?? 0) + count);
  }
  return { names, doses };
}

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

/**
 * Program days whose completion date, in the member zone, is one of these
 * civil days. The same day the week strip checks.
 */
export async function completedProgramDayIdsOnDays(
  userId: string,
  dayKeys: string[],
  timeZone: string,
) {
  const keys = [...new Set(dayKeys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))].sort();
  if (keys.length === 0) return [] as string[];
  const [startYear, startMonth, startDay] = keys[0]!.split("-").map(Number);
  const [endYear, endMonth, endDay] = keys[keys.length - 1]!.split("-").map(Number);
  const from = zonedCivilToUtc(startYear!, startMonth!, startDay!, timeZone);
  const to = endOfZonedDay(zonedCivilToUtc(endYear!, endMonth!, endDay!, timeZone), timeZone);
  const keySet = new Set(keys);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      programDayId: { not: null },
      sets: loggedSetSome,
      performedAt: {
        gte: new Date(from.getTime() - DAY_PAD_MS),
        lte: new Date(to.getTime() + DAY_PAD_MS),
      },
    },
    select: {
      status: true,
      programDayId: true,
      performedAt: true,
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
    },
  });
  const targets = await plannedTargetsByDay(
    rows.map((row) => row.programDayId).filter((id): id is string => Boolean(id)),
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.programDayId) continue;
    if (!keySet.has(sessionCompletionDay(row, timeZone))) continue;
    if (
      !sessionCountsAsPlannedCompletion(
        row,
        targets.names.get(row.programDayId) ?? [],
        targets.doses.get(row.programDayId) ?? null,
      )
    ) {
      continue;
    }
    ids.add(row.programDayId);
  }
  return [...ids];
}

/**
 * Local days in [from, to) that have a finished session. Same day key as Calendar.
 * The dose is the session's own week, not `now`. A programmed session counts
 * only when a ticked set belongs to that plan.
 */
export function completedLocalDayKeys(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  now = new Date(),
) {
  return withCalendarScaleMemory(() => completedLocalDayKeysNow(userId, from, to, timeZone, now));
}

async function completedLocalDayKeysNow(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
  now = new Date(),
) {
  const fromKey = dayKey(from, timeZone);
  const endKey = dayKey(to, timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      sets: loggedSetSome,
      performedAt: {
        gte: new Date(from.getTime() - DAY_PAD_MS),
        lt: new Date(to.getTime() + DAY_PAD_MS),
      },
    },
    select: {
      status: true,
      programDayId: true,
      performedAt: true,
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
    },
  });
  const ids = rows.map((row) => row.programDayId).filter((id): id is string => Boolean(id));
  const targets = await plannedTargetsByDay(ids);
  const finished = await Promise.all(
    rows.map(async (row) => {
      const at = row.performedAt ?? now;
      const plan = row.programDayId ? (await calendarPlanDoses(userId, at)).get(row.programDayId) : undefined;
      const names =
        plan && plan.names.length > 0
          ? [...plan.names]
          : row.programDayId
            ? (targets.names.get(row.programDayId) ?? [])
            : [];
      const dose =
        plan && plan.dose > 0
          ? plan.dose
          : row.programDayId
            ? (targets.doses.get(row.programDayId) ?? null)
            : null;
      if (!offPlanSessionDone(row, dose ?? 0, names)) return null;
      const key = sessionCompletionDay(row, timeZone);
      return key >= fromKey && key < endKey ? key : null;
    }),
  );
  return [...new Set(finished.filter((key): key is string => key != null))];
}

const WORKOUT_DETAIL_INCLUDE = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
  programDay: { include: { program: true, exercises: true } },
};

export async function getOwnWorkoutSessionOrNull(workoutId: string, userId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: WORKOUT_DETAIL_INCLUDE,
  });
  if (!session || session.userId !== userId) return null;
  return attachWorkoutTimer(session, prisma);
}

export async function getWorkoutSessionForUser(
  workoutId: string,
  userId: string,
) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: WORKOUT_DETAIL_INCLUDE,
  });
  return attachWorkoutTimer(assertOwnSession(session, userId), prisma);
}

const ROUND_LOG_NAMES = {
  bag: "Heavy bag rounds",
  pads: "Pad rounds",
  sparring: "Sparring rounds",
  grappling: "Grappling rounds",
} as const;

export async function startRoundWorkoutForUser(input: {
  userId: string;
  mode: keyof typeof ROUND_LOG_NAMES;
  rounds: number;
  workSeconds: number;
  preferredUnits: LoadUnit;
}) {
  const name = ROUND_LOG_NAMES[input.mode];
  const count = Math.min(20, Math.max(1, Math.round(input.rounds)));
  const duration = Math.min(3600, Math.max(5, Math.round(input.workSeconds)));
  const sets = Array.from({ length: count }, (_, index) => ({
    exerciseName: name,
    setNumber: index + 1,
    sortOrder: index,
    reps: null,
    loadValue: null,
    loadUnit: input.preferredUnits,
    logMode: "timed_round" as const,
    durationSeconds: duration,
    completed: true,
  }));
  return prisma.workoutSession.create({
    data: {
      userId: input.userId,
      title: name,
      performedAt: new Date(),
      status: "draft",
      plannedSetCount: count,
      sets: { create: sets },
    },
    include: { sets: true },
  });
}

/**
 * One log for a round-based save. A second save updates that same row when it
 * keeps or adds rounds. A shorter timer save is a new session: it must not
 * shrink a log that already has more rounds or replace its stored time.
 * Today's matching program day is linked when the plan has one.
 * A mixed day stays partial so the logger can still finish the other work.
 * Only a round-only day is complete, and only when its rounds are covered.
 * The stored plan count is the level-scaled day, the same number Done uses.
 */
export async function logRoundSessionForUser(input: {
  userId: string;
  type: RoundSessionType;
  roundsCompleted: number;
  workSeconds: number;
  restSeconds: number;
  notes?: string;
  rpe?: number | null;
  programDayId?: string | null;
  now?: Date;
  configuredRounds?: number | null;
  title?: string;
  sets?: WorkoutSetInput[];
  elapsedSeconds?: number | null;
}) {
  const roundsCompleted = Math.round(input.roundsCompleted);
  if (!Number.isInteger(roundsCompleted) || roundsCompleted < 1) {
    throw new AppError("WORKOUT", "Finish a round before logging.");
  }
  const profile = await getProfileForUser(input.userId);
  const timeZone = await timeZoneForUser(input.userId, profile?.timeZone ?? null);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const now = input.now ?? new Date();
  const explicit = input.programDayId
    ? await roundTargetForProgramDay({
        userId: input.userId,
        programDayId: input.programDayId,
        type: input.type,
        now,
      })
    : null;
  const scheduled = explicit ? null : await scheduledRoundPlanTarget(input.userId, input.type, now);
  const target = explicit ?? scheduled;
  const programDayId = target?.programDayId ?? null;
  const configured =
    input.configuredRounds == null ? null : Math.max(1, Math.round(input.configuredRounds));
  const plannedRounds = target?.plannedRounds ?? configured ?? roundsCompleted;
  const workSeconds = trimRoundSetSeconds(
    Math.max(1, Math.round(input.workSeconds) || target?.workSeconds || 180),
  );
  const requestedRest = Number.isFinite(input.restSeconds) ? Math.round(input.restSeconds) : 0;
  const restSeconds =
    requestedRest > 0 ? requestedRest : Math.max(0, Math.round(target?.restSeconds ?? 0));
  const builtSets =
    input.sets ??
    roundLogSets({
      type: input.type,
      exerciseName: target?.exerciseName || ROUND_SESSION_TITLES[input.type],
      rounds: roundsCompleted,
      workSeconds,
      restSeconds,
      unit: units,
    });
  const roundSets = builtSets.map((set) => ({
    ...set,
    durationSeconds:
      set.durationSeconds == null ? set.durationSeconds : trimRoundSetSeconds(set.durationSeconds),
  }));
  if (roundSets.length < 1) {
    throw new AppError("WORKOUT", "Finish a round before logging.");
  }
  const roundTitle = (input.title || target?.exerciseName || ROUND_SESSION_TITLES[input.type]).trim();
  const elapsed = trimRoundSessionSeconds(
    input.elapsedSeconds ?? roundSessionDuration(roundsCompleted, workSeconds, restSeconds),
  );
  const workoutId = await reuseRoundSessionId({
    userId: input.userId,
    type: input.type,
    programDayId,
    now,
    timeZone,
    title: roundTitle,
    incomingRounds: roundSets.length,
    workSeconds,
    restSeconds,
  });
  const existing = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!existing || existing.userId !== input.userId) {
    throw new NotFoundError("Workout not found.");
  }
  const keptSet = (set: (typeof existing.sets)[number]): WorkoutSetInput => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: isLoadUnit(set.loadUnit) ? set.loadUnit : ("lb" as const),
    logMode: isLogMode(set.logMode) ? set.logMode : undefined,
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey,
    rir: set.rir,
  });
  const sets: WorkoutSetInput[] = [];
  let replacedRounds = false;
  for (const set of existing.sets) {
    if (setBelongsToRoundType(set, input.type)) {
      if (!replacedRounds) {
        sets.push(...roundSets);
        replacedRounds = true;
      }
      continue;
    }
    sets.push(keptSet(set));
  }
  if (!replacedRounds) sets.push(...roundSets);
  const keptCount = sets.length - roundSets.length;
  const daySetCount = target && target.daySetCount > 0 ? target.daySetCount : null;
  // One count: the level-scaled day. A free timer has no day, so the round plan is the count.
  const plannedSetCount = daySetCount ?? plannedRounds;
  const mixedDay = keptCount > 0 || (daySetCount != null && daySetCount > plannedRounds);
  const status = mixedDay
    ? ("partial" as const)
    : roundSaveStatus({
        roundsCompleted,
        plannedRounds,
        configuredRounds: configured,
      });
  const priorTimer = await readWorkoutTimerFields(workoutId, prisma);
  const keptElapsed = usableStoredElapsed(priorTimer.elapsedSeconds);
  // A longer clock replaces the stored one. A shorter clock must not erase it.
  const elapsedToStore = keptElapsed == null ? elapsed : Math.max(keptElapsed, elapsed);
  return updateWorkoutSessionForUser({
    userId: input.userId,
    workoutId,
    title: keptCount > 0 ? existing.title : roundTitle,
    performedAt: now,
    notes: input.notes ?? "",
    status,
    sets,
    rest: null,
    timeZone,
    elapsedSeconds: elapsedToStore,
    plannedSetCount,
    sessionRpe: input.rpe === undefined ? undefined : input.rpe,
    retainEmptySets: keptCount > 0,
    keepOwnSession: true,
  });
}

function loggedRoundsForType(
  sets: {
    exerciseName?: string | null;
    logMode?: string | null;
    prescriptionKey?: string | null;
    reps?: number | null;
    loadValue?: number | null;
    durationSeconds?: number | null;
  }[],
  type: RoundSessionType,
) {
  return sets.filter((set) => setBelongsToRoundType(set, type) && setHasLoggedWork(set)).length;
}

async function reuseRoundSessionId(input: {
  userId: string;
  type: RoundSessionType;
  programDayId: string | null;
  now: Date;
  timeZone: string;
  title: string;
  /** Logged rounds this save would write. A row with more than this is left alone. */
  incomingRounds: number;
  workSeconds: number;
  restSeconds: number;
}) {
  const from = new Date(input.now.getTime() - 36 * 60 * 60 * 1000);
  const to = new Date(input.now.getTime() + 36 * 60 * 60 * 1000);
  const today = dayKey(input.now, input.timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId: input.userId,
      programDayId: input.programDayId,
      status: { in: ["draft", "partial", "complete"] },
      performedAt: { gte: from, lte: to },
    },
    include: {
      sets: {
        select: {
          exerciseName: true,
          logMode: true,
          prescriptionKey: true,
          reps: true,
          loadValue: true,
          durationSeconds: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const matches = rows.filter(
    (row) =>
      sessionCompletionDay({ performedAt: row.performedAt }, input.timeZone) === today &&
      sessionMatchesRoundType(row, input.type),
  );
  const fits = (row: (typeof matches)[number]) => {
    const logged = loggedRoundsForType(row.sets, input.type);
    if (logged > input.incomingRounds) return false;
    if (logged === 0) return true;
    return sameRoundClock(row.sets, input.type, input.workSeconds, input.restSeconds);
  };
  const saved = matches.find(
    (row) => (row.status === "complete" || row.status === "partial") && fits(row),
  );
  const draft = matches.find((row) => row.status === "draft" && fits(row));
  if (saved) return saved.id;
  if (draft) return draft.id;
  const created = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      programDayId: input.programDayId,
      title: input.title,
      performedAt: input.now,
      status: "draft",
    },
  });
  return created.id;
}

/**
 * A real Assault Bike timer save. Completes today's scheduled bike day when
 * the plan has one, through the same session update lifts use. A draft is not
 * enough to mark the day done. Fewer rounds than the plan stay Partial.
 */
export async function logBikeRoundsForUser(input: {
  userId: string;
  choice: BikeChoice;
  now?: Date;
  roundsCompleted: number;
  notes?: string;
  rpe?: number | null;
  programDayId?: string | null;
}) {
  const roundsCompleted = Math.round(input.roundsCompleted);
  if (!Number.isInteger(roundsCompleted) || roundsCompleted < 1) {
    throw new AppError("WORKOUT", "Finish a round before logging.");
  }
  const profile = await getProfileForUser(input.userId);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const sets = bikeTimerLogSets(input.choice, units, roundsCompleted);
  return logRoundSessionForUser({
    userId: input.userId,
    type: "bike",
    roundsCompleted,
    workSeconds: input.choice.spec.workSeconds,
    restSeconds: input.choice.spec.restSeconds,
    notes: input.notes,
    rpe: input.rpe,
    programDayId: input.programDayId,
    now: input.now,
    configuredRounds: bikeTimerRoundCount(input.choice),
    title: input.choice.name,
    sets,
    elapsedSeconds: bikeTimerSessionSeconds(input.choice, sets.length),
  });
}

const BIKE_LOGGER_SET_CAP_SECONDS = 60 * 60;
const BIKE_LOGGER_SESSION_CAP_SECONDS = 4 * 60 * 60;

/**
 * Finish the open logger from the bike clock. A My Workout or custom bike
 * has no program day, so the ride is written onto that session and the
 * completed screen can open. Per-set time stays inside the 60-minute hold.
 */
export async function completeBikeLoggerSession(input: {
  userId: string;
  workoutId: string;
  choice: BikeChoice;
  roundsCompleted: number;
  notes?: string;
  rpe?: number | null;
}) {
  const roundsCompleted = Math.round(input.roundsCompleted);
  if (!Number.isInteger(roundsCompleted) || roundsCompleted < 1 || roundsCompleted > 80) {
    throw new AppError("WORKOUT", "Finish a round before logging.");
  }
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
      include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    }),
    input.userId,
  );
  if (existing.status !== "draft") {
    throw new AppError("WORKOUT", "This workout is already saved.");
  }
  const profile = await getProfileForUser(input.userId);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const prescribed = Math.max(1, bikeTimerRoundCount(input.choice));
  const done = Math.min(prescribed, roundsCompleted);
  const bikeSets = bikeTimerLogSets(input.choice, units, done).map((set, index) => ({
    exerciseName: set.exerciseName,
    setNumber: index + 1,
    sortOrder: index,
    reps: null as number | null,
    loadValue: null as number | null,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: Math.min(BIKE_LOGGER_SET_CAP_SECONDS, Math.max(1, Math.round(set.durationSeconds))),
    completed: true,
    notes: "",
    prescriptionKey: set.prescriptionKey.slice(0, 160),
  }));
  if (bikeSets.length < 1) {
    throw new AppError("WORKOUT", "Finish a round before logging.");
  }
  const kept = existing.sets.filter(
    (set) => !isBikeIntervalName(set.exerciseName) && !textIsBikeWorkout(set.exerciseName),
  );
  const keptRows = kept.map((set, index) => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    sortOrder: bikeSets.length + index,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds:
      set.durationSeconds == null
        ? null
        : Math.min(BIKE_LOGGER_SET_CAP_SECONDS, Math.max(0, Math.round(set.durationSeconds))),
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey.slice(0, 160),
  }));
  const sets = [...bikeSets, ...keptRows];
  const plannedSetCount = kept.length + prescribed;
  const status = sessionCountsAsPlannedCompletion(
    { status: "complete", sets, plannedSetCount },
    [],
  )
    ? "complete"
    : "partial";
  const elapsed = Math.min(
    BIKE_LOGGER_SESSION_CAP_SECONDS,
    Math.max(1, bikeTimerSessionSeconds(input.choice, done)),
  );
  const timerReady = await workoutTimerColumnsAvailable(prisma);
  const priorTimer = timerReady ? await readWorkoutTimerFields(existing.id, prisma) : null;
  // An open draft has no finish time. Stamp the session's own start only once
  // the ride is complete, never "now", and leave a short ride unfinished.
  const finishedAt =
    status === "complete" ? (priorTimer?.finishedAt ?? existing.performedAt) : null;
  const [, updated] = await prisma.$transaction([
    prisma.workoutSet.deleteMany({ where: { workoutSessionId: existing.id } }),
    prisma.workoutSession.update({
      where: { id: existing.id },
      data: {
        status,
        plannedSetCount,
        title: existing.title.trim() || input.choice.name,
        notes: ((input.notes ?? "").trim() || existing.notes || "").trim().slice(0, 1000),
        ...(input.rpe == null ? {} : { sessionRpe: parseSessionRpe(input.rpe) }),
        sets: { create: sets },
        ...(timerReady ? { elapsedSeconds: elapsed, finishedAt, timerStartedAt: null } : {}),
      },
      include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    }),
  ]);
  return { ...updated, elapsedSeconds: elapsed };
}

const SAME_DAY_SETS = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
};

type PlannedDayShape = {
  title?: string | null;
  focus?: string | null;
  exercises?: { name?: string | null }[] | null;
};

/**
 * A same-day row only continues this plan when it is the same kind of work.
 * A strength log must not open when the member starts the bike, or the reverse.
 */
export function sessionMatchesPlannedDay(
  session: { title?: string | null; sets: { exerciseName?: string | null }[] },
  day: PlannedDayShape,
) {
  const plannedNames = (day.exercises ?? [])
    .map((exercise) => (exercise.name ?? "").trim())
    .filter(Boolean);
  const loggedNames = session.sets.map((set) => (set.exerciseName ?? "").trim()).filter(Boolean);
  const plannedBike = plannedNames.some((name) => isBikeIntervalName(name));
  const loggedBike = loggedNames.filter((name) => isBikeIntervalName(name));
  const loggedOther = loggedNames.filter((name) => !isBikeIntervalName(name));
  if (loggedNames.length === 0) return false;
  if (plannedBike) return loggedBike.length > 0 && loggedOther.length === 0;
  if (plannedNames.length === 0) return loggedOther.length > 0;
  // A strength or bag day still counts when the only logged work is its bike finisher.
  return true;
}

export function matchingDraftId(
  drafts: {
    id: string;
    programDayId: string | null;
    title?: string | null;
    sets: { exerciseName: string }[];
  }[],
  planned: { dayId?: string; day?: PlannedDayShape | null },
) {
  const draft = drafts.find((row) => row.programDayId && row.programDayId === planned.dayId);
  if (!draft) return undefined;
  if (planned.day && !sessionMatchesPlannedDay(draft, planned.day)) return undefined;
  return draft.id;
}

/**
 * One open log per programmed session per civil day.
 * A saved session used to win this lookup, so START reopened a finished
 * strength log on the bike day. Only an open draft whose sets still belong
 * to this day's exercises is reused. Anything else gets a new session.
 */
async function findSameDayProgramSession(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  programDayId: string,
  now: Date,
  timeZone: string,
  plannedNames: string[] = [],
) {
  const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const today = dayKey(now, timeZone);
  const planned = new Set(plannedNames.map((name) => gymExerciseKey(name)));
  const rows = await db.workoutSession.findMany({
    where: {
      userId,
      programDayId,
      status: { in: ["draft", "partial"] },
      OR: [
        { performedAt: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
      ],
    },
    include: SAME_DAY_SETS,
    orderBy: { createdAt: "asc" },
  });
  const same = rows.filter((row) => {
    if (sessionCivilDay(row, timeZone) !== today) return false;
    if (row.sets.length === 0) return false;
    // A partial round-only log is finished for the logger. A mixed partial
    // still has Shadowbox or technique to tick, so Start reopens it.
    if (row.status === "partial" && !row.sets.some((set) => !setIsSavedRoundWork(set))) return false;
    if (planned.size === 0) return true;
    return row.sets.some((set) => planned.has(gymExerciseKey(set.exerciseName)));
  });
  same.sort((left, right) => {
    const rank = (row: (typeof same)[number]) => (sessionHasLoggedWork(row.sets) ? 0 : 1);
    return rank(left) - rank(right) || left.createdAt.getTime() - right.createdAt.getTime();
  });
  return same[0] ?? null;
}

/**
 * A second Save on the same day folds into the finished row when the work
 * is the same. A different kind of session (bike vs strength) stays its own log.
 */
async function findCompletedSameDaySession(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  programDayId: string,
  performedAt: Date,
  timeZone: string,
  exerciseNames: string[],
) {
  const from = new Date(performedAt.getTime() - 36 * 60 * 60 * 1000);
  const to = new Date(performedAt.getTime() + 36 * 60 * 60 * 1000);
  const day = dayKey(performedAt, timeZone);
  const wanted = new Set(exerciseNames.map((name) => gymExerciseKey(name)));
  if (wanted.size === 0) return null;
  const rows = await db.workoutSession.findMany({
    where: {
      userId,
      programDayId,
      status: "complete",
      performedAt: { gte: from, lte: to },
    },
    include: SAME_DAY_SETS,
    orderBy: { createdAt: "asc" },
  });
  return (
    rows.find((row) => {
      if (sessionCompletionDay(row, timeZone) !== day) return false;
      if (row.sets.length === 0) return false;
      return row.sets.some((set) => wanted.has(gymExerciseKey(set.exerciseName)));
    }) ?? null
  );
}

/**
 * Mark a live draft as active and fold the gap since the last mark.
 * A gap of ten minutes or less counts in full. A longer gap counts as ten
 * minutes. Partial and complete logs are rejected. This does not touch sets
 * or updatedAt, so a draft autosave is not marked stale.
 */
export async function recordWorkoutActivityForUser(input: {
  userId: string;
  workoutId: string;
  now?: Date;
}) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
    select: { id: true, userId: true, status: true, createdAt: true },
  });
  if (!existing || existing.userId !== input.userId) {
    throw new NotFoundError("Workout not found.");
  }
  if (!sessionRecordsActivity(existing.status)) {
    throw new AppError("WORKOUT", "Only a live draft can record activity.");
  }
  if (!(await workoutTimerColumnsAvailable(prisma))) {
    return { elapsedSeconds: null as number | null, timerStartedAt: null as Date | null };
  }
  const now = input.now ?? new Date();
  const timer = await readWorkoutTimerFields(existing.id, prisma);
  const stored = resumeStoredElapsed(timer.elapsedSeconds);
  // A draft with a stored clock and no running segment stays put.
  // A heartbeat must not credit the gap since create or start a new segment.
  if (!timer.timerStartedAt && stored != null) {
    return { elapsedSeconds: stored, timerStartedAt: null };
  }
  const base = stored ?? 0;
  const anchor = timer.timerStartedAt ?? existing.createdAt;
  const view = resolveSessionElapsed(
    {
      status: existing.status,
      createdAt: existing.createdAt,
      elapsedSeconds: base,
      timerStartedAt: anchor,
    },
    now,
  );
  const elapsedSeconds = view.stale ? base : view.seconds;
  await prisma.$executeRaw`
    UPDATE "WorkoutSession"
    SET "elapsedSeconds" = ${elapsedSeconds}, "timerStartedAt" = ${now}
    WHERE "id" = ${existing.id} AND "userId" = ${input.userId} AND "status" = 'draft'
  `;
  return { elapsedSeconds, timerStartedAt: now };
}

/**
 * Reopen a short save and put the planned rows back on that same session.
 * A planned completion stays finished. Removed and swapped-out names are not re-added.
 * Call this from the Resume action only. Viewing a log must not run it.
 */
export async function continuePartialWorkoutForUser(input: {
  userId: string;
  workoutId: string;
  preferredUnits: LoadUnit;
  timeZone?: string;
}) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
    include: {
      sets: true,
      programDay: {
        include: {
          program: true,
          exercises: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!existing || existing.userId !== input.userId) {
    throw new NotFoundError("Workout not found.");
  }
  if (!existing.programDay) {
    if (existing.status !== "partial" && existing.status !== "complete") return existing;
    const timerColumns = await workoutTimerColumnsAvailable(prisma);
    const stored = timerColumns ? await readWorkoutTimerFields(existing.id, prisma) : null;
    return prisma.workoutSession.update({
      where: { id: existing.id },
      data: {
        status: "draft",
        // Keep the saved clock and start a new segment. Leaving timerStartedAt
        // empty makes the next save add every second since the log was created.
        ...(stored
          ? {
              finishedAt: null,
              elapsedSeconds: resumeStoredElapsed(stored.elapsedSeconds),
              timerStartedAt: new Date(),
            }
          : {}),
      },
      include: { sets: true, programDay: { include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } } } },
    });
  }

  const profile = await getProfileForUser(input.userId);
  const zone = input.timeZone || APP_TIMEZONE;
  const now = existing.performedAt;
  const band = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const weekIndex = memberWeekIndex(now, profile?.onboardingCompletedAt ?? now, zone);
  const camp = await getActiveCampSnapshot(input.userId, now, zone);
  const rawDay = existing.programDay;
  const day = scaleProgramDay(
    {
      ...rawDay,
      exercises: rawDay.exercises.map((exercise) => ({ ...exercise })),
    },
    {
      band,
      programSlug: rawDay.program.slug,
      weightAccess: profile?.weightAccess,
      weekIndex,
      campPhase: camp?.phase ?? null,
    },
  );
  const calendar = (await calendarPlanDoses(input.userId, now)).get(rawDay.id);
  const names =
    calendar && calendar.names.length > 0
      ? [...calendar.names]
      : day.exercises.map((exercise) => exercise.name);
  const dose =
    calendar && calendar.dose > 0
      ? calendar.dose
      : day.exercises.reduce(
          (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
          0,
        );
  const progressDose = {
    dose,
    names,
    exercises: calendar?.exercises && calendar.exercises.length > 0 ? calendar.exercises : day.exercises,
  };
  if (existing.status === "complete" && sessionProgress(existing, progressDose).done) {
    return existing;
  }

  const swaps = await listSwapsForDay({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
  });
  const swapped = applySwapsToExercises(day.exercises, swaps, {
    sessionId: existing.id,
    blockKey: trainingBlockKey(now, zone, profile?.onboardingCompletedAt ?? null, weekIndex),
    includePending: false,
  });
  const removals = await listRemovalsForDay({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
  });
  const visible = omitRemovedSlots(day.exercises, swapped, removals, {
    sessionId: existing.id,
    includePending: false,
  }).shown;
  const timerColumns = await workoutTimerColumnsAvailable(prisma);

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.workoutSession.findUniqueOrThrow({
      where: { id: existing.id },
      include: { sets: true },
    });
    if (fresh.userId !== input.userId) {
      throw new NotFoundError("Workout not found.");
    }
    if (
      fresh.status === "complete" &&
      sessionProgress({ ...fresh, programDayId: existing.programDayId }, progressDose).done
    ) {
      return fresh;
    }
    const resumeClock =
      timerColumns && (fresh.status === "complete" || fresh.status === "partial")
        ? {
            finishedAt: null,
            elapsedSeconds: resumeStoredElapsed(
              (await readWorkoutTimerFields(fresh.id, tx)).elapsedSeconds,
            ),
            timerStartedAt: new Date(),
          }
        : null;
    await tx.workoutSession.update({
      where: { id: fresh.id },
      data: {
        status: "draft",
        ...(resumeClock ?? {}),
      },
    });
    const lockedSets = await tx.workoutSet.findMany({
      where: { workoutSessionId: fresh.id },
    });
    const counts = new Map<string, number>();
    const taken = new Set<string>();
    for (const set of lockedSets) {
      const key = gymExerciseKey(set.exerciseName);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      taken.add(`${key}:${set.setNumber}`);
    }
    const storedPlan =
      typeof fresh.plannedSetCount === "number" && fresh.plannedSetCount > 0
        ? fresh.plannedSetCount
        : null;
    // The short save already holds the rows it was started with. Filling from
    // the profile scale on top of those rows stacks a second catalog.
    const alreadyHeld = storedPlan != null && lockedSets.length >= storedPlan;
    const loggedBike = lockedSets.some(
      (set) => isBikeIntervalName(set.exerciseName) || textIsBikeWorkout(set.exerciseName),
    );
    const create: Prisma.WorkoutSetCreateManyInput[] = [];
    let prescribedTotal = 0;
    for (const exercise of alreadyHeld ? [] : visible) {
      // "Assault bike intervals" already is the plan's Daru row. A second
      // empty plan set is the same ride under the catalog name.
      if (
        loggedBike &&
        (isBikeIntervalName(exercise.name) || textIsBikeWorkout(exercise.name))
      ) {
        continue;
      }
      const prescribed = Math.max(0, Math.round(exercise.sets));
      prescribedTotal += prescribed;
      const key = gymExerciseKey(exercise.name);
      const have = counts.get(key) ?? 0;
      const mode = resolveLogMode(exercise);
      let slot = 1;
      let added = 0;
      const need = Math.max(0, prescribed - have);
      while (added < need) {
        const token = `${key}:${slot}`;
        if (!taken.has(token)) {
          taken.add(token);
          create.push({
            workoutSessionId: fresh.id,
            exerciseName: exercise.name,
            setNumber: slot,
            sortOrder: (exercise.sortOrder ?? 0) * 10 + slot - 1,
            reps: null,
            loadValue: null,
            loadUnit: input.preferredUnits,
            logMode: mode,
            durationSeconds: null,
            completed: false,
            prescriptionKey: prescriptionSlotKey({
              exerciseName: exercise.name,
              reps: exercise.reps,
              programSlug: rawDay.program.slug,
              dayNumber: rawDay.dayNumber,
            }),
            rir: rirFromLoadText(exercise.loadText) ?? "",
          });
          added += 1;
        }
        slot += 1;
        if (slot > prescribed + have + 8) break;
      }
    }
    if (create.length > 0) {
      await tx.workoutSet.createMany({ data: create });
    }
    if (prescribedTotal > 0) {
      await tx.workoutSession.update({
        where: { id: fresh.id },
        data: { plannedSetCount: prescribedTotal },
      });
    }
    return tx.workoutSession.findUniqueOrThrow({
      where: { id: fresh.id },
      include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    });
  });
}

export async function startWorkoutFromDay(input: {
  userId: string;
  programDayId: string;
  preferredUnits: LoadUnit;
  scale?: ScalePrefs | null;
  deload?: boolean;
  /** Recovery ease: open half the printed sets. */
  half?: boolean;
  timeZone?: string;
  planAnchor?: Date | null;
  now?: Date;
}) {
  const rawDay = await getProgramDayById(input.programDayId);
  const band = scaleBandFromPrefs(input.scale);
  const now = input.now ?? new Date();
  const zone = input.timeZone || APP_TIMEZONE;
  const weekIndex =
    input.scale?.weekIndex ??
    memberWeekIndex(now, input.planAnchor ?? now, zone);
  const camp = await getActiveCampSnapshot(input.userId, now, zone);
  const day = scaleProgramDay(
    {
      ...rawDay,
      exercises: rawDay.exercises.map((exercise) => ({
        ...exercise,
        logMode: exercise.logMode,
      })),
    },
    {
      band,
      programSlug: rawDay.program.slug,
      weightAccess: input.scale?.weightAccess,
      weekIndex,
      campPhase: input.scale?.campPhase ?? camp?.phase ?? null,
    },
  );
  const blockKey = trainingBlockKey(now, input.timeZone || APP_TIMEZONE, input.planAnchor);
  const swaps = await listSwapsForDay({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
  });
  const swapped = applySwapsToExercises(day.exercises, swaps, {
    blockKey,
    includePending: true,
  });
  const pendingNames = day.exercises
    .filter((exercise, index) => swapped[index]?.name !== exercise.name)
    .map((exercise) => exercise.name);
  const removals = await listRemovalsForDay({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
  });
  const visible = omitRemovedSlots(day.exercises, swapped, removals, {
    includePending: true,
  }).shown;
  const sameDay = await findSameDayProgramSession(
    prisma,
    input.userId,
    rawDay.id,
    now,
    zone,
    visible.map((exercise) => exercise.name),
  );
  if (sameDay) return sameDay;
  const shortComplete = await findCompletedSameDaySession(
    prisma,
    input.userId,
    rawDay.id,
    now,
    zone,
    visible.map((exercise) => exercise.name),
  );
  if (shortComplete) {
    const calendar = (await calendarPlanDoses(input.userId, now)).get(rawDay.id);
    const progress = sessionProgress(shortComplete, {
      dose: calendar && calendar.dose > 0 ? calendar.dose : prescribedSetTotal(visible),
      names:
        calendar && calendar.names.length > 0
          ? [...calendar.names]
          : visible.map((exercise) => exercise.name),
      exercises:
        calendar?.exercises && calendar.exercises.length > 0
          ? calendar.exercises
          : visible.map((exercise) => ({ name: exercise.name, sets: exercise.sets })),
    });
    if (!progress.done) {
      return continuePartialWorkoutForUser({
        userId: input.userId,
        workoutId: shortComplete.id,
        preferredUnits: input.preferredUnits,
        timeZone: zone,
      });
    }
  }

  const sets = visible.flatMap((exercise) => {
    const mode = resolveLogMode(exercise);
    // Match the set count printed on the logger card. Deload week used to
    // store ~60% of that count (4 → 2) while the card still said 4 sets.
    const printed = Math.max(0, Math.round(exercise.sets));
    const prescribed = input.half ? halvedSetCount(printed) : printed;
    return Array.from({ length: prescribed }, (_, index) => ({
      exerciseName: exercise.name,
      setNumber: index + 1,
      sortOrder: (exercise.sortOrder ?? 0) * 10 + index,
      reps: null,
      loadValue: null,
      loadUnit: input.preferredUnits,
      logMode: mode,
      durationSeconds: null,
      completed: false,
      prescriptionKey: prescriptionSlotKey({
        exerciseName: exercise.name,
        reps: exercise.reps,
        programSlug: rawDay.program.slug,
        dayNumber: rawDay.dayNumber,
      }),
      rir: rirFromLoadText(exercise.loadText) ?? "",
    }));
  });

  let fresh = false;
  const created = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { updatedAt: new Date() },
    });
    const again = await findSameDayProgramSession(
      tx,
      input.userId,
      rawDay.id,
      now,
      zone,
      visible.map((exercise) => exercise.name),
    );
    if (again) return again;
    const shortAgain = await findCompletedSameDaySession(
      tx,
      input.userId,
      rawDay.id,
      now,
      zone,
      visible.map((exercise) => exercise.name),
    );
    if (shortAgain) {
      const calendar = (await calendarPlanDoses(input.userId, now)).get(rawDay.id);
      const progress = sessionProgress(shortAgain, {
        dose: calendar && calendar.dose > 0 ? calendar.dose : prescribedSetTotal(visible),
        names:
          calendar && calendar.names.length > 0
            ? [...calendar.names]
            : visible.map((exercise) => exercise.name),
        exercises:
          calendar?.exercises && calendar.exercises.length > 0
            ? calendar.exercises
            : visible.map((exercise) => ({ name: exercise.name, sets: exercise.sets })),
      });
      if (!progress.done) return shortAgain;
    }
    fresh = true;
    return tx.workoutSession.create({
      data: {
        userId: input.userId,
        programDayId: day.id,
        title: `${memberFacingTitle(day.title)}${input.half ? " · Light" : ""}${input.deload ? " · Deload" : ""}`,
        performedAt: now,
        notes: input.deload ? DELOAD_LABEL : "",
        status: "draft",
        plannedSetCount: sets.length,
        sets: { create: sets },
      },
      include: { sets: true },
    });
  });
  if (!fresh) {
    if (created.status === "complete") {
      return continuePartialWorkoutForUser({
        userId: input.userId,
        workoutId: created.id,
        preferredUnits: input.preferredUnits,
        timeZone: zone,
      });
    }
    return created;
  }
  await bindPendingSwaps({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
    workoutSessionId: created.id,
    originalNames: pendingNames,
  });
  await bindPendingRemovals({
    userId: input.userId,
    programSlug: rawDay.program.slug,
    dayNumber: rawDay.dayNumber,
    workoutSessionId: created.id,
  });
  return created;
}

function validateSets(sets: WorkoutSetInput[]) {
  if (sets.length === 0) {
    throw new AppError("WORKOUT", "Add at least one set before saving.");
  }
  if (sets.length > 80) {
    throw new AppError("WORKOUT", "Too many sets on one session.");
  }
  for (const set of sets) {
    if (!set.exerciseName.trim()) {
      throw new AppError("WORKOUT", "Every set needs an exercise name.");
    }
    if (set.exerciseName.length > 80) {
      throw new AppError("WORKOUT", "Exercise name is too long.");
    }
    const roundRow = set.logMode === "timed_round" || isBikeIntervalName(set.exerciseName);
    const numberCap = roundRow ? 80 : 20;
    if (set.setNumber < 1 || set.setNumber > numberCap) {
      throw new AppError(
        "WORKOUT",
        roundRow ? "Round numbers should be between 1 and 80." : "Set numbers should be between 1 and 20.",
      );
    }
    if (set.reps != null && (set.reps < 0 || set.reps > 200)) {
      throw new AppError("WORKOUT", "Reps should be between 0 and 200.");
    }
    if (set.loadValue != null && (set.loadValue < 0 || set.loadValue > 2000)) {
      throw new AppError("WORKOUT", "Load should be between 0 and 2000.");
    }
    if (
      set.durationSeconds != null &&
      (set.durationSeconds < 0 || set.durationSeconds > SESSION_DURATION_CAP_SECONDS)
    ) {
      throw new AppError("WORKOUT", "Hold / round time should be under 4 hours.");
    }
    if (set.logMode && !isLogMode(set.logMode)) {
      throw new AppError("WORKOUT", "Unknown logging mode.");
    }
    if (!isLoadUnit(set.loadUnit)) {
      throw new AppError("WORKOUT", "Load unit must be lb.");
    }
  }
}

function planSlotKey(set: { exerciseName: string; setNumber: number }) {
  const name = loggedExerciseName(set.exerciseName).toLowerCase();
  const number = Number.isFinite(set.setNumber) ? Math.max(1, Math.round(set.setNumber)) : 1;
  return `${name}\u0000${number}`;
}

function planNameKey(set: { exerciseName: string }) {
  return loggedExerciseName(set.exerciseName).toLowerCase();
}

function addedPrescription(set: { prescriptionKey?: string | null }) {
  return String(set.prescriptionKey ?? "").startsWith("added|");
}

function toSavedSet(set: {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode: string;
  durationSeconds: number | null;
  completed: boolean;
  notes: string;
  prescriptionKey: string;
  rir: string;
}): WorkoutSetInput {
  return {
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: "lb",
    logMode: isLogMode(set.logMode) ? set.logMode : undefined,
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey,
    rir: set.rir,
  };
}

/**
 * A partial Save used to persist only the rows with numbers, so the logger
 * reopened as 1 of 1. Keep every planned row already on the session, and any
 * planned exercise the form still has, without putting bloated empty copies back.
 */
function keepPlannedSets(
  logged: WorkoutSetInput[],
  submitted: WorkoutSetInput[],
  existing: Parameters<typeof toSavedSet>[0][],
  removals: Parameters<typeof setsKeepingRemovals>[1],
): WorkoutSetInput[] {
  const loggedByKey = new Map(logged.map((set) => [planSlotKey(set), set]));
  const submittedVisible = setsKeepingRemovals(submitted, removals);
  const prior = setsKeepingRemovals(existing.map((set) => toSavedSet(set)), removals);
  const priorKeys = new Set(prior.map((set) => planSlotKey(set)));
  const priorNames = new Set(prior.map((set) => planNameKey(set)));
  const merged: WorkoutSetInput[] = [];
  const seen = new Set<string>();
  // The form's order wins, including empty planned rows it still shows.
  for (const set of submittedVisible) {
    const key = planSlotKey(set);
    if (seen.has(key)) continue;
    if (!setHasLoggedWork(set) && priorNames.has(planNameKey(set)) && !priorKeys.has(key)) continue;
    merged.push(loggedByKey.get(key) ?? set);
    seen.add(key);
  }
  // A short payload from another tab omitted planned rows. Put those back.
  // An added exercise the form left out, while still sending the plan, stays removed.
  const omittedPlanned = prior.some((row) => !addedPrescription(row) && !seen.has(planSlotKey(row)));
  for (const row of prior) {
    const key = planSlotKey(row);
    if (seen.has(key)) continue;
    if (addedPrescription(row) && !omittedPlanned) continue;
    merged.push(loggedByKey.get(key) ?? row);
    seen.add(key);
  }
  for (const set of logged) {
    const key = planSlotKey(set);
    if (seen.has(key)) continue;
    merged.push(set);
    seen.add(key);
  }
  return merged;
}

function setsAsLb(sets: WorkoutSetInput[]): WorkoutSetInput[] {
  return sets.map((set) => {
    if (set.loadUnit !== "kg") {
      return { ...set, loadUnit: APP_LOAD_UNIT };
    }
    return {
      ...set,
      loadUnit: APP_LOAD_UNIT,
      loadValue:
        set.loadValue == null ? null : roundLoadForInput(convertLoad(set.loadValue, "kg", "lb")),
    };
  });
}

type SavedWorkoutSession = Prisma.WorkoutSessionGetPayload<{
  include: { sets: true };
}> &
  WorkoutTimerFields;

export async function updateWorkoutSessionForUser(input: {
  userId: string;
  workoutId: string;
  title: string;
  performedAt: Date;
  notes: string;
  status: "draft" | "complete" | "partial";
  sets: WorkoutSetInput[];
  difficultyRating?: string | null;
  /** undefined leaves a running rest alone. null clears it. */
  rest?: { exerciseName: string; endsAtMs: number } | null;
  /** Omit to leave the session's planned count alone. */
  plannedSetCount?: number;
  /**
   * Round saves on a mixed day keep unticked plan rows. Lift finishes still
   * drop empty sets.
   */
  retainEmptySets?: boolean;
  /** undefined leaves session RPE alone. null clears it. */
  sessionRpe?: number | null;
  /**
   * Autosave only. The write is skipped when the session changed after this
   * instant, so a swap that already landed is not overwritten by an older draft.
   */
  baseUpdatedAt?: string | Date | null;
  timeZone?: string;
  /** Header seconds the logger was showing when Save was pressed. */
  elapsedSeconds?: number | null;
  /**
   * Leave this row as its own log. A shorter round save must not fold into
   * today's finished session and replace that session's rounds.
   */
  keepOwnSession?: boolean;
}): Promise<SavedWorkoutSession> {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
      include: { sets: true },
    }),
    input.userId,
  );
  const normalized = setsAsLb(input.sets).map((set) => withTickedPlanWork(set));
  const finishing = input.status !== "draft";
  const sets = prepareSetsForPersist(normalized, input.status, {
    retainEmptySets: input.retainEmptySets,
  });
  const submitted =
    input.status === "complete" ? prepareSetsForPersist(normalized, "draft") : sets;
  if (finishing && !sets.some(setHasLoggedWork)) {
    const ticked = normalized.some((set) => set.completed);
    throw new AppError(
      "WORKOUT",
      ticked
        ? "Enter the reps, load, or time on the set you checked. An empty check cannot be saved."
        : "Log at least one set, then tap Save. Nothing was marked finished.",
    );
  }
  validateSets(sets);

  const title = input.title.trim().slice(0, 120) || "Workout";
  const notes = input.notes.trim().slice(0, 1000);
  if (Number.isNaN(input.performedAt.getTime())) {
    throw new AppError("WORKOUT", "Enter a valid date.");
  }
  if (input.status === "complete" && existing.programDayId && !input.keepOwnSession) {
    const canonical = await findCompletedSameDaySession(
      prisma,
      input.userId,
      existing.programDayId,
      input.performedAt,
      input.timeZone || APP_TIMEZONE,
      sets.map((set) => set.exerciseName),
    );
    if (canonical && canonical.id !== existing.id) {
      // The numbers land on the finished row. The open draft stays so the
      // logger the member is in does not 404. A later pass skips a day that
      // already has a completed session, and only Cancel or Delete removes it.
      return updateWorkoutSessionForUser({ ...input, workoutId: canonical.id });
    }
  }

  const timerColumns = await workoutTimerColumnsAvailable(prisma);
  const updated = await prisma.$transaction(async (tx) => {
    const databaseUrl = process.env.DATABASE_URL ?? "";
    if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
      await tx.$queryRaw`SELECT "id" FROM "WorkoutSession" WHERE "id" = ${input.workoutId} FOR UPDATE`;
    }
    const current = await tx.workoutSession.findUnique({
      where: { id: input.workoutId },
      include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    });
    if (!current || current.userId !== input.userId) {
      throw new NotFoundError("Workout not found.");
    }
    if (
      input.status === "draft" &&
      (current.status === "complete" ||
        (current.status === "partial" && keepsFinishedRoundLog(current.sets)))
    ) {
      return current;
    }
    const resumeMixedPartial =
      input.status === "draft" &&
      current.status === "partial" &&
      current.sets.some((set) => setIsSavedRoundWork(set)) &&
      current.sets.some((set) => !setIsSavedRoundWork(set));
    const openStatus = resumeMixedPartial ? ("partial" as const) : ("draft" as const);
    if (input.baseUpdatedAt && input.status === "draft") {
      const base = new Date(input.baseUpdatedAt);
      if (Number.isNaN(base.getTime())) {
        throw new AppError("WORKOUT", "Draft is out of date. Reload the workout.");
      }
      const claimed = await tx.workoutSession.updateMany({
        where: {
          id: input.workoutId,
          userId: input.userId,
          status: openStatus,
          updatedAt: base,
        },
        data: { title },
      });
      if (claimed.count === 0) throw new StaleDraftError();
    }
    const stillDraft = await tx.workoutSession.updateMany({
      where: {
        id: input.workoutId,
        userId: input.userId,
        ...(input.status === "draft" ? { status: openStatus } : {}),
      },
      data: { title },
    });
    if (stillDraft.count === 0) {
      const saved = await tx.workoutSession.findUnique({
        where: { id: input.workoutId },
        include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
      });
      if (
        saved &&
        input.status === "draft" &&
        (saved.status === "complete" ||
          (saved.status === "partial" && keepsFinishedRoundLog(saved.sets)))
      ) {
        return saved;
      }
      throw new StaleDraftError();
    }
    const removals = await activeRemovalsForSession(input.userId, input.workoutId);
    let writing = setsKeepingRemovals(sets, removals);
    if (input.status === "complete") {
      writing = keepPlannedSets(writing, submitted, current.sets, removals);
    }
    if (writing.length === 0 && sets.length > 0) {
      const keptCurrent = setsKeepingRemovals(
        current.sets.map((set) => ({
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: set.reps,
          loadValue: set.loadValue,
          loadUnit: "lb" as const,
          logMode: isLogMode(set.logMode) ? set.logMode : undefined,
          durationSeconds: set.durationSeconds,
          completed: set.completed,
          notes: set.notes,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        })),
        removals,
      );
      if (keptCurrent.length > 0) writing = keptCurrent;
    }
    const clearedByRemovals = writing.length === 0 && sets.length > 0 && removals.length > 0;
    if (writing.length === 0 && !clearedByRemovals) throw new StaleDraftError();
    const storedTimer = timerColumns
      ? await readWorkoutTimerFields(current.id, tx)
      : { finishedAt: null, elapsedSeconds: null, timerStartedAt: null };
    const timer = finishing
      ? freezeElapsedOnSave({ ...current, ...storedTimer }, new Date(), input.elapsedSeconds)
      : null;
    await tx.workoutSet.deleteMany({
      where: { workoutSessionId: input.workoutId },
    });
    return tx.workoutSession.update({
      where: { id: input.workoutId },
      data: {
        title,
        performedAt: input.performedAt,
        notes,
        status: input.status,
        ...(typeof input.plannedSetCount === "number" && input.plannedSetCount > 0
          ? { plannedSetCount: Math.round(input.plannedSetCount) }
          : {}),
        ...(input.sessionRpe !== undefined ? { sessionRpe: parseSessionRpe(input.sessionRpe) } : {}),
        difficultyRating:
          input.difficultyRating === undefined
            ? existing.difficultyRating
            : parseDifficultyRating(input.difficultyRating) ?? "",
        ...(input.rest !== undefined
          ? {
              restExerciseName: input.rest?.exerciseName.trim().slice(0, 80) ?? "",
              restEndsAt:
                input.rest && Number.isFinite(input.rest.endsAtMs)
                  ? new Date(input.rest.endsAtMs)
                  : null,
            }
          : {}),
        ...(timerColumns && timer
          ? {
              finishedAt: timer.finishedAt,
              elapsedSeconds: timer.elapsedSeconds,
              timerStartedAt: timer.timerStartedAt,
            }
          : {}),
        sets: {
          create: writing.map((set, index) => {
            const mode = resolveLogMode({
              logMode: set.logMode,
              name: set.exerciseName,
            });
            const timed = isDurationMode(mode);
            return {
              exerciseName: set.exerciseName.trim(),
              setNumber: set.setNumber,
              sortOrder: index,
              reps: timed ? null : set.reps,
              loadValue: hidesLoad(mode) ? null : set.loadValue,
              loadUnit: set.loadUnit,
              logMode: mode,
              durationSeconds: timed ? set.durationSeconds ?? null : null,
              completed: Boolean(set.completed),
              notes: (set.notes ?? "").slice(0, 200),
              prescriptionKey: (set.prescriptionKey ?? "").trim().slice(0, 160),
              rir: (set.rir ?? "").trim().slice(0, 40),
            };
          }),
        },
      },
      include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    });
  });
  updated.sets.sort((left, right) => left.sortOrder - right.sortOrder || left.setNumber - right.setNumber);
  if (finishing && existing.status === "draft") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return attachWorkoutTimer(updated, prisma);
}

function keepsFinishedRoundLog(
  sets: { prescriptionKey?: string | null; exerciseName?: string | null; logMode?: string | null }[],
) {
  if (!sets.some((set) => setIsSavedRoundWork(set))) return false;
  // Mixed days stay editable. The logger has to tick the work that is not rounds.
  return !sets.some((set) => !setIsSavedRoundWork(set));
}

/**
 * A blank draft from before today. Resume and Today skip it.
 * The row stays a draft until the member taps Cancel or Delete.
 */
export function isPastEmptyDraft(
  session: {
    status: string;
    performedAt: Date;
    createdAt?: Date | null;
    timerStartedAt?: Date | null;
    sets: { reps: number | null; loadValue: number | null; durationSeconds: number | null }[];
  },
  today: string,
  timeZone: string,
) {
  if (session.status !== "draft" || sessionHasLoggedWork(session.sets)) return false;
  if (session.timerStartedAt && dayKey(session.timerStartedAt, timeZone) >= today) return false;
  return sessionCivilDay(session, timeZone) < today;
}

/**
 * A draft dated before today is no longer a live clock. A partial log becomes
 * "partial" and stays off the DONE tally. Only a draft that already has every
 * prescribed set ticked is marked complete. An empty draft is left alone.
 * Do not invent sets, do not store a created-to-edit gap as training time,
 * and do not close a draft the member still has open today.
 */
export async function finalizePastLoggedDrafts(userId: string, now: Date, timeZone: string) {
  const today = dayKey(now, timeZone);
  const timerColumns = await workoutTimerColumnsAvailable(prisma);
  const timers = await readDraftTimerFields(userId, prisma);
  const drafts = (
    await prisma.workoutSession.findMany({
      where: { userId, status: "draft" },
      select: {
        id: true,
        status: true,
        programDayId: true,
        performedAt: true,
        createdAt: true,
        updatedAt: true,
        plannedSetCount: true,
        sets: {
          select: { completed: true, reps: true, loadValue: true, durationSeconds: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })
  ).map((row) => ({
    ...row,
    ...(timers.get(row.id) ?? { finishedAt: null, elapsedSeconds: null, timerStartedAt: null }),
  }));
  const completes = await prisma.workoutSession.findMany({
    where: { userId, status: "complete", sets: loggedSetSome },
    select: { id: true, programDayId: true, performedAt: true, createdAt: true },
  });
  const alreadyLogged = new Set(
    completes
      .filter((row) => row.programDayId)
      .map((row) => `${row.programDayId}:${sessionCivilDay(row, timeZone)}`),
  );
  const claimed = new Set<string>();
  const stillOpenToday = (row: { timerStartedAt: Date | null }) =>
    Boolean(row.timerStartedAt && dayKey(row.timerStartedAt, timeZone) >= today);
  const ids = drafts
    .filter((row) => sessionHasLoggedWork(row.sets) && sessionCivilDay(row, timeZone) < today)
    .filter((row) => {
      // Resume starts a live segment today. Do not close it out from under the member.
      if (stillOpenToday(row)) return false;
      // Undo finish keeps the stored clock and does not start a segment. A row
      // touched today stays open until the member leaves it.
      const held =
        !row.timerStartedAt &&
        resumeStoredElapsed(row.elapsedSeconds) != null &&
        row.updatedAt != null &&
        dayKey(row.updatedAt, timeZone) >= today;
      if (held) return false;
      return true;
    })
    .filter((row) => {
      if (!row.programDayId) return true;
      const key = `${row.programDayId}:${sessionCivilDay(row, timeZone)}`;
      if (alreadyLogged.has(key) || claimed.has(key)) return false;
      claimed.add(key);
      return true;
    })
    .map((row) => row.id);
  if (ids.length === 0) return 0;
  let count = 0;
  for (const row of drafts) {
    if (!ids.includes(row.id)) continue;
    const planned = resolvedPlannedSetCount(row);
    const ticked = tickedSetCount(row.sets);
    const finished = planned > 0 && ticked >= planned;
    const elapsed =
      usableStoredElapsed(row.elapsedSeconds) ??
      plausibleElapsed(row.createdAt, row.updatedAt);
    const result = await prisma.workoutSession.updateMany({
      where: { id: row.id, userId, status: "draft" },
      data: {
        status: finished ? "complete" : "partial",
        ...(timerColumns
          ? {
              finishedAt: finished ? (row.finishedAt ?? row.updatedAt) : null,
              elapsedSeconds: elapsed,
              timerStartedAt: null,
            }
          : {}),
      },
    });
    count += result.count;
  }
  return count;
}

/**
 * A finished session with no reps, load, or time was never really saved.
 * Put it back to draft so the local logger can still save into the same id.
 */
export async function reopenEmptyCompletion<
  T extends { id: string; status: string; sets: { reps: number | null; loadValue: number | null; durationSeconds: number | null }[] },
>(session: T): Promise<T> {
  if (session.status !== "complete" || sessionHasLoggedWork(session.sets)) return session;
  const timerColumns = await workoutTimerColumnsAvailable(prisma);
  await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      status: "draft",
      ...(timerColumns ? { finishedAt: null, elapsedSeconds: null, timerStartedAt: null } : {}),
    },
  });
  return {
    ...session,
    status: "draft",
    ...(timerColumns ? { finishedAt: null, elapsedSeconds: null, timerStartedAt: null } : {}),
  };
}

/**
 * Put a finished session back in the logger. Logged sets stay.
 * Used when SAVE fired by accident (for example Enter in the swap search).
 */
export async function reopenCompletedWorkoutForUser(userId: string, workoutId: string) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: workoutId },
      include: { sets: true },
    }),
    userId,
  );
  if (existing.status !== "complete" && existing.status !== "partial") {
    return attachWorkoutTimer(existing, prisma);
  }
  const timerColumns = await workoutTimerColumnsAvailable(prisma);
  const stored = await readWorkoutTimerFields(existing.id, prisma);
  // Keep a real saved clock, including one that already sits on the 4 hour cap.
  // Undo finish starts a new segment from that clock so the logger keeps counting.
  // A heartbeat still ignores a draft whose timerStartedAt is empty.
  const elapsed = resumeStoredElapsed(stored.elapsedSeconds);
  const startedAt = new Date();
  const updated = await prisma.workoutSession.update({
    where: { id: existing.id },
    data: {
      status: "draft",
      ...(timerColumns
        ? { finishedAt: null, elapsedSeconds: elapsed, timerStartedAt: startedAt }
        : {}),
    },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!timerColumns) return attachWorkoutTimer(updated, prisma);
  return { ...updated, finishedAt: null, elapsedSeconds: elapsed, timerStartedAt: startedAt };
}

/**
 * Start the clock on a held draft. Undo finish already sets timerStartedAt.
 * This is the explicit Resume for a draft that was opened without a segment.
 */
export async function resumeHeldSessionClockForUser(input: { userId: string; workoutId: string }) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: input.workoutId },
    select: { id: true, userId: true, status: true },
  });
  if (!existing || existing.userId !== input.userId) {
    throw new NotFoundError("Workout not found.");
  }
  if (existing.status !== "draft") {
    throw new AppError("WORKOUT", "Resume the workout before starting the clock.");
  }
  if (!(await workoutTimerColumnsAvailable(prisma))) {
    return { elapsedSeconds: null as number | null, timerStartedAt: null as Date | null };
  }
  const stored = await readWorkoutTimerFields(existing.id, prisma);
  if (stored.timerStartedAt) {
    return { elapsedSeconds: resumeStoredElapsed(stored.elapsedSeconds), timerStartedAt: stored.timerStartedAt };
  }
  const now = new Date();
  const elapsedSeconds = resumeStoredElapsed(stored.elapsedSeconds);
  await prisma.$executeRaw`
    UPDATE "WorkoutSession"
    SET "elapsedSeconds" = ${elapsedSeconds}, "timerStartedAt" = ${now}, "finishedAt" = NULL
    WHERE "id" = ${existing.id} AND "userId" = ${input.userId} AND "status" = 'draft'
  `;
  return { elapsedSeconds, timerStartedAt: now };
}

/**
 * Delete a draft the member explicitly left without logging.
 * Page hide, prefetch, and a second tab must not call this: a fresh Start
 * has no reps yet, and those signals were removing the logger out from under them.
 */
export async function discardEmptyWorkoutDraft(
  userId: string,
  workoutId: string,
  options?: { explicit?: boolean },
) {
  if (!options?.explicit) return { discarded: false };
  const session = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
    include: { sets: true },
  });
  if (!session || session.userId !== userId) return { discarded: false };
  if (sessionHasLoggedWork(session.sets)) return { discarded: false };
  if (session.status !== "draft") return { discarded: false };
  await prisma.workoutSession.delete({ where: { id: workoutId } });
  return { discarded: true };
}

export async function deleteWorkoutSessionForUser(
  workoutId: string,
  userId: string,
) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id: workoutId },
  });
  assertOwnSession(existing, userId);
  await prisma.workoutSession.delete({ where: { id: workoutId } });
}

export async function rateWorkoutSessionForUser(input: {
  userId: string;
  workoutId: string;
  difficultyRating: string;
}) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
      include: { sets: true },
    }),
    input.userId,
  );
  if (!sessionOpensFinishScreen(existing)) {
    throw new AppError("WORKOUT", "Save the session first, then rate how it felt.");
  }
  if (existing.status === "partial" && !sessionHasLoggedWork(existing.sets)) {
    throw new AppError("WORKOUT", "Log a set before you rate this session.");
  }
  const rating = parseDifficultyRating(input.difficultyRating);
  if (!rating) {
    throw new AppError("WORKOUT", "Pick how the session felt.");
  }
  return prisma.workoutSession.update({
    where: { id: input.workoutId },
    data: { difficultyRating: rating },
  });
}

/**
 * Used by tests and any future API route. Never return another user's row.
 */
export async function tryReadWorkoutByIdForUser(
  workoutId: string,
  userId: string,
) {
  return prisma.workoutSession.findFirst({
    where: { id: workoutId, userId },
  });
}
