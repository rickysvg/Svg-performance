/**
 * Assault / air bike rotation for Core Tue + Thu.
 * Six sessions: existing 15/15 plus five MMA-coach protocols.
 * pickBikeSessionForPlan(weekday, weekIndex) is the planner hook.
 */

import type { BikeIntervalPattern, BikeIntervalStep } from "@/lib/bike-interval-timer";
import { APP_TIMEZONE, mondayOfZoned, zonedCivilToUtc } from "@/lib/timezone";

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

export type BikeEnergyZone = "aerobic-base" | "threshold" | "sprint";

export type BikeSession = {
  id: string;
  energyZone: BikeEnergyZone;
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
  /** Set when a member replaces today's bike with a chooser workout. */
  warmupSeconds?: number;
  cooldownSeconds?: number;
  blocks?: number;
  restBetweenBlocksSeconds?: number;
  pattern?: BikeIntervalPattern;
  ladder?: readonly BikeIntervalStep[];
  chooserLabel?: string;
};

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
    energyZone: "sprint",
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
      "Warm up 3–5 min easy spin. Then 15 seconds all-out / 15 seconds rest × 8 = 1 round. Rest 1 minute between rounds. Cool down 3–5 min easy spin. Timed work only — no reps or lbs.",
    scale: {
      beginner: intervalScale(15, 15, 8, 3, 60, SPRINT_NO_LBS),
      intermediate: intervalScale(15, 15, 8, 4, 60, SPRINT_NO_LBS),
      advanced: intervalScale(15, 15, 8, 5, 60, SPRINT_NO_LBS),
    },
  },
  {
    id: "daru-alactic",
    energyZone: "sprint",
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
    energyZone: "threshold",
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
    energyZone: "threshold",
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
    energyZone: "aerobic-base",
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
    energyZone: "sprint",
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
  {
    id: "fight-pace",
    energyZone: "sprint",
    name: "Fight-pace bike rounds",
    title: "Day 22 — Fight-pace bike",
    focus: "Fight-pace rounds — 10s sprint, then moderate, inside a 5 min round",
    weekStripLabel: "Bike",
    programDayNumber: 22,
    workSeconds: 10,
    restSeconds: 40,
    roundsPerSet: 5,
    restBetweenSetsSeconds: 60,
    sets: 3,
    loadText: "10s sprint, then moderate — no lbs",
    svgScaling: false,
    notes:
      "Camp build and peak Sunday. 3 rounds × 5 min, 1 min between rounds. Each minute is a 10s sprint and then 20–40s moderate, a 1:2 to 1:4 work-to-easy ratio. Timed only.",
    scale: {
      beginner: intervalScale(10, 40, 5, 3, 60, "10s sprint, then moderate — no lbs"),
      intermediate: intervalScale(10, 40, 5, 3, 60, "10s sprint, then moderate — no lbs"),
      advanced: intervalScale(10, 20, 5, 3, 60, "10s sprint, then moderate — no lbs"),
    },
  },
];

export const DEFAULT_BIKE_SESSION = BIKE_SESSIONS[0];

/**
 * Wednesday is always the alactic bike. The week dose moves 10/50 toward 10/20.
 * Sunday is cardiac, tempo, then a longer cardiac ride.
 * Build and peak camp Sundays use fight-pace instead.
 */
const SUNDAY_ROTATION = ["jamieson-cardiac", "jamieson-tempo", "jamieson-cardiac"] as const;

/** Monday-based week index from a fixed epoch so Tue/Thu pairings stay stable. */
export function bikeWeekIndex(date: Date, timeZone = APP_TIMEZONE) {
  const monday = mondayOfZoned(date, timeZone);
  const epoch = zonedCivilToUtc(2026, 1, 5, timeZone);
  const days = Math.round((monday.getTime() - epoch.getTime()) / 86_400_000);
  return Math.floor(days / 7);
}

/**
 * Weeks since the member started, not since the global epoch.
 * The week they join is week 0 (Block A / Day 1), even if the calendar is in Block C.
 */
export function memberWeekIndex(date: Date, anchor: Date, timeZone = APP_TIMEZONE) {
  if (Number.isNaN(anchor.getTime())) return bikeWeekIndex(date, timeZone);
  const delta = bikeWeekIndex(date, timeZone) - bikeWeekIndex(anchor, timeZone);
  return delta > 0 ? delta : 0;
}

export function pickBikeSession(index = 0): BikeSession {
  return BIKE_SESSIONS[index % BIKE_SESSIONS.length] ?? DEFAULT_BIKE_SESSION;
}

export function pickBikeSessionForPlan(
  weekday: "Wednesday" | "Sunday",
  weekIndex = 0,
  phase?: string | null,
): BikeSession {
  if (weekday === "Sunday" && (phase === "build" || phase === "peak")) {
    return BIKE_SESSIONS.find((session) => session.id === "fight-pace") ?? DEFAULT_BIKE_SESSION;
  }
  if (weekday === "Wednesday") {
    return BIKE_SESSIONS.find((session) => session.id === "daru-alactic") ?? DEFAULT_BIKE_SESSION;
  }
  const slot = ((weekIndex % BIKE_ROTATION_LENGTH) + BIKE_ROTATION_LENGTH) % BIKE_ROTATION_LENGTH;
  const id = SUNDAY_ROTATION[slot] ?? "jamieson-cardiac";
  return BIKE_SESSIONS.find((session) => session.id === id) ?? DEFAULT_BIKE_SESSION;
}

/**
 * Week doses for the alactic, cardiac, tempo, and fight-pace bikes.
 * Other sessions keep the scale stored on the session.
 * `phase` is a camp name string so this file does not import the camp module.
 */
export function planBikeDose(
  session: BikeSession,
  band: ScaleBand,
  weekIndex = 0,
  phase?: string | null,
): BikeSession {
  const week = ((weekIndex % BIKE_ROTATION_LENGTH) + BIKE_ROTATION_LENGTH) % BIKE_ROTATION_LENGTH;
  const apply = (scale: BikeScale, notes?: string): BikeSession => ({
    ...session,
    workSeconds: scale.workSeconds,
    restSeconds: scale.restSeconds,
    roundsPerSet: scale.roundsPerSet,
    restBetweenSetsSeconds: scale.restBetweenSetsSeconds,
    sets: scale.sets,
    loadText: scale.loadText,
    notes: notes ?? session.notes,
  });

  if (phase === "taper") {
    return apply(
      intervalScale(8, 60, 4, 1, 0, "Easy spin — stop while it still feels fast"),
      "Taper. 4 × 8s easy / 60s spin. Not a lactic session.",
    );
  }

  if (session.id === "fight-pace") {
    const rest = phase === "peak" ? 20 : 40;
    return apply(
      intervalScale(10, rest, 5, 3, 60, "10s sprint, then moderate — no lbs"),
      "3 rounds × 5 min, 1 min between rounds. Each minute: 10s sprint, then 20–40s moderate.",
    );
  }

  if (session.id === "daru-alactic") {
    if (phase === "peak" || week === 2) {
      const beginner = band === "beginner";
      return apply(
        intervalScale(10, 20, beginner ? 4 : 5, beginner ? 1 : 2, beginner ? 0 : 180, SPRINT_NO_LBS),
        "Alactic week 3. 10s sprint / 20s rest. Two blocks of five, 3 min between. Beginners do one block of four.",
      );
    }
    if (week === 1) {
      const rounds = band === "beginner" ? 6 : 8;
      return apply(
        intervalScale(10, 40, rounds, 1, 0, SPRINT_NO_LBS),
        "Alactic week 2. 10s all-out / 40s easy. Quality stays high.",
      );
    }
    const rounds = band === "beginner" ? 4 : 6;
    return apply(
      intervalScale(10, 50, rounds, 1, 0, SPRINT_NO_LBS),
      "Alactic week 1. 10s all-out / 50s easy. Stop if the next sprint is slower.",
    );
  }

  if (session.id === "jamieson-cardiac") {
    const long = week === 2;
    const minutes = band === "beginner" ? (long ? 25 : 20) : long ? 40 : 30;
    return apply(
      intervalScale(minutes * 60, 0, 1, 1, 0, STEADY_NO_LBS),
      long
        ? "Aerobic week 3. Longer steady spin, still conversational."
        : "Aerobic week 1. Steady spin, heart rate about 130–150.",
    );
  }

  return scaleBikeSession(session, band);
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

export const BIKE_ZONE_CREDIT = {
  coach: "Joel Jamieson",
  url: "https://8weeksout.com/2012/09/27/metabolic-conditioning-mma/",
  idea: "aerobic base, threshold, and short power",
} as const;

/** Optional stand-in for a Sprint bike day. Not a replacement for the written bike plan. */
export const SPRINT_NO_BIKE = {
  text: "No bike? Optional: battle ropes, or a curved treadmill, for 4–8 seconds as hard as you can, then rest 40–60 seconds. Stop when the next effort slows down.",
  handle: "@neromma",
  posts: [
    {
      url: "https://www.instagram.com/neromma/reel/DdWZxV5MLsP/",
      idea: "battle ropes",
    },
    {
      url: "https://www.instagram.com/neromma/reel/DdeXQ-SsFLj/",
      idea: "curved treadmill",
    },
  ],
} as const;

const ENERGY_COPY: Record<
  BikeEnergyZone,
  { label: string; guide: string; alternative?: typeof SPRINT_NO_BIKE }
> = {
  "aerobic-base": {
    label: "Aerobic Base",
    guide:
      "Easy spin you can talk through. If you track heart rate, stay near 130–150. This is the engine that lasts past the first minute.",
  },
  threshold: {
    label: "Threshold",
    guide:
      "Hard but controlled. A short sentence is fine. A conversation is not. Stay off an all-out sprint.",
  },
  sprint: {
    label: "Sprint",
    guide:
      "Very short max efforts. Rest long enough that the next one is still fast. Stop when the speed drops.",
    alternative: SPRINT_NO_BIKE,
  },
};

export function bikeEnergyCopy(zone: BikeEnergyZone) {
  return ENERGY_COPY[zone];
}

export function bikeEnergyForSession(session: Pick<BikeSession, "energyZone">) {
  return bikeEnergyCopy(session.energyZone);
}
