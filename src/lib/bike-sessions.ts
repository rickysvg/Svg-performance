/**
 * Assault / air bike rotation for Core Tue + Thu.
 * Add more session types here as Ricky sends them — pickBikeSession(index)
 * is the only rotation hook the planner needs.
 */

export const BIKE_PROGRAM_DAY_NUMBER = 4;

export type BikeSession = {
  id: string;
  /** Program-exercise name. Must match DEMO_FORM_VIDEOS. */
  name: string;
  title: string;
  focus: string;
  weekStripLabel: "Bike";
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  restBetweenSetsSeconds: number;
  notes: string;
};

export const BIKE_SESSIONS: BikeSession[] = [
  {
    id: "intervals-15-15",
    name: "Assault bike intervals",
    title: "Day 4 — Assault bike",
    focus: "Assault bike intervals — 15s sprint / 15s rest",
    weekStripLabel: "Bike",
    workSeconds: 15,
    restSeconds: 15,
    roundsPerSet: 8,
    restBetweenSetsSeconds: 60,
    notes:
      "Warm up 3–5 min easy spin. Then 15 seconds all-out / 15 seconds rest × 8 = 1 set. Rest 1 minute between sets. Cool down 3–5 min easy spin. Timed work only — no reps or lbs.",
  },
];

export const DEFAULT_BIKE_SESSION = BIKE_SESSIONS[0];

export function pickBikeSession(index = 0): BikeSession {
  return BIKE_SESSIONS[index % BIKE_SESSIONS.length] ?? DEFAULT_BIKE_SESSION;
}

/** Jump-rope “easy bike” finishers stay on Friday — they are not this catalog. */
export function isBikeIntervalName(name: string) {
  if (/\beasy bike\b/i.test(name) || /\bjump rope\b/i.test(name)) return false;
  return (
    /\b(assault bike|air bike|echo bike)\b/i.test(name) ||
    (/\bbike\b/i.test(name) && /\bintervals?\b/i.test(name))
  );
}

export function bikeSessionForName(name: string): BikeSession | null {
  return BIKE_SESSIONS.find((session) => session.name === name) ?? (isBikeIntervalName(name) ? DEFAULT_BIKE_SESSION : null);
}

export function bikeSetsForBand(band: "beginner" | "intermediate" | "advanced") {
  if (band === "advanced") return 5;
  if (band === "intermediate") return 4;
  return 3;
}

export function bikeIntervalReps(session: BikeSession = DEFAULT_BIKE_SESSION) {
  return `${session.workSeconds}s work / ${session.restSeconds}s rest × ${session.roundsPerSet}`;
}

/** One set = 8 × (15 work + 15 rest) = 4:00. Used for estimates, not logged as reps. */
export function bikeWorkSecondsPerSet(session: BikeSession = DEFAULT_BIKE_SESSION) {
  return session.roundsPerSet * (session.workSeconds + session.restSeconds);
}

export function bikeIntervalChrome(session: BikeSession = DEFAULT_BIKE_SESSION) {
  return `${session.roundsPerSet} × ${session.workSeconds}s work / ${session.restSeconds}s rest`;
}
