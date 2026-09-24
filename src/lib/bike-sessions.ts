/**
 * Assault / air bike rotation for Core Tue + Thu.
 * Six sessions: existing 15/15 plus five MMA-coach protocols.
 * pickBikeSessionForPlan(weekday, weekIndex) is the planner hook.
 */

export const BIKE_PROGRAM_DAY_NUMBER = 4;
export const BIKE_ROTATION_LENGTH = 3;

export type ScaleBand = "beginner" | "intermediate" | "advanced";

export type BikeScale = {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  sets: number;
  restBetweenSetsSeconds: number;
  loadText: string;
};

export type BikeSession = {
  id: string;
  /** Program-exercise name. Must match DEMO_FORM_VIDEOS. */
  name: string;
  title: string;
  focus: string;
  weekStripLabel: "Bike";
  programDayNumber: number;
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  restBetweenSetsSeconds: number;
  sets: number;
  loadText: string;
  notes: string;
  svgScaling: boolean;
  scale: Record<ScaleBand, BikeScale>;
};

const TIMED_NO_LBS = "Timed — no lbs or reps";
const SPRINT_NO_LBS = "All-out sprint / easy — no lbs";
const TEMPO_NO_LBS = "70–75% effort — no lbs";
const STEADY_NO_LBS = "Steady HR 130–150 — no lbs";
const SUBMAX_NO_LBS = "75% max watts — no lbs";

function intervalScale(
  work: number,
  rest: number,
  rounds: number,
  sets: number,
  restBetween: number,
  loadText: string,
): BikeScale {
  return {
    workSeconds: work,
    restSeconds: rest,
    roundsPerSet: rounds,
    sets,
    restBetweenSetsSeconds: restBetween,
    loadText,
  };
}

export const BIKE_SESSIONS: BikeSession[] = [
  {
    id: "intervals-15-15",
    name: "Assault bike intervals",
    title: "Day 4 — Assault bike",
    focus: "Assault bike intervals — 15s sprint / 15s rest",
    weekStripLabel: "Bike",
    programDayNumber: 4,
    workSeconds: 15,
    restSeconds: 15,
    roundsPerSet: 8,
    restBetweenSetsSeconds: 60,
    sets: 3,
    loadText: SPRINT_NO_LBS,
    svgScaling: false,
    notes:
      "Warm up 3–5 min easy spin. Then 15 seconds all-out / 15 seconds rest × 8 = 1 set. Rest 1 minute between sets. Cool down 3–5 min easy spin. Timed work only — no reps or lbs.",
    scale: {
      beginner: intervalScale(15, 15, 8, 3, 60, SPRINT_NO_LBS),
      intermediate: intervalScale(15, 15, 8, 4, 60, SPRINT_NO_LBS),
      advanced: intervalScale(15, 15, 8, 5, 60, SPRINT_NO_LBS),
    },
  },
  {
    id: "daru-alactic",
    name: "Daru alactic power bike",
    title: "Day 5 — Daru Alactic Power",
    focus: "Alactic power — 10s all-out / 50s easy",
    weekStripLabel: "Bike",
    programDayNumber: 5,
    workSeconds: 10,
    restSeconds: 50,
    roundsPerSet: 3,
    restBetweenSetsSeconds: 0,
    sets: 1,
    loadText: SPRINT_NO_LBS,
    svgScaling: true,
    notes:
      "Phil Daru / Daru Strong method (not an SVG program, no endorsement). 10s all-out / 50s easy pedaling. SVG scaling: beginner 3 / intermediate 4 / advanced 5 rounds as one block. True all-out quality — stop if power collapses. Timed only.",
    scale: {
      beginner: intervalScale(10, 50, 3, 1, 0, SPRINT_NO_LBS),
      intermediate: intervalScale(10, 50, 4, 1, 0, SPRINT_NO_LBS),
      advanced: intervalScale(10, 50, 5, 1, 0, SPRINT_NO_LBS),
    },
  },
  {
    id: "jamieson-tempo",
    name: "Jamieson tempo bike",
    title: "Day 6 — Jamieson Tempo Bike",
    focus: "Tempo — 12–15s at ~70–75% / 60s rest",
    weekStripLabel: "Bike",
    programDayNumber: 6,
    workSeconds: 12,
    restSeconds: 60,
    roundsPerSet: 8,
    restBetweenSetsSeconds: 0,
    sets: 1,
    loadText: TEMPO_NO_LBS,
    svgScaling: true,
    notes:
      "Joel Jamieson / 8weeksout tempo (adapted to air bike). Not an SVG program, no endorsement. Keep intensity ≤75% — not all-out. SVG scaling: beginner 8×12s / intermediate 12×12s / advanced 15×15s, each with 60s rest. Timed only.",
    scale: {
      beginner: intervalScale(12, 60, 8, 1, 0, TEMPO_NO_LBS),
      intermediate: intervalScale(12, 60, 12, 1, 0, TEMPO_NO_LBS),
      advanced: intervalScale(15, 60, 15, 1, 0, TEMPO_NO_LBS),
    },
  },
  {
    id: "daru-75-endurance",
    name: "Daru 75% endurance bike",
    title: "Day 7 — Daru 75% Endurance",
    focus: "Submax watt repeats on a 15–40 min clock",
    weekStripLabel: "Bike",
    programDayNumber: 7,
    workSeconds: 13 * 60,
    restSeconds: 0,
    roundsPerSet: 1,
    restBetweenSetsSeconds: 0,
    sets: 1,
    loadText: SUBMAX_NO_LBS,
    svgScaling: true,
    notes:
      "Phil Daru / Daru Strong 75% max-watt endurance (not an SVG program, no endorsement). Find a short max-watt effort, then repeat ~75% bursts with easy spin until ~80% recovered. SVG scaling is the main clock: beginner 13 min / intermediate 20 min / advanced 25 min. Stop if watts or form fail. One work-block timer. Timed only.",
    scale: {
      beginner: intervalScale(13 * 60, 0, 1, 1, 0, SUBMAX_NO_LBS),
      intermediate: intervalScale(20 * 60, 0, 1, 1, 0, SUBMAX_NO_LBS),
      advanced: intervalScale(25 * 60, 0, 1, 1, 0, SUBMAX_NO_LBS),
    },
  },
  {
    id: "jamieson-cardiac",
    name: "Jamieson cardiac output bike",
    title: "Day 8 — Jamieson Cardiac Output",
    focus: "Cardiac output — 20–40 min steady at HR 130–150",
    weekStripLabel: "Bike",
    programDayNumber: 8,
    workSeconds: 22 * 60,
    restSeconds: 0,
    roundsPerSet: 1,
    restBetweenSetsSeconds: 0,
    sets: 1,
    loadText: STEADY_NO_LBS,
    svgScaling: true,
    notes:
      "Joel Jamieson / 8weeksout cardiac output (not an SVG program, no endorsement). Easy–moderate steady spin, HR about 130–150. Conversational / nasal if you can. SVG scaling: beginner 22 min / intermediate 30 min / advanced 35 min. One work-block timer. Timed only.",
    scale: {
      beginner: intervalScale(22 * 60, 0, 1, 1, 0, STEADY_NO_LBS),
      intermediate: intervalScale(30 * 60, 0, 1, 1, 0, STEADY_NO_LBS),
      advanced: intervalScale(35 * 60, 0, 1, 1, 0, STEADY_NO_LBS),
    },
  },
  {
    id: "edwards-10-20",
    name: "Leon Edwards 10/20 bike finisher",
    title: "Day 9 — Leon Edwards 10/20",
    focus: "Finisher — 10s sprint / 20s rest × 3–5",
    weekStripLabel: "Bike",
    programDayNumber: 9,
    workSeconds: 10,
    restSeconds: 20,
    roundsPerSet: 3,
    restBetweenSetsSeconds: 0,
    sets: 1,
    loadText: SPRINT_NO_LBS,
    svgScaling: true,
    notes:
      "Leon Edwards athlete-shared finisher (not an SVG program, no endorsement). 10s sprints / 20s rest. SVG scaling: beginner 3 / intermediate 4 / advanced 5 rounds as one block. Timed only.",
    scale: {
      beginner: intervalScale(10, 20, 3, 1, 0, SPRINT_NO_LBS),
      intermediate: intervalScale(10, 20, 4, 1, 0, SPRINT_NO_LBS),
      advanced: intervalScale(10, 20, 5, 1, 0, SPRINT_NO_LBS),
    },
  },
];

export const DEFAULT_BIKE_SESSION = BIKE_SESSIONS[0];

const ROTATION: Array<{ tue: string; thu: string }> = [
  { tue: "intervals-15-15", thu: "daru-75-endurance" },
  { tue: "daru-alactic", thu: "jamieson-tempo" },
  { tue: "jamieson-cardiac", thu: "edwards-10-20" },
];

/** Monday-based week index from a fixed epoch so Tue/Thu pairings stay stable. */
export function bikeWeekIndex(date: Date) {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = cursor.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  cursor.setDate(cursor.getDate() + mondayOffset);
  const epoch = new Date(2026, 0, 5);
  const diff = cursor.getTime() - epoch.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

export function pickBikeSession(index = 0): BikeSession {
  return BIKE_SESSIONS[index % BIKE_SESSIONS.length] ?? DEFAULT_BIKE_SESSION;
}

export function pickBikeSessionForPlan(
  weekday: "Tuesday" | "Thursday",
  weekIndex = 0,
): BikeSession {
  const pair = ROTATION[((weekIndex % BIKE_ROTATION_LENGTH) + BIKE_ROTATION_LENGTH) % BIKE_ROTATION_LENGTH];
  const id = weekday === "Tuesday" ? pair.tue : pair.thu;
  return BIKE_SESSIONS.find((session) => session.id === id) ?? DEFAULT_BIKE_SESSION;
}

/** Jump-rope “easy bike” finishers stay on Friday — they are not this catalog. */
export function isBikeIntervalName(name: string) {
  if (/\beasy bike\b/i.test(name) || /\bjump rope\b/i.test(name)) return false;
  if (BIKE_SESSIONS.some((session) => session.name === name)) return true;
  return (
    /\b(assault bike|air bike|echo bike)\b/i.test(name) ||
    (/\bbike\b/i.test(name) &&
      /\b(intervals?|alactic|tempo|endurance|cardiac|finisher)\b/i.test(name))
  );
}

export function bikeSessionForName(name: string): BikeSession | null {
  return (
    BIKE_SESSIONS.find((session) => session.name === name) ??
    (isBikeIntervalName(name) ? DEFAULT_BIKE_SESSION : null)
  );
}

export function scaleBikeSession(session: BikeSession, band: ScaleBand): BikeSession {
  const scaled = session.scale[band];
  return {
    ...session,
    workSeconds: scaled.workSeconds,
    restSeconds: scaled.restSeconds,
    roundsPerSet: scaled.roundsPerSet,
    restBetweenSetsSeconds: scaled.restBetweenSetsSeconds,
    sets: scaled.sets,
    loadText: scaled.loadText,
  };
}

export function bikeSetsForBand(band: ScaleBand) {
  if (band === "advanced") return 5;
  if (band === "intermediate") return 4;
  return 3;
}

export function formatBikeClock(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function bikeIntervalReps(session: BikeSession = DEFAULT_BIKE_SESSION) {
  if (session.restSeconds <= 0 && session.roundsPerSet === 1) {
    return formatBikeClock(session.workSeconds);
  }
  if (session.restSeconds <= 0) {
    return `${session.workSeconds}s work × ${session.roundsPerSet}`;
  }
  return `${session.workSeconds}s work / ${session.restSeconds}s rest × ${session.roundsPerSet}`;
}

export function parseBikeIntervalReps(reps: string): {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
} | null {
  const interval = reps.match(/(\d+)\s*s\s*work\s*\/\s*(\d+)\s*s\s*rest\s*×\s*(\d+)/i);
  if (interval) {
    return {
      workSeconds: Number(interval[1]),
      restSeconds: Number(interval[2]),
      roundsPerSet: Number(interval[3]),
    };
  }
  const workOnly = reps.match(/(\d+)\s*s\s*work\s*×\s*(\d+)/i);
  if (workOnly) {
    return {
      workSeconds: Number(workOnly[1]),
      restSeconds: 0,
      roundsPerSet: Number(workOnly[2]),
    };
  }
  const clock = reps.match(/(\d+)\s*:\s*(\d{2})/);
  if (clock) {
    return {
      workSeconds: Number(clock[1]) * 60 + Number(clock[2]),
      restSeconds: 0,
      roundsPerSet: 1,
    };
  }
  return null;
}

export function bikeSessionForLogger(
  name: string,
  planned?: { reps?: string; restSeconds?: number } | null,
): BikeSession | null {
  const base = bikeSessionForName(name);
  if (!base) return null;
  const parsed = planned?.reps ? parseBikeIntervalReps(planned.reps) : null;
  return {
    ...base,
    ...(parsed ?? {}),
    restBetweenSetsSeconds: planned?.restSeconds ?? base.restBetweenSetsSeconds,
  };
}

/** Work+rest per set for estimates. Rest=0 clocks are work only. */
export function bikeWorkSecondsPerSet(session: BikeSession = DEFAULT_BIKE_SESSION) {
  if (session.restSeconds <= 0) {
    return session.roundsPerSet * session.workSeconds;
  }
  return session.roundsPerSet * (session.workSeconds + session.restSeconds);
}

export function bikeIntervalChrome(session: BikeSession = DEFAULT_BIKE_SESSION) {
  if (session.restSeconds <= 0 && session.roundsPerSet === 1) {
    return `${formatBikeClock(session.workSeconds)} work block`;
  }
  if (session.restSeconds <= 0) {
    return `${session.roundsPerSet} × ${session.workSeconds}s work`;
  }
  return `${session.roundsPerSet} × ${session.workSeconds}s work / ${session.restSeconds}s rest`;
}

export function isLongBikeClock(session: BikeSession) {
  return session.restSeconds <= 0 && session.roundsPerSet === 1;
}
