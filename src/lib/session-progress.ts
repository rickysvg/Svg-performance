import { isBikeIntervalName } from "@/lib/bike-sessions";
import { resolveLogMode } from "@/lib/exercise-log-mode";
import {
  exerciseSetProgress,
  loggedNameMatchesPlanned,
  prescribedSetTotal,
  setIsTicked,
  tickedSetCount,
  type ExerciseSetProgress,
  type TickedSet,
} from "@/lib/logged-work";

/**
 * One progress line for History, the Calendar card, and the finish screen.
 * A planned session is logged sets against the scaled dose from calendarPlanDoses.
 * A custom session uses its own planned rows. A round or bike session uses the
 * stored round plan, and a count that only echoes the logged rounds does not
 * hide a larger plan still on the day.
 */
export type ProgressSet = TickedSet & {
  prescriptionKey?: string | null;
  logMode?: string | null;
};

export type ProgressSession = {
  status: string;
  plannedSetCount?: number | null;
  programDayId?: string | null;
  sets: ProgressSet[];
  programDay?: { exercises?: { name?: string | null; sets?: number | null }[] } | null;
};

export type ProgressDose = {
  dose?: number | null;
  names?: readonly string[];
  exercises?: readonly { name?: string | null; sets?: number | null }[] | null;
};

export type SessionProgress = {
  ticked: number;
  planned: number;
  done: boolean;
  /** "1/26 sets · Partial" or "3/3 rounds · Done". The same string on every surface. */
  text: string;
  rows: ExerciseSetProgress[];
};

function planNames(dose: ProgressDose | null | undefined, exercises: { name?: string | null }[]) {
  const named = (dose?.names ?? []).map((name) => name.trim()).filter((name) => name.length > 0);
  if (named.length > 0) return named;
  return exercises.map((exercise) => (exercise.name ?? "").trim()).filter((name) => name.length > 0);
}

/** A push-up does not finish a bike day. A full swap that covers the dose still can. */
function namesAreCovered(session: ProgressSession, names: string[]) {
  const ticked = session.sets.filter((set) => setIsTicked(set));
  return names.every((planned) =>
    ticked.some((set) => loggedNameMatchesPlanned(planned, set.exerciseName ?? "")),
  );
}

function storedPlan(session: ProgressSession) {
  return typeof session.plannedSetCount === "number" && session.plannedSetCount > 0
    ? Math.round(session.plannedSetCount)
    : 0;
}

function isRoundOrBikeSet(set: ProgressSet) {
  const key = set.prescriptionKey ?? "";
  if (key.startsWith("round:") || key === "bagwork") return true;
  if (isBikeIntervalName(set.exerciseName ?? "")) return true;
  return false;
}

function roundOrBikeSession(session: ProgressSession) {
  return session.sets.length > 0 && session.sets.every((set) => isRoundOrBikeSet(set));
}

/** Sets on the round or bike exercise, not the rest of a mixed day. */
function roundPlanFromExercises(session: ProgressSession, exercises: { name?: string | null; sets?: number | null }[]) {
  const bike = session.sets.some((set) => isBikeIntervalName(set.exerciseName ?? ""));
  if (bike) {
    const rows = exercises.filter((exercise) => isBikeIntervalName(exercise.name ?? ""));
    const sum = prescribedSetTotal(rows);
    if (sum > 0) return sum;
  }
  const logged = new Set(
    session.sets
      .map((set) => (set.exerciseName ?? "").trim().toLowerCase())
      .filter((name) => name.length > 0),
  );
  const rows = exercises.filter((exercise) => logged.has((exercise.name ?? "").trim().toLowerCase()));
  return prescribedSetTotal(rows);
}

function progressCount(ticked: number, planned: number, unit: "sets" | "rounds") {
  const noun = unit === "rounds" ? "rounds" : "sets";
  if (planned > 0) return `${ticked}/${planned} ${noun}`;
  const count = Math.max(0, ticked);
  if (unit === "rounds") return `${count} ${count === 1 ? "round" : "rounds"}`;
  return `${count} ${count === 1 ? "set" : "sets"}`;
}

function progressText(ticked: number, planned: number, done: boolean, unit: "sets" | "rounds") {
  if (ticked <= 0 && planned <= 0) return "Partial";
  return `${progressCount(ticked, planned, unit)} · ${done ? "Done" : "Partial"}`;
}

function countsAsRoundSet(set: ProgressSet) {
  const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName ?? "" });
  if (mode === "timed_round" || isBikeIntervalName(set.exerciseName ?? "")) return true;
  const key = set.prescriptionKey ?? "";
  return key.startsWith("round:") || key === "bagwork";
}

function normName(name: string) {
  return name.trim().toLowerCase();
}

/** Lift sets and bag rounds on one log. "5/5 sets · 3/3 rounds · Done". */
function mixedProgressText(
  session: ProgressSession,
  exercises: { name?: string | null; sets?: number | null }[],
  done: boolean,
) {
  const roundNames = new Set(
    session.sets
      .filter((set) => countsAsRoundSet(set))
      .map((set) => normName(set.exerciseName ?? ""))
      .filter((name) => name.length > 0),
  );
  const liftLogged = session.sets.some((set) => setIsTicked(set) && !countsAsRoundSet(set));
  const roundsLogged = session.sets.some((set) => setIsTicked(set) && countsAsRoundSet(set));
  if (!liftLogged || !roundsLogged) return null;
  const rows = exerciseSetProgress(exercises, session.sets);
  const roundRow = (name: string) => {
    const key = normName(name);
    if (roundNames.has(key)) return true;
    if (isBikeIntervalName(name)) return true;
    return resolveLogMode({ name }) === "timed_round";
  };
  let setsTicked = 0;
  let setsPlanned = 0;
  let roundsTicked = 0;
  let roundsPlanned = 0;
  for (const row of rows) {
    if (roundRow(row.name)) {
      roundsTicked += row.ticked;
      roundsPlanned += row.planned;
    } else {
      setsTicked += row.ticked;
      setsPlanned += row.planned;
    }
  }
  if (setsTicked <= 0 || roundsTicked <= 0) return null;
  const setsTarget = Math.max(setsPlanned, setsTicked);
  const roundsTarget = Math.max(roundsPlanned, roundsTicked);
  return `${setsTicked}/${setsTarget} sets · ${roundsTicked}/${roundsTarget} rounds · ${done ? "Done" : "Partial"}`;
}

export function sessionProgress(session: ProgressSession, dose?: ProgressDose | null): SessionProgress {
  const ticked = tickedSetCount(session.sets);
  const programExercises = [...(dose?.exercises ?? session.programDay?.exercises ?? [])];
  const scaledDose = dose && typeof dose.dose === "number" && dose.dose > 0 ? Math.round(dose.dose) : 0;
  const catalogDose = prescribedSetTotal(programExercises);
  const hasProgram = Boolean(session.programDayId) || programExercises.length > 0 || scaledDose > 0;
  const stored = storedPlan(session);

  let planned = 0;
  let rows: ExerciseSetProgress[] = [];

  if (roundOrBikeSession(session)) {
    const fromPlan = roundPlanFromExercises(session, programExercises) || (catalogDose > 0 && programExercises.length === 1 ? catalogDose : 0);
    planned =
      stored > ticked
        ? stored
        : fromPlan > stored
          ? fromPlan
          : stored || fromPlan || Math.max(ticked, session.sets.length);
    const name =
      session.sets.find((set) => set.completed && (set.exerciseName ?? "").trim())?.exerciseName?.trim() ||
      session.sets[0]?.exerciseName?.trim() ||
      "Rounds";
    const rowPlanned = planned > 0 ? planned : ticked;
    rows = [
      {
        name,
        ticked,
        planned: rowPlanned,
        state: ticked <= 0 ? "open" : planned > 0 && ticked >= planned ? "complete" : "partial",
      },
    ];
  } else if (hasProgram) {
    planned = scaledDose > 0 ? scaledDose : catalogDose > 0 ? catalogDose : Math.max(ticked, session.sets.length);
    rows = exerciseSetProgress(programExercises, session.sets);
  } else {
    const rowCount = Math.max(session.sets.length, ticked);
    planned = stored > 0 ? stored : rowCount;
    rows = exerciseSetProgress([], session.sets);
  }

  const names = planNames(dose, programExercises);
  const done =
    ticked > 0 &&
    planned > 0 &&
    ticked >= planned &&
    (names.length === 0 || namesAreCovered(session, names) || session.sets.every((set) => setIsTicked(set)));
  const unit = roundOrBikeSession(session) ? "rounds" : "sets";
  const mixed = mixedProgressText(session, programExercises, done);
  return {
    ticked,
    planned,
    done,
    text: mixed ?? progressText(ticked, planned, done, unit),
    rows,
  };
}

/** History row. */
export function historySessionText(session: ProgressSession, dose?: ProgressDose | null) {
  return sessionProgress(session, dose).text;
}

/** Calendar card count and status. */
export function calendarSessionText(session: ProgressSession, dose?: ProgressDose | null) {
  return sessionProgress(session, dose).text;
}

/** Finish-screen label. */
export function finishSessionText(session: ProgressSession, dose?: ProgressDose | null) {
  return sessionProgress(session, dose).text;
}
