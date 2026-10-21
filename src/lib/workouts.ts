import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, AppError, StaleDraftError } from "@/lib/errors";
import { APP_LOAD_UNIT, convertLoad, isLoadUnit, roundLoadForInput, type LoadUnit } from "@/lib/units";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { rirFromLoadText } from "@/lib/rir";
import { sessionCivilDay, sessionCompletionDay } from "@/lib/performed-at";
import { APP_TIMEZONE, dayKey, endOfZonedDay, startOfZonedDay, zonedCivilToUtc } from "@/lib/timezone";
import { getProgramDayById } from "@/lib/programs";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { parseDifficultyRating } from "@/lib/difficulty";
import { memberWeekIndex } from "@/lib/bike-sessions";
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
import { applySwapsToExercises, trainingBlockKey } from "@/lib/exercise-swap";
import { bindPendingSwaps, listSwapsForDay } from "@/lib/exercise-swap-store";
import { omitRemovedSlots } from "@/lib/exercise-removal";
import { bindPendingRemovals, listRemovalsForDay } from "@/lib/exercise-removal-store";
import {
  loggedSetSome,
  prepareSetsForPersist,
  sessionCountsAsPlannedCompletion,
  sessionHasLoggedWork,
  setHasLoggedWork,
} from "@/lib/logged-work";
import {
  cappedElapsedSeconds,
  freezeElapsedOnSave,
  legacyFrozenSeconds,
  SESSION_DURATION_CAP_SECONDS,
} from "@/lib/session-elapsed";
import {
  attachWorkoutTimer,
  readDraftTimerFields,
  readWorkoutTimerFields,
  workoutTimerColumnsAvailable,
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
  programDay: { include: { program: true } },
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
      status: "complete",
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
      row.sets.some((set) => set.exerciseName === name),
    );
    if (!session) continue;
    result[name] = {};
    for (const set of session.sets) {
      if (set.exerciseName !== name) continue;
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
      status: "complete",
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
      ? sessions.find((row) => row.sets.some((set) => set.prescriptionKey === slot.prescriptionKey))
      : undefined;
    const legacy = sessions.find((row) =>
      row.sets.some((set) => set.exerciseName === slot.exerciseName && set.prescriptionKey === ""),
    );
    const chosen = exact ?? legacy;
    if (!chosen) continue;
    const keyed = Boolean(exact);
    if (!result[slot.exerciseName]) result[slot.exerciseName] = {};
    for (const set of chosen.sets) {
      const matches = keyed
        ? set.prescriptionKey === slot.prescriptionKey
        : set.exerciseName === slot.exerciseName && !set.prescriptionKey;
      if (!matches) continue;
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
      status: true,
      programDayId: true,
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
    },
  });
  const namesByDay = await plannedExerciseNamesByDay(ids);
  const key = dayKey(day, timeZone);
  return [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.programDayId &&
            sessionCompletionDay(row, timeZone) === key &&
            sessionCountsAsPlannedCompletion(row, namesByDay.get(row.programDayId) ?? []),
        )
        .map((row) => row.programDayId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

async function plannedExerciseNamesByDay(dayIds: string[]) {
  const exercises = await prisma.programExercise.findMany({
    where: { programDayId: { in: dayIds } },
    select: { programDayId: true, name: true },
  });
  const names = new Map<string, string[]>();
  for (const exercise of exercises) {
    const list = names.get(exercise.programDayId) ?? [];
    list.push(exercise.name);
    names.set(exercise.programDayId, list);
  }
  return names;
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
  const namesByDay = await plannedExerciseNamesByDay(
    rows.map((row) => row.programDayId).filter((id): id is string => Boolean(id)),
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.programDayId) continue;
    if (!keySet.has(sessionCompletionDay(row, timeZone))) continue;
    if (!sessionCountsAsPlannedCompletion(row, namesByDay.get(row.programDayId) ?? [])) continue;
    ids.add(row.programDayId);
  }
  return [...ids];
}

/** Local days in [from, to) that have a finished session. Same day key as Calendar. */
export async function completedLocalDayKeys(
  userId: string,
  from: Date,
  to: Date,
  timeZone: string,
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
    select: { performedAt: true },
  });
  return [
    ...new Set(
      rows
        .map((row) => sessionCompletionDay(row, timeZone))
        .filter((key) => key >= fromKey && key < endKey),
    ),
  ];
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
      sets: { create: sets },
    },
    include: { sets: true },
  });
}

const SAME_DAY_SETS = {
  sets: { orderBy: [{ sortOrder: "asc" as const }, { setNumber: "asc" as const }] },
};

/**
 * One log per programmed session per civil day.
 * Start, a second Start, and resume used to insert another row. Autosave then
 * filled it, and the past-draft finish marked both complete.
 */
async function findSameDayProgramSession(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  programDayId: string,
  now: Date,
  timeZone: string,
) {
  const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const today = dayKey(now, timeZone);
  const rows = await db.workoutSession.findMany({
    where: {
      userId,
      programDayId,
      OR: [
        { performedAt: { gte: from, lte: to } },
        { createdAt: { gte: from, lte: to } },
      ],
    },
    include: SAME_DAY_SETS,
    orderBy: { createdAt: "asc" },
  });
  const same = rows.filter((row) => sessionCivilDay(row, timeZone) === today);
  same.sort((left, right) => {
    const rank = (row: (typeof same)[number]) => {
      const logged = sessionHasLoggedWork(row.sets);
      if (row.status === "complete" && logged) return 0;
      if (row.status === "draft" && logged) return 1;
      if (row.status === "draft") return 2;
      return 3;
    };
    return rank(left) - rank(right) || left.createdAt.getTime() - right.createdAt.getTime();
  });
  return same[0] ?? null;
}

export async function startWorkoutFromDay(input: {
  userId: string;
  programDayId: string;
  preferredUnits: LoadUnit;
  scale?: ScalePrefs | null;
  deload?: boolean;
  timeZone?: string;
  planAnchor?: Date | null;
}) {
  const rawDay = await getProgramDayById(input.programDayId);
  const band = scaleBandFromPrefs(input.scale);
  const now = new Date();
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
  const blockKey = trainingBlockKey(new Date(), input.timeZone || APP_TIMEZONE, input.planAnchor);
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
  const sameDay = await findSameDayProgramSession(prisma, input.userId, rawDay.id, now, zone);
  if (sameDay) return sameDay;

  const sets = visible.flatMap((exercise) => {
    const mode = resolveLogMode(exercise);
    // Match the set count printed on the logger card. Deload week used to
    // store ~60% of that count (4 → 2) while the card still said 4 sets.
    const prescribed = Math.max(0, Math.round(exercise.sets));
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
    const again = await findSameDayProgramSession(tx, input.userId, rawDay.id, now, zone);
    if (again) return again;
    fresh = true;
    return tx.workoutSession.create({
      data: {
        userId: input.userId,
        programDayId: day.id,
        title: `${memberFacingTitle(day.title)}${input.deload ? " · Deload" : ""}`,
        performedAt: new Date(),
        notes: input.deload ? DELOAD_LABEL : "",
        status: "draft",
        sets: { create: sets },
      },
      include: { sets: true },
    });
  });
  if (!fresh) return created;
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
    if (set.setNumber < 1 || set.setNumber > 20) {
      throw new AppError("WORKOUT", "Set numbers should be between 1 and 20.");
    }
    if (set.reps != null && (set.reps < 0 || set.reps > 200)) {
      throw new AppError("WORKOUT", "Reps should be between 0 and 200.");
    }
    if (set.loadValue != null && (set.loadValue < 0 || set.loadValue > 2000)) {
      throw new AppError("WORKOUT", "Load should be between 0 and 2000.");
    }
    if (set.durationSeconds != null && (set.durationSeconds < 0 || set.durationSeconds > 3600)) {
      throw new AppError("WORKOUT", "Hold / round time should be under 60 minutes.");
    }
    if (set.logMode && !isLogMode(set.logMode)) {
      throw new AppError("WORKOUT", "Unknown logging mode.");
    }
    if (!isLoadUnit(set.loadUnit)) {
      throw new AppError("WORKOUT", "Load unit must be lb.");
    }
  }
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

export async function updateWorkoutSessionForUser(input: {
  userId: string;
  workoutId: string;
  title: string;
  performedAt: Date;
  notes: string;
  status: "draft" | "complete";
  sets: WorkoutSetInput[];
  difficultyRating?: string | null;
  /** undefined leaves a running rest alone. null clears it. */
  rest?: { exerciseName: string; endsAtMs: number } | null;
  /**
   * Autosave only. The write is skipped when the session changed after this
   * instant, so a swap that already landed is not overwritten by an older draft.
   */
  baseUpdatedAt?: string | Date | null;
  timeZone?: string;
  /** Header seconds the logger was showing when Save was pressed. */
  elapsedSeconds?: number | null;
}) {
  const existing = assertOwnSession(
    await prisma.workoutSession.findUnique({
      where: { id: input.workoutId },
      include: { sets: true },
    }),
    input.userId,
  );
  if (input.status === "complete" && existing.programDayId) {
    const canonical = await findSameDayProgramSession(
      prisma,
      input.userId,
      existing.programDayId,
      input.performedAt,
      input.timeZone || APP_TIMEZONE,
    );
    if (
      canonical &&
      canonical.id !== existing.id &&
      canonical.status === "complete" &&
      sessionHasLoggedWork(canonical.sets)
    ) {
      return attachWorkoutTimer(canonical, prisma);
    }
  }
  const sets = prepareSetsForPersist(setsAsLb(input.sets), input.status);
  if (input.status === "complete" && !sets.some(setHasLoggedWork)) {
    throw new AppError(
      "WORKOUT",
      "Log at least one set, then tap Save. Nothing was marked finished.",
    );
  }
  validateSets(sets);

  const title = input.title.trim().slice(0, 120) || "Workout";
  const notes = input.notes.trim().slice(0, 1000);
  if (Number.isNaN(input.performedAt.getTime())) {
    throw new AppError("WORKOUT", "Enter a valid date.");
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
    if (input.status === "draft" && current.status === "complete") {
      return current;
    }
    if (input.baseUpdatedAt && input.status === "draft") {
      const base = new Date(input.baseUpdatedAt);
      if (Number.isNaN(base.getTime())) {
        throw new AppError("WORKOUT", "Draft is out of date. Reload the workout.");
      }
      const claimed = await tx.workoutSession.updateMany({
        where: {
          id: input.workoutId,
          userId: input.userId,
          status: "draft",
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
        ...(input.status === "draft" ? { status: "draft" as const } : {}),
      },
      data: { title },
    });
    if (stillDraft.count === 0) {
      const saved = await tx.workoutSession.findUnique({
        where: { id: input.workoutId },
        include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
      });
      if (saved?.status === "complete" && input.status === "draft") return saved;
      throw new StaleDraftError();
    }
    const storedTimer = timerColumns
      ? await readWorkoutTimerFields(current.id, tx)
      : { finishedAt: null, elapsedSeconds: null, timerStartedAt: null };
    const timer =
      input.status === "complete"
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
          create: sets.map((set, index) => {
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
  if (input.status === "complete" && existing.status !== "complete") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return attachWorkoutTimer(updated, prisma);
}

/**
 * A draft that already has logged sets, dated before today in the member zone,
 * is a finish that never stuck. Mark it complete. Do not invent sets, and do
 * not close a draft the member still has open today. One programmed session
 * per civil day is enough: a second past draft stays a draft when that slot
 * is already logged.
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
        programDayId: true,
        performedAt: true,
        createdAt: true,
        updatedAt: true,
        sets: { select: { reps: true, loadValue: true, durationSeconds: true } },
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
  const ids = drafts
    .filter((row) => sessionHasLoggedWork(row.sets) && sessionCivilDay(row, timeZone) < today)
    .filter((row) => {
      // Resume starts a live segment today. Do not close it out from under the member.
      if (row.timerStartedAt && dayKey(row.timerStartedAt, timeZone) >= today) return false;
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
    const result = await prisma.workoutSession.updateMany({
      where: { id: row.id, userId, status: "draft" },
      data: {
        status: "complete",
        ...(timerColumns
          ? {
              finishedAt: row.finishedAt ?? row.updatedAt,
              elapsedSeconds:
                row.elapsedSeconds != null
                  ? Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(0, Math.floor(row.elapsedSeconds)))
                  : cappedElapsedSeconds(row.createdAt, row.updatedAt),
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
  if (existing.status !== "complete") return attachWorkoutTimer(existing, prisma);
  const timerColumns = await workoutTimerColumnsAvailable(prisma);
  const stored = await readWorkoutTimerFields(existing.id, prisma);
  const elapsed =
    stored.elapsedSeconds != null && Number.isFinite(stored.elapsedSeconds)
      ? Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(0, Math.floor(stored.elapsedSeconds)))
      : legacyFrozenSeconds({ ...existing, ...stored });
  const timerStartedAt = new Date();
  const updated = await prisma.workoutSession.update({
    where: { id: existing.id },
    data: {
      status: "draft",
      ...(timerColumns ? { finishedAt: null, elapsedSeconds: elapsed, timerStartedAt } : {}),
    },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!timerColumns) return attachWorkoutTimer(updated, prisma);
  return { ...updated, finishedAt: null, elapsedSeconds: elapsed, timerStartedAt };
}

/** Delete a draft the member left without logging. Never deletes a set they typed. */
export async function discardEmptyWorkoutDraft(userId: string, workoutId: string) {
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
    await prisma.workoutSession.findUnique({ where: { id: input.workoutId } }),
    input.userId,
  );
  if (existing.status !== "complete") {
    throw new AppError("WORKOUT", "Save the session first, then rate how it felt.");
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
