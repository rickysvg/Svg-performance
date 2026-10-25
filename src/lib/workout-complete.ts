import { isBikeIntervalName } from "@/lib/bike-sessions";
import { textIsBikeWorkout } from "@/lib/timer-session";
import { bikeChoiceFromKey, bikeTimerRoundCount } from "@/lib/bike-chooser";
import { bikeEffortSeconds } from "@/lib/bike-interval-timer";
import { isShadowName, resolveLogMode } from "@/lib/exercise-log-mode";
import { setHasLoggedWork } from "@/lib/logged-work";
import {
  formatShareDuration,
  formatShareVolume,
  SESSION_DURATION_CAP_SECONDS,
  sessionDurationSeconds,
  sessionRoundCount,
  sessionSetCount,
  sessionVolume,
  shareVolumeUnit,
  type ShareSessionLike,
  type ShareSetLike,
  type ShareStat,
} from "@/lib/share-card";
import type { LoadUnit } from "@/lib/units";

export type WorkoutCompleteTile = {
  key: "time" | "setsRounds" | "rounds" | "volume" | "prs";
  label: string;
  value: string;
};

export function sessionOrdinal(sessionId: string, completeIdsInOrder: string[]) {
  const index = completeIdsInOrder.indexOf(sessionId);
  return index >= 0 ? index + 1 : completeIdsInOrder.length;
}

export function formatWorkoutCompleteDate(date: Date, timeZone?: string) {
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timeZone || undefined,
  });
  return formatted.replace(/,/g, "").toUpperCase();
}

export function workoutCompleteHeadline() {
  return "YOU PUT IN THE WORK.";
}

function loggedSets(sets: ShareSetLike[]) {
  return sets.filter(
    (set) => set.completed || set.reps != null || set.durationSeconds != null || set.loadValue != null,
  );
}

/** A session whose logged work is only bike intervals. Lifts and bag rounds stay on the pound tiles. */
export function isBikeCardioSession(session: ShareSessionLike) {
  const sets = loggedSets(session.sets);
  return (
    sets.length > 0 &&
    sets.every((set) => isBikeIntervalName(set.exerciseName) || textIsBikeWorkout(set.exerciseName))
  );
}

function bikeCardioEffort(sets: ShareSetLike[]) {
  const choice = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((row) => row != null) ?? null;
  if (choice) {
    const effort = bikeEffortSeconds(choice.spec);
    const prescribed = bikeTimerRoundCount(choice);
    const logged = sets.length;
    if (prescribed > 0 && logged > 0 && logged < prescribed) {
      return {
        totalSeconds: Math.max(1, Math.round((effort.totalSeconds * logged) / prescribed)),
        workSeconds: Math.max(1, Math.round((effort.workSeconds * logged) / prescribed)),
      };
    }
    return effort;
  }
  const workSeconds = sets.reduce(
    (sum, set) => sum + (set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  return { totalSeconds: workSeconds, workSeconds };
}

/**
 * Bike time is the prescribed ride (work plus easy spin). A one-second logger
 * freeze is shorter than that ride, so it does not replace it. A longer saved
 * clock still counts.
 */
export function bikeCardioDurationSeconds(session: ShareSessionLike) {
  const sets = loggedSets(session.sets);
  const choice = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((row) => row != null) ?? null;
  const prescribed = choice ? bikeTimerRoundCount(choice) : 0;
  const effort = bikeCardioEffort(sets);
  const wall = sessionDurationSeconds(session);
  // Every logged round of the structure is the ride. The session clock is the
  // timer from before the change and must not replace that structure.
  if (choice && prescribed > 0 && sets.length >= prescribed) {
    const full = bikeEffortSeconds(choice.spec).totalSeconds;
    if (full > 0) return full;
  }
  if (effort.totalSeconds > 0 && wall < effort.totalSeconds) return effort.totalSeconds;
  return wall > 0 ? wall : effort.totalSeconds;
}

/**
 * Duration the member typed for a past log.
 * Null means this is a live session and the finish screen keeps its clock.
 * 0 means there is no logged duration, so the Time tile stays off
 * (a create-to-save gap and a stored 0 are not a workout).
 */
export function backfillFinishDurationSeconds(session: ShareSessionLike): number | null {
  if (!session.backfilled) return null;
  const stored = session.elapsedSeconds;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.min(SESSION_DURATION_CAP_SECONDS, Math.round(stored));
  }
  const logged = loggedSets(session.sets).reduce(
    (sum, set) => sum + (set.durationSeconds && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  return logged > 0 ? Math.min(SESSION_DURATION_CAP_SECONDS, logged) : 0;
}

function applyBackfillTime(tiles: WorkoutCompleteTile[], session: ShareSessionLike) {
  const stored = backfillFinishDurationSeconds(session);
  if (stored == null) return tiles;
  // A custom ride can leave the session clock behind the new structure.
  // History already prefers that structure. The finish Time tile matches it
  // when the stored clock is the shorter one, and still keeps a longer typed clock.
  const seconds = isBikeCardioSession(session)
    ? bikeCardioDurationSeconds({ ...session, status: "complete", elapsedSeconds: stored })
    : stored;
  if (seconds <= 0) return tiles.filter((tile) => tile.key !== "time");
  return tiles.map((tile) =>
    tile.key === "time" ? { ...tile, value: formatShareDuration(seconds) } : tile,
  );
}

/**
 * A partial lift has no frozen clock. The create-to-save gap is not workout time.
 * Stored elapsed or logged set durations still show. Zero hides the Time tile.
 */
export function partialFinishDurationSeconds(session: ShareSessionLike): number | null {
  if (session.status !== "partial" || session.backfilled) return null;
  const stored = session.elapsedSeconds;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return Math.min(SESSION_DURATION_CAP_SECONDS, Math.round(stored));
  }
  const logged = loggedSets(session.sets).reduce(
    (sum, set) => sum + (set.durationSeconds && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
  return logged > 0 ? Math.min(SESSION_DURATION_CAP_SECONDS, logged) : 0;
}

function applyFinishTime(tiles: WorkoutCompleteTile[], session: ShareSessionLike) {
  const backfill = applyBackfillTime(tiles, session);
  if (session.backfilled) return backfill;
  const seconds = partialFinishDurationSeconds(session);
  if (seconds == null) return tiles;
  if (seconds <= 0) return tiles.filter((tile) => tile.key !== "time");
  return tiles.map((tile) =>
    tile.key === "time" ? { ...tile, value: formatShareDuration(seconds) } : tile,
  );
}

function isRoundTileSet(set: ShareSetLike) {
  const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
  if (mode === "timed_round" || isBikeIntervalName(set.exerciseName) || isShadowName(set.exerciseName)) return true;
  const key = set.prescriptionKey ?? "";
  return key.startsWith("round:") || key === "bagwork";
}

function exerciseIsRound(name: string) {
  return resolveLogMode({ name }) === "timed_round" || isBikeIntervalName(name) || isShadowName(name);
}

function plannedFromExercises(
  exercises: readonly { name?: string | null; sets?: number | null }[] | null | undefined,
  wantRound: boolean,
) {
  if (!exercises || exercises.length === 0) return 0;
  return exercises.reduce((sum, exercise) => {
    const name = (exercise.name ?? "").trim();
    if (!name || exerciseIsRound(name) !== wantRound) return sum;
    return sum + Math.max(0, Math.round(exercise.sets ?? 0));
  }, 0);
}

function bikeLoggedFullStructure(session: ShareSessionLike) {
  const sets = loggedSets(session.sets);
  const choice = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((row) => row != null) ?? null;
  const prescribed = choice ? bikeTimerRoundCount(choice) : 0;
  return Boolean(choice && prescribed > 0 && sets.length >= prescribed);
}

/**
 * Live finish clock. A one-second freeze and an edited ride keep the structure.
 * A real clock that finished under the plan (a 2:15 ride on a 20:00 structure)
 * shows the elapsed time. Backfill is handled by the caller.
 */
function liveBikeFinishSeconds(session: ShareSessionLike) {
  const structure = bikeCardioDurationSeconds(session);
  const wall = sessionDurationSeconds(session);
  if (wall <= 1) return structure;
  if (bikeLoggedFullStructure(session) && wall > 0 && wall < structure) return wall;
  return structure;
}

export function workoutCompleteTiles(input: {
  session: ShareSessionLike;
  displayUnit: LoadUnit;
  newPrCount: number;
  /** Scaled day, when the finish screen has one. Done/planned uses it for mixed days. */
  planExercises?: readonly { name?: string | null; sets?: number | null }[] | null;
}): WorkoutCompleteTile[] {
  if (isBikeCardioSession(input.session)) {
    const sets = loggedSets(input.session.sets);
    const effort = bikeCardioEffort(sets);
    // Live sessions show a real elapsed clock. Structure time stays on a
    // one-second freeze, an edited ride, and a backfilled ride.
    const seconds = input.session.backfilled
      ? bikeCardioDurationSeconds(input.session)
      : liveBikeFinishSeconds(input.session);
    const intervals = sessionRoundCount(sets) || sets.length;
    return applyFinishTime(
      [
        { key: "time", label: "Time", value: seconds > 0 ? formatShareDuration(seconds) : "0:00" },
        { key: "setsRounds", label: "Intervals", value: String(intervals) },
        { key: "volume", label: "Work", value: effort.workSeconds > 0 ? formatShareDuration(effort.workSeconds) : "0:00" },
        { key: "prs", label: "New PRs", value: "0" },
      ],
      input.session,
    );
  }
  const seconds = sessionDurationSeconds(input.session);
  const sets = sessionSetCount(input.session.sets);
  const rounds = sessionRoundCount(input.session.sets);
  const volume = sessionVolume(input.session.sets, input.displayUnit);
  const roundRows = input.session.sets.filter((set) => isRoundTileSet(set));
  const liftRows = input.session.sets.filter((set) => !isRoundTileSet(set));
  const roundDone = sessionRoundCount(roundRows);
  const liftDone = liftRows.filter((set) => set.completed && setHasLoggedWork(set)).length;
  if (roundDone > 0 && liftDone > 0) {
    const liftPlanned = Math.max(liftRows.length, plannedFromExercises(input.planExercises, false), liftDone);
    const roundPlanned = Math.max(roundRows.length, plannedFromExercises(input.planExercises, true), roundDone);
    return applyFinishTime(
      [
        { key: "time", label: "Time", value: seconds > 0 ? formatShareDuration(seconds) : "0:00" },
        { key: "setsRounds", label: "Sets", value: `${liftDone} / ${liftPlanned}` },
        { key: "rounds", label: "Rounds", value: `${roundDone} / ${roundPlanned}` },
        {
          key: "volume",
          label: `Total ${shareVolumeUnit(input.displayUnit)}`,
          value: formatShareVolume(volume),
        },
        { key: "prs", label: "New PRs", value: String(input.newPrCount) },
      ],
      input.session,
    );
  }
  const setsRounds = rounds > 0 && rounds !== sets ? `${sets} / ${rounds}` : String(Math.max(sets, rounds));
  const countLabel = rounds > 0 && (sets === rounds || sets === 0) ? "Rounds" : "Sets";
  return applyFinishTime(
    [
      { key: "time", label: "Time", value: seconds > 0 ? formatShareDuration(seconds) : "0:00" },
      { key: "setsRounds", label: countLabel, value: setsRounds },
      {
        key: "volume",
        label: `Total ${shareVolumeUnit(input.displayUnit)}`,
        value: formatShareVolume(volume),
      },
      { key: "prs", label: "New PRs", value: String(input.newPrCount) },
    ],
    input.session,
  );
}

export function workoutCompleteShareStats(tiles: WorkoutCompleteTile[]): ShareStat[] {
  return tiles.map((tile) => ({ key: tile.key, label: tile.label, value: tile.value }));
}
