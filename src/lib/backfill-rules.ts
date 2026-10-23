import { AppError } from "@/lib/errors";
import { isDurationMode, parseDurationSeconds, resolveLogMode, type LogMode } from "@/lib/exercise-log-mode";
import { defaultLoggedReps } from "@/lib/logger-insert";
import {
  sessionCountsAsPlannedCompletion,
  tickedSetCount,
  type TickedSet,
} from "@/lib/logged-work";
import { isDayKey } from "@/lib/my-workout-plan";
import { addZonedDays, dayKey, startOfZonedDay, zonedDateTimeToUtc } from "@/lib/timezone";
import type { LoadUnit } from "@/lib/units";

/** How far back a member can log a workout they already did. */
export const BACKFILL_MAX_DAYS = 30;

/** A session clock longer than this is not a workout. Matches the share-card cap. */
export const BACKFILL_MAX_SESSION_SECONDS = 4 * 60 * 60;

/** One set or round stays inside the logger's existing hold limit. */
export const BACKFILL_MAX_SET_SECONDS = 60 * 60;

export const BACKFILL_SOURCE = "backfill";

export const BACKFILL_ROUND_MODES = {
  bag: "Heavy bag rounds",
  pads: "Pad rounds",
  sparring: "Sparring rounds",
  grappling: "Grappling rounds",
} as const;

export type BackfillRoundMode = keyof typeof BACKFILL_ROUND_MODES;

export type BackfillKind = "program" | "saved" | "custom" | "bike" | "rounds" | "free";

export type BackfillExerciseInput = {
  name: string;
  sets: number;
  done: number;
  reps?: string;
  logMode?: string;
  /** Kept when the edit form posts an empty reps field. */
  durationSeconds?: number | null;
  /** Rep count already stored, used when the edit form posts an empty reps field. */
  storedReps?: number | null;
  prescriptionKey?: string;
  setNotes?: string;
};

export type BackfillSetDraft = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: null;
  loadUnit: LoadUnit;
  logMode: LogMode;
  durationSeconds: number | null;
  completed: boolean;
  notes: string;
  prescriptionKey: string;
};

export function isBackfillKind(value: string): value is BackfillKind {
  return value === "program" || value === "saved" || value === "custom" || value === "bike" || value === "rounds" || value === "free";
}

export function isBackfillRoundMode(value: string): value is BackfillRoundMode {
  return value === "bag" || value === "pads" || value === "sparring" || value === "grappling";
}

export type BackfillDayState = "ok" | "future" | "today" | "old" | "invalid";

/** Yesterday through 30 days ago, in the member's zone. Today and the future are not past logs. */
export function backfillDayState(day: string, now: Date, timeZone: string): BackfillDayState {
  if (!isDayKey(day)) return "invalid";
  const [year, month, date] = day.split("-").map(Number);
  const probe = zonedDateTimeToUtc(year!, month!, date!, 12, 0, timeZone);
  if (dayKey(probe, timeZone) !== day) return "invalid";
  const today = dayKey(now, timeZone);
  if (day > today) return "future";
  if (day === today) return "today";
  const earliest = dayKey(addZonedDays(startOfZonedDay(now, timeZone), -BACKFILL_MAX_DAYS, timeZone), timeZone);
  if (day < earliest) return "old";
  return "ok";
}

export function assertBackfillDay(day: string, now: Date, timeZone: string) {
  const state = backfillDayState(day, now, timeZone);
  if (state === "ok") return;
  if (state === "future") throw new AppError("WORKOUT", "That day is in the future.");
  if (state === "today") {
    throw new AppError("WORKOUT", "Log today from Train. A past workout starts yesterday.");
  }
  if (state === "old") {
    throw new AppError("WORKOUT", "You can log a workout up to 30 days back.");
  }
  throw new AppError("WORKOUT", "Pick a date.");
}

export function backfillDayOptions(now: Date, timeZone: string) {
  const start = startOfZonedDay(now, timeZone);
  const options: { key: string; label: string }[] = [];
  for (let ago = 1; ago <= BACKFILL_MAX_DAYS; ago += 1) {
    const date = addZonedDays(start, -ago, timeZone);
    const key = dayKey(date, timeZone);
    options.push({
      key,
      label: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone,
      }),
    });
  }
  return options;
}

/** Noon in the member's zone, so the civil day key cannot slip to the day before. */
export function performedAtForDayKey(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number);
  return zonedDateTimeToUtc(year!, month!, date!, 12, 0, timeZone);
}

export function assertSaneDurationSeconds(seconds: number, label = "Duration") {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > BACKFILL_MAX_SESSION_SECONDS) {
    throw new AppError("WORKOUT", `${label} should be between 1 second and 4 hours.`);
  }
}

export function assertSaneSetSeconds(seconds: number, label = "Round length") {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > BACKFILL_MAX_SET_SECONDS) {
    throw new AppError("WORKOUT", `${label} should be under 60 minutes.`);
  }
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Same gate as a saved session: every planned set ticked, or partial when some
 * work is logged. An empty log is not a session.
 */
export function backfillCompletionStatus(input: {
  sets: TickedSet[];
  plannedSetCount: number;
  plannedNames?: string[];
}): "complete" | "partial" {
  const plannedSetCount = Math.max(0, Math.round(input.plannedSetCount));
  const session = {
    status: "complete" as const,
    sets: input.sets,
    plannedSetCount,
  };
  if (
    sessionCountsAsPlannedCompletion(
      session,
      input.plannedNames ?? [],
      plannedSetCount > 0 ? plannedSetCount : null,
    )
  ) {
    return "complete";
  }
  if (tickedSetCount(input.sets) > 0) return "partial";
  throw new AppError("WORKOUT", "Log at least one set, then save.");
}

export function setsForBackfillExercises(
  exercises: BackfillExerciseInput[],
  unit: LoadUnit,
  prescriptionKeyFor?: (exercise: BackfillExerciseInput) => string,
): { sets: BackfillSetDraft[]; plannedSetCount: number; plannedNames: string[] } {
  const sets: BackfillSetDraft[] = [];
  const plannedNames: string[] = [];
  let plannedSetCount = 0;
  // Set numbers keep going across rows that share a name. A later unique
  // slot on (session, exercise name, set number) rejects a second set 1.
  const nextSetNumber = new Map<string, number>();
  for (const exercise of exercises) {
    const name = exercise.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) continue;
    const planned = clampInt(exercise.sets, 1, 20);
    const done = clampInt(exercise.done, 0, planned);
    const repsText = (exercise.reps ?? "").trim();
    const mode = resolveLogMode({ logMode: exercise.logMode, name, reps: repsText });
    const timed = isDurationMode(mode);
    const storedReps =
      exercise.storedReps != null && exercise.storedReps > 0 ? Math.round(exercise.storedReps) : null;
    const reps = timed ? null : (defaultLoggedReps(repsText) ?? storedReps ?? 8);
    const parsedDuration = timed ? parseDurationSeconds(repsText) : null;
    const storedDuration =
      timed && exercise.durationSeconds != null && exercise.durationSeconds > 0
        ? Math.min(BACKFILL_MAX_SET_SECONDS, Math.round(exercise.durationSeconds))
        : null;
    const durationSeconds = timed
      ? Math.min(BACKFILL_MAX_SET_SECONDS, Math.max(1, parsedDuration ?? storedDuration ?? 30))
      : null;
    plannedNames.push(name);
    plannedSetCount += planned;
    const prescriptionKey = prescriptionKeyFor?.(exercise) ?? (exercise.prescriptionKey ?? "").trim();
    const setNotes = (exercise.setNotes ?? "").slice(0, 200);
    const first = nextSetNumber.get(name) ?? 1;
    for (let offset = 0; offset < planned; offset += 1) {
      const completed = offset < done;
      sets.push({
        exerciseName: name,
        setNumber: first + offset,
        reps: completed ? reps : null,
        loadValue: null,
        loadUnit: unit,
        logMode: mode,
        durationSeconds: completed ? durationSeconds : null,
        completed,
        notes: completed ? setNotes : "",
        prescriptionKey,
      });
    }
    nextSetNumber.set(name, first + planned);
  }
  if (plannedSetCount < 1 || sets.length < 1) {
    throw new AppError("WORKOUT", "Add at least one exercise.");
  }
  return { sets, plannedSetCount, plannedNames };
}

export function parseOptionalRpe(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new AppError("WORKOUT", "RPE should be from 1 to 10.");
  }
  return value;
}

export function parseOptionalCalories(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 5000) {
    throw new AppError("WORKOUT", "Calories should be between 0 and 5000.");
  }
  return Math.round(value);
}

export function parseOptionalDistance(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 200) {
    throw new AppError("WORKOUT", "Distance should be between 0 and 200.");
  }
  return Math.round(value * 100) / 100;
}

export function notesWithBikeMetrics(notes: string, calories: number | null, distance: number | null) {
  const lines: string[] = [];
  if (calories != null) lines.push(`Calories: ${calories}`);
  if (distance != null) lines.push(`Distance: ${distance}`);
  const body = notes.trim();
  if (body) lines.push(body);
  return lines.join("\n").slice(0, 1000);
}
