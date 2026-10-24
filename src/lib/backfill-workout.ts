import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { bagRoundCountFor } from "@/lib/bag-sessions";
import { bagFocusLines, SHADOW_EMPTY_NAME, SHADOW_WEIGHTED_NAME } from "@/lib/bag-themes";
import { bikeChoiceFromKey, bikeTimerRoundCount } from "@/lib/bike-chooser";
import { parseBikeIntervalReps } from "@/lib/bike-sessions";
import {
  BIKE_TIMER_EXERCISE,
  bikeTimerLogSets,
  bikeTimerSessionSeconds,
  choiceForBackfill,
  scheduledRoundPlanTarget,
} from "@/lib/bike-timer-log";
import { canMergeIntervalLog, type IntervalMergeClock } from "@/lib/interval-merge";
import { decodeInterval, type DecodedInterval } from "@/lib/interval-decode";

export { decodeInterval, type DecodedInterval };
import {
  INTERVAL_REST_MAX,
  INTERVAL_ROUNDS_MAX,
  INTERVAL_SESSION_MAX_SECONDS,
  INTERVAL_SETS_MAX,
  INTERVAL_SET_REST_MAX,
  INTERVAL_WORK_MIN,
  formatIntervalDisplay,
  intervalConfiguredSeconds,
  intervalWorkMax,
} from "@/lib/interval-shorthand";
import { intervalTotals } from "@/lib/interval-totals";
import {
  exerciseMatchesRoundType,
  restSecondsFromRoundKey,
  ROUND_SESSION_TITLES,
  roundLogSets,
  roundSaveStatus,
  roundStructureKey,
  roundTargetFromExercises,
  sessionMatchesRoundType,
  setBelongsToRoundType,
} from "@/lib/round-session";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { memberFacingTitle } from "@/lib/member-copy";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { sessionCompletionDay } from "@/lib/performed-at";
import {
  formatClock,
  isDurationMode,
  isShadowName,
  isWeightedShadowName,
  resolveLogMode,
} from "@/lib/exercise-log-mode";
import { scaleBandFromPrefs } from "@/lib/training-scale";
import { sessionHasLoggedWork, setHasLoggedWork } from "@/lib/logged-work";
import { easePlanForUser } from "@/lib/recovery-ease";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { planForDate, planWeekIndex, resolvePlanSessions } from "@/lib/week-plan";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { listSavedWorkouts, getSavedWorkoutForUser } from "@/lib/my-workouts";
import { readWorkoutTimerFields, workoutTimerColumnsAvailable } from "@/lib/workout-timer-columns";
import { SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import type { LoadUnit } from "@/lib/units";
import {
  BACKFILL_MAX_SET_SECONDS,
  BACKFILL_ROUND_MODES,
  BACKFILL_SOURCE,
  assertBackfillDay,
  assertSaneDurationSeconds,
  assertSaneSetSeconds,
  backfillCompletionStatus,
  backfillDayOptions,
  backfillDayState,
  isBackfillKind,
  isBackfillRoundMode,
  notesWithBikeMetrics,
  parseOptionalCalories,
  parseOptionalDistance,
  parseOptionalRpe,
  performedAtForDayKey,
  performedAtForLoggedDay,
  setsForBackfillExercises,
  type BackfillExerciseInput,
  type BackfillKind,
  type BackfillRoundMode,
  type BackfillSetDraft,
} from "@/lib/backfill-rules";

const DAY_PAD_MS = 36 * 60 * 60 * 1000;

export type BackfillExisting = {
  id: string;
  title: string;
  status: string;
};

export type BackfillProgramOption = {
  programDayId: string;
  programSlug: string;
  dayNumber: number;
  title: string;
  exercises: BackfillExerciseInput[];
};

export type BackfillIntervalTarget = {
  programDayId: string;
  exerciseName: string;
  plannedRounds: number;
  daySetCount: number;
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
  focusRounds: string[];
};

export type BackfillLastUsed = {
  label: string;
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
};


export type BackfillPreview = {
  dayKey: string;
  programs: BackfillProgramOption[];
  saved: { id: string; name: string; exercises: BackfillExerciseInput[] }[];
  existing: BackfillExisting[];
  days: { key: string; label: string }[];
  roundTargets: Partial<Record<"bike" | BackfillRoundMode, BackfillIntervalTarget>>;
  lastUsed: Partial<Record<"bike" | BackfillRoundMode | "shadow", BackfillLastUsed>>;
  bagRounds: number;
  units: LoadUnit;
  weightAccess: string;
  shadowWeight: number | null;
};

export type BackfillWriteResult =
  | { ok: true; sessionId: string; status: "complete" | "partial" }
  | { ok: false; conflict: BackfillExisting[] };

type BackfillPayload = {
  userId: string;
  dayKey: string;
  kind: BackfillKind;
  resolution: "" | "extra" | "replace";
  now?: Date;
  title: string;
  notes: string;
  rpe: number | null;
  programDayId?: string | null;
  savedWorkoutId?: string | null;
  exercises?: BackfillExerciseInput[];
  durationSeconds?: number | null;
  plannedRounds?: number | null;
  doneRounds?: number | null;
  roundMode?: string | null;
  workSeconds?: number | null;
  restSeconds?: number | null;
  roundsPerSet?: number | null;
  repeatRounds?: number | null;
  restBetweenRoundsSeconds?: number | null;
  focusNotes?: string[] | null;
  shadowRounds?: { workSeconds: number; restSeconds: number; weight: number | null }[] | null;
  calories?: number | null;
  distance?: number | null;
};

function cleanTitle(value: string, fallback: string) {
  const title = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return title || fallback;
}

const DEFAULT_ACTIVITY_TITLES = new Set<string>(Object.values(ROUND_SESSION_TITLES));

function structureLabel(spec: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
}) {
  return formatIntervalDisplay({
    sets: spec.sets,
    rounds: spec.rounds,
    workSeconds: spec.workSeconds,
    restSeconds: spec.restSeconds,
    setRestSeconds: spec.sets > 1 ? spec.setRestSeconds : 0,
  });
}

/**
 * A structure edit rewrites the title only when the stored name is the label
 * generated for the previous structure. A typed name stays. So does a default
 * activity title such as "Heavy bag rounds" or "Assault bike intervals".
 */
export function intervalEditTitle(input: {
  postedTitle: string;
  storedTitle: string;
  previous: {
    sets: number;
    rounds: number;
    workSeconds: number;
    restSeconds: number;
    setRestSeconds: number;
  };
  next: {
    sets: number;
    rounds: number;
    workSeconds: number;
    restSeconds: number;
    setRestSeconds: number;
  };
}) {
  const posted = input.postedTitle.trim();
  const stored = input.storedTitle.trim();
  if (posted && posted !== stored) return cleanTitle(input.postedTitle, stored);
  if (stored === structureLabel(input.previous) && !DEFAULT_ACTIVITY_TITLES.has(stored)) {
    return structureLabel(input.next);
  }
  return stored || structureLabel(input.next);
}

async function memberZone(userId: string) {
  const profile = await getProfileForUser(userId);
  const timeZone = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const units: LoadUnit = profile?.preferredUnits === "kg" ? "kg" : "lb";
  return { profile, timeZone, units, weightAccess: profile?.weightAccess ?? "gym" };
}

export async function sessionsOnCivilDay(userId: string, day: string, timeZone: string) {
  const when = performedAtForDayKey(day, timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      performedAt: {
        gte: new Date(when.getTime() - DAY_PAD_MS),
        lt: new Date(when.getTime() + DAY_PAD_MS),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      performedAt: true,
      sets: {
        select: { reps: true, loadValue: true, durationSeconds: true, completed: true },
      },
    },
    orderBy: { performedAt: "asc" },
  });
  return rows.filter((row) => {
    if (sessionCompletionDay(row, timeZone) !== day) return false;
    if (row.status === "draft" && !sessionHasLoggedWork(row.sets)) return false;
    if (row.status === "draft") return false;
    return row.status === "complete" || row.status === "partial" || sessionHasLoggedWork(row.sets);
  });
}

async function programOptionsForDay(userId: string, when: Date, timeZone: string): Promise<BackfillProgramOption[]> {
  const [profile, swaps, catalog, account] = await Promise.all([
    getProfileForUser(userId),
    getWeekPlanSwapsForUser(userId),
    findDemoTrainingCatalog(),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const camp = await getActiveCampSnapshot(userId, when, timeZone);
  const campWeek = campPlanWeekIndex(camp);
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
    forcedWeekIndex: campWeek,
  };
  const built = planForDate(prefs, when, timeZone, swaps);
  const shaped =
    camp && camp.phase !== "complete" && camp.phase !== "pre-camp" ? shapeDayPlan(built, camp.phase) : built;
  const eased = await easePlanForUser(userId, when, timeZone, shaped);
  const scaled = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    weekIndex: campWeek ?? planWeekIndex(when, timeZone, profile?.onboardingCompletedAt ?? null),
    campPhase: camp && camp.phase !== "complete" ? camp.phase : null,
  });
  const resolved = resolvePlanSessions(eased.plan, scaled).filter((session) => session.dayId && session.kind !== "rest");
  const ids = resolved.map((session) => session.dayId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const days = await prisma.programDay.findMany({
    where: { id: { in: ids } },
    include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } },
  });
  const byId = new Map(days.map((day) => [day.id, day]));
  return resolved.flatMap((session) => {
    const day = session.dayId ? byId.get(session.dayId) : undefined;
    if (!day || day.exercises.length === 0) return [];
    return [
      {
        programDayId: day.id,
        programSlug: day.program.slug,
        dayNumber: day.dayNumber,
        title: memberFacingTitle(session.title || day.title),
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          sets: Math.max(1, exercise.sets),
          done: Math.max(1, exercise.sets),
          reps: exercise.reps,
          logMode: exercise.logMode,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        })),
      },
    ];
  });
}

export async function previewBackfillDay(userId: string, day: string, now = new Date()): Promise<BackfillPreview> {
  const { profile, timeZone, units, weightAccess } = await memberZone(userId);
  const options = backfillDayOptions(now, timeZone);
  const key = day.trim() || options[0]?.key || "";
  assertBackfillDay(key, now, timeZone);
  const when = performedAtForDayKey(key, timeZone);
  const [programs, savedRows, existing, lastUsed, shadowWeight] = await Promise.all([
    programOptionsForDay(userId, when, timeZone),
    listSavedWorkouts(userId),
    sessionsOnCivilDay(userId, key, timeZone),
    lastUsedByType(userId),
    lastShadowWeight(userId),
  ]);
  const saved = await Promise.all(
    savedRows.slice(0, 20).map(async (row) => {
      const full = await getSavedWorkoutForUser(row.id, userId);
      return {
        id: full.id,
        name: full.name,
        exercises: full.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          done: exercise.sets,
          reps: exercise.reps,
          logMode: exercise.logMode,
        })),
      };
    }),
  );
  const band = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  return {
    dayKey: key,
    programs,
    saved,
    existing: existing.map((row) => ({
      id: row.id,
      title: memberFacingTitle(row.title) || row.title,
      status: row.status,
    })),
    days: backfillDayOptions(now, timeZone),
    roundTargets: targetsFromPrograms(programs),
    lastUsed,
    bagRounds: bagRoundCountFor(band),
    units,
    weightAccess,
    shadowWeight,
  };
}

function toCreate(sets: BackfillSetDraft[]) {
  return sets.map((set, index) => ({
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    sortOrder: index,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey.slice(0, 160),
    rir: set.rir ?? "",
  }));
}

/**
 * One-shot seam so a test can throw after the replace delete and before the
 * write. Production leaves it unset. The throw has to happen inside the
 * transaction or the delete would already be committed.
 */
let backfillWriteFault: (() => void) | null = null;

export function faultNextBackfillWrite(fault: () => void) {
  backfillWriteFault = fault;
}

export function clearBackfillWriteFault() {
  backfillWriteFault = null;
}

function throwIfBackfillWriteFault() {
  const fault = backfillWriteFault;
  backfillWriteFault = null;
  if (fault) fault();
}

async function writeElapsedOn(
  db: { workoutSession: { update: typeof prisma.workoutSession.update } },
  sessionId: string,
  seconds: number,
  performedAt: Date,
) {
  const elapsedSeconds = Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(1, Math.round(seconds)));
  await db.workoutSession.update({
    where: { id: sessionId },
    data: { elapsedSeconds, finishedAt: performedAt, timerStartedAt: null },
  });
}

async function persistBackfill(input: {
  userId: string;
  dayKey: string;
  timeZone: string;
  title: string;
  notes: string;
  rpe: number | null;
  programDayId: string | null;
  savedWorkoutId: string | null;
  sets: BackfillSetDraft[];
  plannedSetCount: number;
  plannedNames: string[];
  elapsedSeconds?: number | null;
  resolution: "" | "extra" | "replace";
  now?: Date;
}) {
  const existing = await sessionsOnCivilDay(input.userId, input.dayKey, input.timeZone);
  if (existing.length > 0 && input.resolution !== "extra" && input.resolution !== "replace") {
    return {
      ok: false as const,
      conflict: existing.map((row) => ({
        id: row.id,
        title: memberFacingTitle(row.title) || row.title,
        status: row.status,
      })),
    };
  }
  const status = backfillCompletionStatus({
    sets: input.sets,
    plannedSetCount: input.plannedSetCount,
    plannedNames: input.plannedNames,
  });
  const performedAt = performedAtForLoggedDay(input.dayKey, input.timeZone, input.now ?? new Date());
  const replacing = input.resolution === "replace" && existing.length > 0;
  const timerReady = await workoutTimerColumnsAvailable(prisma);
  const created = await prisma.$transaction(async (tx) => {
    if (replacing) {
      await tx.workoutSession.deleteMany({
        where: { userId: input.userId, id: { in: existing.map((row) => row.id) } },
      });
      throwIfBackfillWriteFault();
    }
    const row = await tx.workoutSession.create({
      data: {
        userId: input.userId,
        programDayId: input.programDayId,
        savedWorkoutId: input.savedWorkoutId,
        title: input.title,
        performedAt,
        notes: input.notes,
        status,
        plannedSetCount: input.plannedSetCount,
        sessionRpe: input.rpe,
        source: BACKFILL_SOURCE,
        backfilled: true,
        sets: { create: toCreate(input.sets) },
      },
    });
    if (timerReady && input.elapsedSeconds && input.elapsedSeconds > 0) {
      await writeElapsedOn(tx, row.id, input.elapsedSeconds, performedAt);
    }
    return row;
  });
  if (status === "complete") {
    await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  }
  return { ok: true as const, sessionId: created.id, status };
}

function exercisePayload(exercises: BackfillExerciseInput[], unit: LoadUnit, keyFor?: (exercise: BackfillExerciseInput) => string) {
  return setsForBackfillExercises(exercises, unit, keyFor);
}

const SHADOW_FISTS_NAME = "Shadowbox round 2 — fists, no weights";

type IntervalSave = {
  type: "bike" | BackfillRoundMode | "shadow";
  roundsCompleted: number;
  plannedRounds: number;
  configuredRounds: number;
  daySetCount: number | null;
  clock: IntervalMergeClock;
};

function assertCount(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError("WORKOUT", `${label} should be between ${min} and ${max}.`);
  }
}

function lastUsedLabel(sets: number, rounds: number, workSeconds: number, restSeconds: number) {
  const work = workSeconds >= 60 && workSeconds % 60 === 0 ? `${workSeconds / 60}:00` : String(workSeconds);
  const rest = restSeconds >= 60 && restSeconds % 60 === 0 ? `${restSeconds / 60}:00` : String(restSeconds);
  return sets > 1 ? `Last: ${sets}×${rounds} ${work}/${rest}` : `Last: ${rounds}×${work}/${rest}`;
}

function targetsFromPrograms(programs: BackfillProgramOption[]): BackfillPreview["roundTargets"] {
  const out: BackfillPreview["roundTargets"] = {};
  const types = ["bike", "bag", "pads", "sparring", "grappling"] as const;
  for (const program of programs) {
    const daySetCount = program.exercises.reduce(
      (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets || 0)),
      0,
    );
    const asRound = program.exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
      logMode: exercise.logMode,
    }));
    for (const type of types) {
      if (out[type]) continue;
      const target = roundTargetFromExercises(asRound, type);
      if (!target) continue;
      const primary = program.exercises.find((exercise) =>
        exerciseMatchesRoundType(exercise.name, exercise.logMode, type),
      );
      const parsed = type === "bike" && primary?.reps ? parseBikeIntervalReps(primary.reps) : null;
      const focus = type === "bag" && primary?.notes ? bagFocusLines(primary.notes) : null;
      const sets = type === "bike" ? Math.max(1, Math.round(primary?.sets ?? 1)) : 1;
      const rounds =
        type === "bike"
          ? (parsed?.roundsPerSet ?? Math.max(1, target.plannedRounds))
          : type === "bag" && focus
            ? focus.rounds.length
            : Math.max(1, target.plannedRounds);
      const storedRest = Math.max(0, Math.round(primary?.restSeconds ?? 0));
      out[type] = {
        programDayId: program.programDayId,
        exerciseName: target.exerciseName,
        plannedRounds: target.plannedRounds,
        daySetCount,
        sets,
        rounds,
        workSeconds: target.workSeconds,
        restSeconds: target.restSeconds,
        setRestSeconds: type === "bike" ? (storedRest > 0 ? storedRest : 60) : storedRest,
        focusRounds: focus?.rounds ?? [],
      };
    }
  }
  return out;
}

async function lastUsedByType(userId: string): Promise<BackfillPreview["lastUsed"]> {
  const rows = await prisma.workoutSession.findMany({
    where: { userId, status: { in: ["complete", "partial"] } },
    orderBy: { performedAt: "desc" },
    take: 30,
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  const out: BackfillPreview["lastUsed"] = {};
  for (const row of rows) {
    if (!out.bike) {
      const choice = bikeChoiceFromKey(row.sets.find((set) => bikeChoiceFromKey(set.prescriptionKey))?.prescriptionKey);
      if (choice) {
        const sets = choice.spec.repeatRounds ?? 1;
        const rounds = choice.spec.roundsPerSet;
        out.bike = {
          label: lastUsedLabel(sets, rounds, choice.spec.workSeconds, choice.spec.restSeconds),
          sets,
          rounds,
          workSeconds: choice.spec.workSeconds,
          restSeconds: choice.spec.restSeconds,
          setRestSeconds: choice.spec.restBetweenRoundsSeconds ?? 0,
        };
      }
    }
    for (const type of ["bag", "pads", "sparring", "grappling"] as const) {
      if (out[type]) continue;
      const matched = row.sets.filter(
        (set) => (set.prescriptionKey ?? "").startsWith(`round:${type}:`) && (set.durationSeconds ?? 0) > 0,
      );
      if (matched.length === 0) continue;
      const work = matched[0]?.durationSeconds ?? 180;
      const rest = restSecondsFromRoundKey(matched[0]?.prescriptionKey) ?? 0;
      out[type] = {
        label: lastUsedLabel(1, matched.length, work, rest),
        sets: 1,
        rounds: matched.length,
        workSeconds: work,
        restSeconds: rest,
        setRestSeconds: 0,
      };
    }
    if (!out.shadow) {
      const shadow = row.sets.filter((set) => isShadowName(set.exerciseName) && (set.durationSeconds ?? 0) > 0);
      if (shadow.length >= 2) {
        const work = shadow[0]?.durationSeconds ?? 180;
        out.shadow = {
          label: "Last: shadow",
          sets: 1,
          rounds: shadow.length,
          workSeconds: work,
          restSeconds: 60,
          setRestSeconds: 0,
        };
      }
    }
  }
  return out;
}

async function lastShadowWeight(userId: string): Promise<number | null> {
  const rows = await prisma.workoutSet.findMany({
    where: { logMode: "load_timed", loadValue: { gt: 0 }, session: { userId } },
    orderBy: { session: { performedAt: "desc" } },
    take: 20,
    select: { exerciseName: true, loadValue: true },
  });
  const hit = rows.find((row) => isWeightedShadowName(row.exerciseName));
  return hit?.loadValue ?? null;
}

function shadowPayload(input: BackfillPayload, unit: LoadUnit, weightAccess: string) {
  const rounds = input.shadowRounds ?? [];
  if (rounds.length < 2) throw new AppError("WORKOUT", "Shadow needs at least 2 rounds.");
  const bare = weightAccess === "none";
  const sets: BackfillSetDraft[] = rounds.map((round, index) => {
    const workSeconds = Math.round(round.workSeconds);
    assertSaneSetSeconds(workSeconds, "Round length");
    const weighted = index === 1 && !bare;
    const exerciseName =
      index === 0 ? SHADOW_EMPTY_NAME : index === 1 ? (bare ? SHADOW_FISTS_NAME : SHADOW_WEIGHTED_NAME) : `Shadowbox round ${index + 1}`;
    return {
      exerciseName,
      setNumber: 1,
      reps: null,
      loadValue: weighted && round.weight != null && round.weight > 0 ? round.weight : null,
      loadUnit: unit,
      logMode: weighted ? "load_timed" : "timed",
      durationSeconds: workSeconds,
      completed: true,
      notes: "",
      prescriptionKey: "",
    };
  });
  const totals = intervalTotals(
    "shadow",
    {
      sets: 1,
      rounds: rounds.length,
      workSeconds: rounds[0]?.workSeconds ?? 180,
      restSeconds: rounds[0]?.restSeconds ?? 0,
      setRestSeconds: 0,
      shadowRounds: rounds.map((round) => ({
        workSeconds: round.workSeconds,
        restSeconds: round.restSeconds,
      })),
    },
    rounds.length,
  );
  return {
    title: cleanTitle(input.title, "Shadowbox"),
    notes: input.notes.trim().slice(0, 1000),
    programDayId: null as string | null,
    savedWorkoutId: null as string | null,
    sets,
    plannedSetCount: sets.length,
    plannedNames: sets.map((set) => set.exerciseName),
    elapsedSeconds: totals.totalSeconds,
    interval: {
      type: "shadow" as const,
      roundsCompleted: rounds.length,
      plannedRounds: rounds.length,
      configuredRounds: rounds.length,
      daySetCount: null,
      clock: {
        workSeconds: Math.round(rounds[0]?.workSeconds ?? 0),
        restSeconds: 0,
        sets: 1,
        setRestSeconds: 0,
        roundsCompleted: rounds.length,
        roundWorkSeconds: rounds.map((round) => Math.round(round.workSeconds)),
      },
    },
  };
}

function setMatchesInterval(
  set: { exerciseName?: string | null; logMode?: string | null; prescriptionKey?: string | null },
  type: IntervalSave["type"],
) {
  if (type === "shadow") return isShadowName(set.exerciseName ?? "");
  return setBelongsToRoundType(set, type);
}

function sessionMatchesInterval(
  session: {
    title?: string | null;
    sets: { exerciseName?: string | null; logMode?: string | null; prescriptionKey?: string | null }[];
  },
  type: IntervalSave["type"],
) {
  if (type === "shadow") return session.sets.some((set) => isShadowName(set.exerciseName ?? ""));
  return sessionMatchesRoundType(session, type);
}

function loggedIntervalRounds(
  sets: {
    exerciseName?: string | null;
    logMode?: string | null;
    prescriptionKey?: string | null;
    reps?: number | null;
    loadValue?: number | null;
    durationSeconds?: number | null;
    completed?: boolean | null;
  }[],
  type: IntervalSave["type"],
) {
  return sets.filter((set) => set.completed !== false && setMatchesInterval(set, type) && setHasLoggedWork(set)).length;
}

function intervalStatus(interval: IntervalSave, keptCount: number) {
  const mixed = keptCount > 0 || (interval.daySetCount != null && interval.daySetCount > interval.plannedRounds);
  if (mixed) return "partial" as const;
  return roundSaveStatus({
    roundsCompleted: interval.roundsCompleted,
    plannedRounds: interval.plannedRounds,
    configuredRounds: interval.configuredRounds,
  });
}

async function writeElapsedSecondsOnly(
  db: { workoutSession: { update: typeof prisma.workoutSession.update } },
  sessionId: string,
  seconds: number,
) {
  const elapsedSeconds = Math.min(SESSION_DURATION_CAP_SECONDS, Math.max(1, Math.round(seconds)));
  await db.workoutSession.update({
    where: { id: sessionId },
    data: { elapsedSeconds },
  });
}

/**
 * Interval saves extend a same-day log only when canMergeIntervalLog says so.
 * Stored rounds stay. A different clock, a longer log, or any draft
 * becomes its own session. Source, backfilled, and performedAt are not rewritten.
 */
async function persistIntervalBackfill(input: {
  userId: string;
  dayKey: string;
  timeZone: string;
  now: Date;
  title: string;
  notes: string;
  rpe: number | null;
  programDayId: string | null;
  sets: BackfillSetDraft[];
  plannedSetCount: number;
  elapsedSeconds: number;
  interval: IntervalSave;
}) {
  const when = performedAtForLoggedDay(input.dayKey, input.timeZone, input.now);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId: input.userId,
      status: { in: ["draft", "partial", "complete"] },
      performedAt: {
        gte: new Date(when.getTime() - DAY_PAD_MS),
        lte: new Date(when.getTime() + DAY_PAD_MS),
      },
    },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
    orderBy: { createdAt: "asc" },
  });
  const programDayId = input.programDayId ?? null;
  const timerReady = await workoutTimerColumnsAvailable(prisma);
  const matches = rows.filter(
    (row) =>
      sessionCompletionDay(row, input.timeZone) === input.dayKey &&
      sessionMatchesInterval(row, input.interval.type),
  );
  let target: (typeof matches)[number] | null = null;
  for (const row of matches) {
    const timer = timerReady ? await readWorkoutTimerFields(row.id, prisma) : null;
    const merge = canMergeIntervalLog(
      { ...row, timerStartedAt: timer?.timerStartedAt ?? null },
      { type: input.interval.type, programDayId, clock: input.interval.clock },
      timerReady,
    );
    if (!merge) continue;
    if (row.status === "complete" || row.status === "partial") {
      target = row;
      break;
    }
    target ??= row;
  }
  const status = intervalStatus(input.interval, 0);
  if (target) {
    const storedCount = loggedIntervalRounds(target.sets, input.interval.type);
    const adding = input.sets.slice(storedCount);
    const notes = input.notes.trim() ? input.notes.trim().slice(0, 1000) : target.notes;
    const growing = adding.length > 0;
    const nextStatus: "complete" | "partial" =
      growing || target.status === "draft" ? status : target.status === "complete" ? "complete" : "partial";
    const plannedSetCount = Math.max(target.plannedSetCount ?? 0, input.plannedSetCount);
    await prisma.$transaction(async (tx) => {
      throwIfBackfillWriteFault();
      if (adding.length > 0) {
        const maxNumber = target.sets.reduce((max, set) => Math.max(max, set.setNumber), 0);
        const maxSort = target.sets.reduce((max, set) => Math.max(max, set.sortOrder), 0);
        await tx.workoutSet.createMany({
          data: toCreate(adding).map((set, index) => ({
            ...set,
            workoutSessionId: target.id,
            setNumber: maxNumber + index + 1,
            sortOrder: maxSort + index + 1,
          })),
        });
      }
      await tx.workoutSession.update({
        where: { id: target.id },
        data: {
          title: growing ? input.title : target.title,
          notes,
          status: nextStatus,
          plannedSetCount,
          sessionRpe: input.rpe == null ? target.sessionRpe : input.rpe,
        },
      });
      if (timerReady && growing && input.elapsedSeconds > 0) {
        await writeElapsedSecondsOnly(tx, target.id, input.elapsedSeconds);
      }
    });
    if (nextStatus === "complete" && target.status !== "complete") {
      await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
    }
    return { ok: true as const, sessionId: target.id, status: nextStatus };
  }
  const created = await prisma.$transaction(async (tx) => {
    throwIfBackfillWriteFault();
    const row = await tx.workoutSession.create({
      data: {
        userId: input.userId,
        programDayId,
        title: input.title,
        performedAt: when,
        notes: input.notes.trim().slice(0, 1000),
        status,
        plannedSetCount: input.plannedSetCount,
        sessionRpe: input.rpe,
        source: BACKFILL_SOURCE,
        backfilled: true,
        sets: { create: toCreate(input.sets) },
      },
    });
    if (timerReady && input.elapsedSeconds > 0) await writeElapsedOn(tx, row.id, input.elapsedSeconds, when);
    return row;
  });
  if (status === "complete") await recordMetric(METRIC_NAMES.workoutLogged, input.userId);
  return { ok: true as const, sessionId: created.id, status };
}

/** Full configured clock, including rounds the member has not marked done. */
function configuredIntervalSeconds(input: {
  kind: "bike" | BackfillRoundMode;
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
}) {
  return intervalConfiguredSeconds(input.kind === "bike" ? "bike" : "round", input);
}

function assertSavableInterval(input: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
  totalSeconds: number;
}) {
  assertCount(input.sets, 1, INTERVAL_SETS_MAX, "Sets");
  assertCount(input.rounds, 1, INTERVAL_ROUNDS_MAX, "Rounds");
  const workMax = intervalWorkMax(input);
  if (workMax === INTERVAL_SESSION_MAX_SECONDS && input.workSeconds > INTERVAL_SESSION_MAX_SECONDS) {
    throw new AppError("WORKOUT", "That workout is longer than 4 hours.");
  }
  assertCount(input.workSeconds, INTERVAL_WORK_MIN, workMax, "Work");
  assertCount(input.restSeconds, 0, INTERVAL_REST_MAX, "Rest");
  assertCount(input.setRestSeconds, 0, INTERVAL_SET_REST_MAX, "Set rest");
  if (input.totalSeconds > INTERVAL_SESSION_MAX_SECONDS) {
    throw new AppError("WORKOUT", "That workout is longer than 4 hours.");
  }
}

async function payloadFromKind(
  input: BackfillPayload,
  unit: LoadUnit,
  timeZone: string,
  weightAccess: string,
) {
  if (input.kind === "program") {
    const programDayId = input.programDayId ?? "";
    const day = await prisma.programDay.findUnique({
      where: { id: programDayId },
      include: { program: true, exercises: { orderBy: { sortOrder: "asc" } } },
    });
    if (!day) throw new AppError("WORKOUT", "That program session is not on this day.");
    const byName = new Map((input.exercises ?? []).map((row) => [row.name.trim().toLowerCase(), row]));
    const exercises = day.exercises.map((exercise) => {
      const posted = byName.get(exercise.name.trim().toLowerCase());
      const planned = Math.max(1, exercise.sets);
      return {
        name: exercise.name,
        sets: planned,
        done: posted ? posted.done : planned,
        reps: exercise.reps,
        logMode: exercise.logMode,
      };
    });
    const built = exercisePayload(exercises, unit, (exercise) =>
      prescriptionSlotKey({
        exerciseName: exercise.name,
        reps: exercise.reps,
        programSlug: day.program.slug,
        dayNumber: day.dayNumber,
      }),
    );
    return {
      title: cleanTitle(input.title, memberFacingTitle(day.title) || "Workout"),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: day.id,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: null as number | null,
      interval: null,
    };
  }

  if (input.kind === "saved") {
    const saved = await getSavedWorkoutForUser(input.savedWorkoutId ?? "", input.userId);
    const byName = new Map((input.exercises ?? []).map((row) => [row.name.trim().toLowerCase(), row]));
    const exercises = saved.exercises.map((exercise) => {
      const posted = byName.get(exercise.name.trim().toLowerCase());
      return {
        name: exercise.name,
        sets: exercise.sets,
        done: posted ? posted.done : exercise.sets,
        reps: exercise.reps,
        logMode: exercise.logMode,
      };
    });
    const built = exercisePayload(exercises, unit);
    return {
      title: cleanTitle(input.title, saved.name),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: saved.id,
      ...built,
      elapsedSeconds: null as number | null,
      interval: null,
    };
  }

  if (input.kind === "custom") {
    const built = exercisePayload(input.exercises ?? [], unit);
    return {
      title: cleanTitle(input.title, "Custom workout"),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: null,
      savedWorkoutId: null,
      ...built,
      elapsedSeconds: null as number | null,
      interval: null,
    };
  }

  if (input.kind === "bag" || input.kind === "pads" || input.kind === "sparring" || input.kind === "grappling") {
    return payloadFromKind({ ...input, kind: "rounds", roundMode: input.kind }, unit, timeZone, weightAccess);
  }

  if (input.kind === "shadow") {
    return shadowPayload(input, unit, weightAccess);
  }

  if (input.kind === "bike") {
    const roundsPerSet = Math.round(input.roundsPerSet ?? input.plannedRounds ?? 0);
    const repeatRounds = Math.round(input.repeatRounds ?? 1);
    const workSeconds = Math.round(input.workSeconds ?? 0);
    const restSeconds = Math.max(0, Math.round(input.restSeconds ?? 0));
    const setRest = Math.max(0, Math.round(input.restBetweenRoundsSeconds ?? 0));
    const shownSetRest = repeatRounds > 1 ? setRest : 0;
    assertSavableInterval({
      sets: repeatRounds,
      rounds: roundsPerSet,
      workSeconds,
      restSeconds,
      setRestSeconds: shownSetRest,
      totalSeconds: configuredIntervalSeconds({
        kind: "bike",
        sets: repeatRounds,
        rounds: roundsPerSet,
        workSeconds,
        restSeconds,
        setRestSeconds: shownSetRest,
      }),
    });
    const choice = choiceForBackfill({
      workSeconds,
      restSeconds,
      roundsPerSet,
      repeatRounds,
      restBetweenRoundsSeconds: repeatRounds > 1 ? setRest : 0,
    });
    const structureName = structureLabel({
      sets: repeatRounds,
      rounds: roundsPerSet,
      workSeconds,
      restSeconds,
      setRestSeconds: shownSetRest,
    });
    const generatedName = choice.name === BIKE_TIMER_EXERCISE ? structureName : choice.name;
    const total = bikeTimerRoundCount(choice);
    const done = Math.min(total, Math.max(0, Math.round(input.doneRounds ?? total)));
    if (done < 1) throw new AppError("WORKOUT", "Log at least one set, then save.");
    const sets: BackfillSetDraft[] = bikeTimerLogSets(choice, unit, done).map((set) => ({
      ...set,
      notes: "",
      loadValue: null,
    }));
    const target = await scheduledRoundPlanTarget(input.userId, "bike", performedAtForDayKey(input.dayKey, timeZone));
    const plannedRounds = target?.plannedRounds ?? total;
    const daySetCount = target && target.daySetCount > 0 ? target.daySetCount : null;
    return {
      title: cleanTitle(input.title, generatedName),
      notes: notesWithBikeMetrics(input.notes, input.calories ?? null, input.distance ?? null),
      // A posted lift day must not become this ride. Only the scheduled bike day attaches.
      programDayId: target?.programDayId ?? null,
      savedWorkoutId: null,
      sets,
      plannedSetCount: daySetCount ?? plannedRounds,
      plannedNames: [BIKE_TIMER_EXERCISE],
      elapsedSeconds: bikeTimerSessionSeconds(choice, done),
      interval: {
        type: "bike" as const,
        roundsCompleted: done,
        plannedRounds,
        configuredRounds: total,
        daySetCount,
        clock: {
          workSeconds,
          restSeconds,
          sets: repeatRounds,
          setRestSeconds: repeatRounds > 1 ? setRest : 0,
          roundsCompleted: done,
        },
      },
    };
  }

  if (input.kind === "rounds") {
    const roundMode = input.roundMode ?? "";
    if (!isBackfillRoundMode(roundMode)) {
      throw new AppError("WORKOUT", "Pick bag, pads, sparring, or grappling.");
    }
    const roundsPerSet = Math.round(input.roundsPerSet ?? input.plannedRounds ?? 0);
    const repeatRounds = Math.round(input.repeatRounds ?? 1);
    const workSeconds = Math.round(input.workSeconds ?? 180);
    const restSeconds = Math.max(0, Math.round(input.restSeconds ?? 0));
    const setRest = Math.max(0, Math.round(input.restBetweenRoundsSeconds ?? 0));
    const shownSetRest = repeatRounds > 1 ? setRest : 0;
    assertSavableInterval({
      sets: repeatRounds,
      rounds: roundsPerSet,
      workSeconds,
      restSeconds,
      setRestSeconds: shownSetRest,
      totalSeconds: configuredIntervalSeconds({
        kind: roundMode,
        sets: repeatRounds,
        rounds: roundsPerSet,
        workSeconds,
        restSeconds,
        setRestSeconds: shownSetRest,
      }),
    });
    const total = roundsPerSet * repeatRounds;
    const done = Math.min(total, Math.max(0, Math.round(input.doneRounds ?? total)));
    if (done < 1) throw new AppError("WORKOUT", "Log at least one set, then save.");
    const name = BACKFILL_ROUND_MODES[roundMode];
    const focus = (input.focusNotes ?? []).map((line) => line.trim()).filter(Boolean);
    const logged = roundLogSets({
      type: roundMode,
      exerciseName: name,
      rounds: done,
      workSeconds,
      restSeconds,
      unit,
    });
    const sets: BackfillSetDraft[] = logged.map((set, index) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: null,
      loadValue: null,
      loadUnit: unit,
      logMode: "timed_round",
      durationSeconds: set.durationSeconds ?? null,
      completed: true,
      notes: (focus[index] || set.notes || "").slice(0, 200),
      prescriptionKey: roundStructureKey(roundMode, restSeconds, {
        sets: repeatRounds,
        setRestSeconds: setRest,
        roundsPerSet,
      }),
    }));
    const target = await scheduledRoundPlanTarget(
      input.userId,
      roundMode,
      performedAtForDayKey(input.dayKey, timeZone),
    );
    const plannedRounds = target?.plannedRounds ?? total;
    const daySetCount = target && target.daySetCount > 0 ? target.daySetCount : null;
    const totals = intervalTotals(
      roundMode,
      {
        sets: repeatRounds,
        rounds: roundsPerSet,
        workSeconds,
        restSeconds,
        setRestSeconds: setRest,
      },
      done,
    );
    return {
      title: cleanTitle(input.title, name),
      notes: input.notes.trim().slice(0, 1000),
      programDayId: target?.programDayId ?? input.programDayId ?? null,
      savedWorkoutId: null,
      sets,
      plannedSetCount: daySetCount ?? plannedRounds,
      plannedNames: [name],
      elapsedSeconds: totals.totalSeconds,
      interval: {
        type: roundMode,
        roundsCompleted: done,
        plannedRounds,
        configuredRounds: total,
        daySetCount,
        clock: {
          workSeconds,
          restSeconds,
          sets: repeatRounds,
          setRestSeconds: repeatRounds > 1 ? setRest : 0,
          roundsCompleted: done,
        },
      },
    };
  }

  const durationSeconds = Math.round(input.durationSeconds ?? 0);
  assertSaneDurationSeconds(durationSeconds, "Duration");
  const name = cleanTitle(input.title, "Workout");
  const perSet = Math.min(BACKFILL_MAX_SET_SECONDS, durationSeconds);
  const built = setsForBackfillExercises(
    [{ name, sets: 1, done: 1, reps: String(perSet), logMode: "timed" }],
    unit,
  );
  for (const set of built.sets) set.durationSeconds = perSet;
  return {
    title: name,
    notes: input.notes.trim().slice(0, 1000),
    programDayId: null,
    savedWorkoutId: null,
    ...built,
    elapsedSeconds: durationSeconds,
    interval: null,
  };
}

export async function createBackfillWorkout(input: BackfillPayload): Promise<BackfillWriteResult> {
  if (!isBackfillKind(input.kind)) throw new AppError("WORKOUT", "Pick a workout type.");
  const { timeZone, units, weightAccess } = await memberZone(input.userId);
  const now = input.now ?? new Date();
  assertBackfillDay(input.dayKey, now, timeZone);
  const built = await payloadFromKind(input, units, timeZone, weightAccess);
  if (built.interval) {
    return persistIntervalBackfill({
      userId: input.userId,
      dayKey: input.dayKey,
      timeZone,
      now,
      title: built.title,
      notes: built.notes,
      rpe: input.rpe,
      programDayId: built.programDayId,
      sets: built.sets,
      plannedSetCount: built.plannedSetCount,
      elapsedSeconds: built.elapsedSeconds ?? 0,
      interval: built.interval,
    });
  }
  return persistBackfill({
    userId: input.userId,
    dayKey: input.dayKey,
    timeZone,
    title: built.title,
    notes: built.notes,
    rpe: input.rpe,
    programDayId: built.programDayId,
    savedWorkoutId: built.savedWorkoutId,
    sets: built.sets,
    plannedSetCount: built.plannedSetCount,
    plannedNames: built.plannedNames,
    elapsedSeconds: built.elapsedSeconds,
    resolution: input.resolution,
    now,
  });
}

export type BackfillFormSeed = {
  title: string;
  notes: string;
  dayKey: string;
  sessionRpe: number | null;
  exercises: {
    name: string;
    sets: number;
    done: number;
    reps: string;
    logMode: string;
    prescriptionKey?: string;
    durationSeconds?: number | null;
    setNotes?: string;
    storedReps?: number | null;
  }[];
};

/** Values the edit and delete dialogs can paint before the edit request returns. */
export function backfillFormSeed(
  session: {
    title: string;
    notes: string | null;
    sessionRpe: number | null;
    performedAt: Date;
    sets: {
      exerciseName: string;
      completed: boolean;
      reps: number | null;
      loadValue: number | null;
      durationSeconds: number | null;
      logMode: string;
      prescriptionKey?: string | null;
      notes?: string | null;
    }[];
  },
  timeZone: string,
  now = new Date(),
): BackfillFormSeed {
  const key = sessionCompletionDay(session, timeZone);
  const groups = new Map<
    string,
    {
      planned: number;
      done: number;
      logMode: string;
      durationSeconds: number | null;
      reps: number | null;
      prescriptionKey: string;
      notes: string;
    }
  >();
  for (const set of session.sets) {
    const current = groups.get(set.exerciseName) ?? {
      planned: 0,
      done: 0,
      logMode: set.logMode,
      durationSeconds: null,
      reps: null,
      prescriptionKey: "",
      notes: "",
    };
    current.planned += 1;
    const worked = set.completed && (set.reps != null || set.loadValue != null || (set.durationSeconds ?? 0) > 0);
    if (worked) current.done += 1;
    if ((set.durationSeconds ?? 0) > 0 && current.durationSeconds == null) {
      current.durationSeconds = set.durationSeconds;
    }
    if (set.reps != null && set.reps > 0 && current.reps == null) current.reps = set.reps;
    if (!current.prescriptionKey && set.prescriptionKey) current.prescriptionKey = set.prescriptionKey;
    if (!current.notes && set.notes) current.notes = set.notes;
    if (set.logMode) current.logMode = set.logMode;
    groups.set(set.exerciseName, current);
  }
  return {
    title: session.title,
    notes: session.notes ?? "",
    dayKey: backfillDayState(key, now, timeZone) === "ok" ? key : backfillDayOptions(now, timeZone)[0]?.key ?? key,
    sessionRpe: session.sessionRpe,
    exercises: [...groups.entries()].map(([name, row]) => {
      const mode = resolveLogMode({ logMode: row.logMode, name, reps: "" });
      const timed = isDurationMode(mode);
      return {
        name,
        sets: row.planned,
        done: row.done,
        logMode: row.logMode,
        reps: timed && row.durationSeconds ? formatClock(row.durationSeconds) : row.reps != null ? String(row.reps) : "",
        prescriptionKey: row.prescriptionKey,
        durationSeconds: row.durationSeconds,
        setNotes: row.notes,
        storedReps: row.reps,
      };
    }),
  };
}

export async function getBackfillForEdit(userId: string, sessionId: string, now = new Date()) {
  const { timeZone } = await memberZone(userId);
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session || session.userId !== userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be edited here.");
  const key = sessionCompletionDay(session, timeZone);
  const seed = backfillFormSeed(session, timeZone, now);
  return {
    id: session.id,
    title: seed.title,
    notes: seed.notes,
    dayKey: seed.dayKey,
    originalDayKey: key,
    status: session.status,
    sessionRpe: seed.sessionRpe,
    exercises: seed.exercises,
    structure: decodeInterval(session.sets),
    days: backfillDayOptions(now, timeZone),
    existing: (await sessionsOnCivilDay(userId, key, timeZone))
      .filter((row) => row.id !== session.id)
      .map((row) => ({ id: row.id, title: memberFacingTitle(row.title) || row.title, status: row.status })),
  };
}

/** Blank edit fields keep the duration, round key, and notes already on the log. */
export function preserveBackfillExercises(
  posted: BackfillExerciseInput[],
  existing: {
    exerciseName: string;
    durationSeconds: number | null;
    prescriptionKey?: string | null;
    notes?: string | null;
    logMode?: string | null;
    reps: number | null;
    completed?: boolean | null;
  }[],
): BackfillExerciseInput[] {
  return posted.map((exercise) => {
    const name = exercise.name.trim().replace(/\s+/g, " ");
    const matches = existing.filter((set) => set.exerciseName.trim().replace(/\s+/g, " ") === name);
    if (matches.length === 0) return exercise;
    const template =
      matches.find((set) => set.completed !== false && ((set.durationSeconds ?? 0) > 0 || (set.reps ?? 0) > 0)) ??
      matches[0]!;
    const repsText = (exercise.reps ?? "").trim();
    const key = (exercise.prescriptionKey ?? "").trim() || (template.prescriptionKey ?? "").trim();
    const notes = (exercise.setNotes ?? "").trim() || template.notes || "";
    return {
      ...exercise,
      logMode: exercise.logMode || template.logMode || "",
      durationSeconds: exercise.durationSeconds ?? template.durationSeconds,
      storedReps: exercise.storedReps ?? template.reps,
      prescriptionKey: key,
      setNotes: notes,
      reps: repsText,
    };
  });
}

async function updateIntervalBackfill(input: {
  session: {
    id: string;
    title: string;
    performedAt: Date;
    status: string;
    plannedSetCount: number | null;
    notes: string | null;
  };
  dayKey: string;
  timeZone: string;
  units: LoadUnit;
  now: Date;
  title: string;
  notes: string;
  rpe: number | null;
  posted: DecodedInterval;
  decoded: DecodedInterval;
}) {
  const posted = input.posted;
  const configured = Math.max(1, posted.sets * posted.rounds);
  const requestedDone = Math.round(posted.done);
  if (!Number.isInteger(requestedDone) || requestedDone < 1) {
    throw new AppError("WORKOUT", "Log at least one set, then save.");
  }
  const done = Math.min(configured, requestedDone);
  const sameStructure =
    posted.sets === input.decoded.sets &&
    posted.rounds === input.decoded.rounds &&
    posted.workSeconds === input.decoded.workSeconds &&
    posted.restSeconds === input.decoded.restSeconds &&
    posted.setRestSeconds === input.decoded.setRestSeconds;
  const doneUnchanged = done === input.decoded.done;
  const sameDay = sessionCompletionDay({ performedAt: input.session.performedAt }, input.timeZone) === input.dayKey;
  const performedAt = sameDay
    ? input.session.performedAt
    : performedAtForLoggedDay(input.dayKey, input.timeZone, input.now);
  const keptStatus: "complete" | "partial" = input.session.status === "complete" ? "complete" : "partial";
  if (sameStructure && doneUnchanged) {
    await prisma.workoutSession.update({
      where: { id: input.session.id },
      data: {
        title: cleanTitle(input.title, input.session.title),
        notes: input.notes.trim().slice(0, 1000),
        performedAt,
        sessionRpe: input.rpe,
      },
    });
    return { ok: true as const, sessionId: input.session.id, status: keptStatus };
  }
  const kind = posted.kind;
  assertSavableInterval({
    sets: posted.sets,
    rounds: posted.rounds,
    workSeconds: posted.workSeconds,
    restSeconds: posted.restSeconds,
    setRestSeconds: posted.sets > 1 ? posted.setRestSeconds : 0,
    totalSeconds: configuredIntervalSeconds({
      kind,
      sets: posted.sets,
      rounds: posted.rounds,
      workSeconds: posted.workSeconds,
      restSeconds: posted.restSeconds,
      setRestSeconds: posted.setRestSeconds,
    }),
  });
  let sets: BackfillSetDraft[];
  let elapsed = 0;
  if (kind === "bike") {
    const choice = choiceForBackfill({
      workSeconds: posted.workSeconds,
      restSeconds: posted.restSeconds,
      roundsPerSet: posted.rounds,
      repeatRounds: posted.sets,
      restBetweenRoundsSeconds: posted.sets > 1 ? posted.setRestSeconds : 0,
    });
    sets = bikeTimerLogSets(choice, input.units, done).map((set) => ({
      ...set,
      notes: "",
      loadValue: null,
    }));
    elapsed = bikeTimerSessionSeconds(choice, done);
  } else {
    const logged = roundLogSets({
      type: kind,
      exerciseName: BACKFILL_ROUND_MODES[kind],
      rounds: done,
      workSeconds: posted.workSeconds,
      restSeconds: posted.restSeconds,
      unit: input.units,
    });
    const key = roundStructureKey(kind, posted.restSeconds, {
      sets: posted.sets,
      setRestSeconds: posted.setRestSeconds,
      roundsPerSet: posted.rounds,
    });
    sets = logged.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: null,
      loadValue: null,
      loadUnit: input.units,
      logMode: "timed_round" as const,
      durationSeconds: set.durationSeconds ?? null,
      completed: true,
      notes: set.notes ?? "",
      prescriptionKey: key,
    }));
    elapsed = intervalTotals(
      kind,
      {
        sets: posted.sets,
        rounds: posted.rounds,
        workSeconds: posted.workSeconds,
        restSeconds: posted.restSeconds,
        setRestSeconds: posted.setRestSeconds,
      },
      done,
    ).totalSeconds;
  }
  const title = sameStructure
    ? cleanTitle(input.title, input.session.title)
    : intervalEditTitle({
        postedTitle: input.title,
        storedTitle: input.session.title,
        previous: input.decoded,
        next: posted,
      });
  const plannedSetCount = sameStructure ? Math.max(input.session.plannedSetCount ?? 0, configured) : configured;
  const status = roundSaveStatus({
    roundsCompleted: done,
    plannedRounds: plannedSetCount,
    configuredRounds: configured,
  });
  const timerReady = await workoutTimerColumnsAvailable(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.workoutSet.deleteMany({ where: { workoutSessionId: input.session.id } });
    throwIfBackfillWriteFault();
    await tx.workoutSession.update({
      where: { id: input.session.id },
      data: {
        title,
        notes: input.notes.trim().slice(0, 1000),
        performedAt,
        status,
        plannedSetCount,
        sessionRpe: input.rpe,
        sets: { create: toCreate(sets) },
      },
    });
    if (timerReady && elapsed > 0) await writeElapsedSecondsOnly(tx, input.session.id, elapsed);
  });
  return { ok: true as const, sessionId: input.session.id, status };
}

export async function updateBackfillWorkout(input: {
  userId: string;
  sessionId: string;
  dayKey: string;
  title: string;
  notes: string;
  rpe: number | null;
  exercises: BackfillExerciseInput[];
  confirmed: boolean;
  resolution: "" | "extra" | "replace";
  now?: Date;
  /** Present when the edit sheet decoded an interval. Absent on a lift edit. */
  interval?: DecodedInterval | null;
}): Promise<BackfillWriteResult> {
  if (!input.confirmed) throw new AppError("WORKOUT", "Confirm before saving this change.");
  const { timeZone, units } = await memberZone(input.userId);
  const now = input.now ?? new Date();
  assertBackfillDay(input.dayKey, now, timeZone);
  const session = await prisma.workoutSession.findUnique({
    where: { id: input.sessionId },
    include: { sets: { orderBy: [{ sortOrder: "asc" }, { setNumber: "asc" }] } },
  });
  if (!session || session.userId !== input.userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be edited here.");
  const decoded = decodeInterval(session.sets);
  if (input.interval && decoded && input.interval.kind === decoded.kind) {
    return updateIntervalBackfill({
      session,
      dayKey: input.dayKey,
      timeZone,
      units,
      now,
      title: input.title,
      notes: input.notes,
      rpe: input.rpe,
      posted: input.interval,
      decoded,
    });
  }
  const others = (await sessionsOnCivilDay(input.userId, input.dayKey, timeZone)).filter((row) => row.id !== session.id);
  if (others.length > 0 && input.resolution !== "extra" && input.resolution !== "replace") {
    return {
      ok: false,
      conflict: others.map((row) => ({
        id: row.id,
        title: memberFacingTitle(row.title) || row.title,
        status: row.status,
      })),
    };
  }
  const replacing = input.resolution === "replace" && others.length > 0;
  const built = setsForBackfillExercises(preserveBackfillExercises(input.exercises, session.sets), units);
  const status = backfillCompletionStatus({
    sets: built.sets,
    plannedSetCount: built.plannedSetCount,
    plannedNames: built.plannedNames,
  });
  const performedAt =
    sessionCompletionDay(session, timeZone) === input.dayKey
      ? session.performedAt
      : performedAtForLoggedDay(input.dayKey, timeZone, now);
  await prisma.$transaction(async (tx) => {
    if (replacing) {
      await tx.workoutSession.deleteMany({
        where: { userId: input.userId, id: { in: others.map((row) => row.id) } },
      });
      throwIfBackfillWriteFault();
    }
    await tx.workoutSet.deleteMany({ where: { workoutSessionId: session.id } });
    await tx.workoutSession.update({
      where: { id: session.id },
      data: {
        title: cleanTitle(input.title, session.title),
        notes: input.notes.trim().slice(0, 1000),
        performedAt,
        status,
        plannedSetCount: built.plannedSetCount,
        sessionRpe: input.rpe,
        source: BACKFILL_SOURCE,
        backfilled: true,
        sets: { create: toCreate(built.sets) },
      },
    });
  });
  return { ok: true, sessionId: session.id, status };
}

export async function deleteBackfillWorkout(input: { userId: string; sessionId: string; confirmed: boolean }) {
  if (!input.confirmed) throw new AppError("WORKOUT", "Confirm before deleting this workout.");
  const session = await prisma.workoutSession.findUnique({ where: { id: input.sessionId } });
  if (!session || session.userId !== input.userId) throw new ForbiddenError();
  if (!session.backfilled) throw new AppError("WORKOUT", "Only a logged-later workout can be deleted here.");
  await prisma.workoutSession.delete({ where: { id: session.id } });
}

export function readBackfillForm(formData: FormData, userId: string, now = new Date()): BackfillPayload {
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isBackfillKind(kindRaw)) throw new AppError("WORKOUT", "Pick a workout type.");
  const resolutionRaw = String(formData.get("resolution") ?? "");
  const resolution = resolutionRaw === "extra" || resolutionRaw === "replace" ? resolutionRaw : "";
  const count = Number(formData.get("exerciseCount") ?? 0);
  const exercises: BackfillExerciseInput[] = [];
  const total = Number.isFinite(count) ? Math.min(12, Math.max(0, Math.round(count))) : 0;
  for (let index = 0; index < total; index += 1) {
    exercises.push({
      name: String(formData.get(`exerciseName_${index}`) ?? ""),
      sets: Number(formData.get(`exerciseSets_${index}`) ?? 0),
      done: Number(formData.get(`exerciseDone_${index}`) ?? 0),
      reps: String(formData.get(`exerciseReps_${index}`) ?? ""),
      logMode: String(formData.get(`exerciseMode_${index}`) ?? ""),
    });
  }
  const minutes = Number(formData.get("minutes") ?? "");
  const durationSeconds = Number.isFinite(minutes) && String(formData.get("minutes") ?? "").trim() !== ""
    ? Math.round(minutes * 60)
    : null;
  return {
    userId,
    dayKey: String(formData.get("dayKey") ?? ""),
    kind: kindRaw,
    resolution,
    now,
    title: String(formData.get("title") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    rpe: parseOptionalRpe(String(formData.get("rpe") ?? "")),
    programDayId: String(formData.get("programDayId") ?? "") || null,
    savedWorkoutId: String(formData.get("savedWorkoutId") ?? "") || null,
    exercises,
    durationSeconds,
    plannedRounds: numberOrNull(formData.get("plannedRounds")),
    doneRounds: numberOrNull(formData.get("doneRounds")),
    roundMode: String(formData.get("roundMode") ?? ""),
    workSeconds: numberOrNull(formData.get("workSeconds")),
    restSeconds: numberOrNull(formData.get("restSeconds")),
    roundsPerSet: numberOrNull(formData.get("roundsPerSet")),
    repeatRounds: numberOrNull(formData.get("repeatRounds")),
    restBetweenRoundsSeconds: numberOrNull(formData.get("restBetweenRoundsSeconds")),
    focusNotes: focusNotesFromForm(formData),
    shadowRounds: shadowRoundsFromForm(formData),
    calories: parseOptionalCalories(String(formData.get("calories") ?? "")),
    distance: parseOptionalDistance(String(formData.get("distance") ?? "")),
  };
}

function focusNotesFromForm(formData: FormData) {
  if (!formData.has("focusNotes")) return null;
  return String(formData.get("focusNotes") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function shadowRoundsFromForm(formData: FormData) {
  if (!formData.has("shadowCount")) return null;
  const count = Math.min(8, Math.max(0, Math.round(Number(formData.get("shadowCount") ?? 0))));
  if (!Number.isFinite(count) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => ({
    workSeconds: Number(formData.get(`shadowWork_${index}`) ?? 0),
    restSeconds: Number(formData.get(`shadowRest_${index}`) ?? 0),
    weight: numberOrNull(formData.get(`shadowWeight_${index}`)),
  }));
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function backfillDaysForKeys(keys: string[], now: Date, timeZone: string) {
  return keys.filter((key) => backfillDayState(key, now, timeZone) === "ok");
}
