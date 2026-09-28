import {
  BAG_REST_SECONDS,
  BAG_ROUND_COUNTS,
  BAG_ROUND_SECONDS,
} from "@/lib/bag-sessions";
import {
  bikeIntervalReps,
  bikeSessionForLogger,
  bikeSessionForName,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
  scaleBikeSession,
} from "@/lib/bike-sessions";
import { daruExerciseForName } from "@/lib/daru-exercises";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import {
  formatClock,
  isDurationMode,
  parseDurationSeconds,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";

export type ScaleBand = "beginner" | "intermediate" | "advanced";

export type ScalePrefs = {
  experienceLevel?: string | null;
  competitionStatus?: string | null;
};

export type ScaleableExercise = {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode?: string;
  notes?: string;
};

/**
 * Skill-day round length (seconds) by DEMO Combat Skills dayNumber.
 * Bag days 1–5 use level-scaled bag minutes (beginner ~30, intermediate ~35–40, advanced ~45).
 * Day 6 (optional Saturday / open skill) keeps longer grappling-style clocks.
 */
export const SKILL_ROUND_SECONDS: Record<ScaleBand, Record<number, number>> = {
  beginner: {
    1: BAG_ROUND_SECONDS.beginner,
    2: BAG_ROUND_SECONDS.beginner,
    3: BAG_ROUND_SECONDS.beginner,
    4: BAG_ROUND_SECONDS.beginner,
    5: BAG_ROUND_SECONDS.beginner,
    6: 150,
  },
  intermediate: {
    1: BAG_ROUND_SECONDS.intermediate,
    2: BAG_ROUND_SECONDS.intermediate,
    3: BAG_ROUND_SECONDS.intermediate,
    4: BAG_ROUND_SECONDS.intermediate,
    5: BAG_ROUND_SECONDS.intermediate,
    6: 180,
  },
  advanced: {
    1: BAG_ROUND_SECONDS.advanced,
    2: BAG_ROUND_SECONDS.advanced,
    3: BAG_ROUND_SECONDS.advanced,
    4: BAG_ROUND_SECONDS.advanced,
    5: BAG_ROUND_SECONDS.advanced,
    6: 300,
  },
};

/** Rest between skill rounds. */
export const SKILL_REST_SECONDS: Record<ScaleBand, Record<number, number>> = {
  beginner: {
    1: BAG_REST_SECONDS.beginner,
    2: BAG_REST_SECONDS.beginner,
    3: BAG_REST_SECONDS.beginner,
    4: BAG_REST_SECONDS.beginner,
    5: BAG_REST_SECONDS.beginner,
    6: 90,
  },
  intermediate: {
    1: BAG_REST_SECONDS.intermediate,
    2: BAG_REST_SECONDS.intermediate,
    3: BAG_REST_SECONDS.intermediate,
    4: BAG_REST_SECONDS.intermediate,
    5: BAG_REST_SECONDS.intermediate,
    6: 60,
  },
  advanced: {
    1: BAG_REST_SECONDS.advanced,
    2: BAG_REST_SECONDS.advanced,
    3: BAG_REST_SECONDS.advanced,
    4: BAG_REST_SECONDS.advanced,
    5: BAG_REST_SECONDS.advanced,
    6: 45,
  },
};

export const SKILL_ROUND_COUNTS: Record<ScaleBand, Record<number, number>> = {
  beginner: {
    1: BAG_ROUND_COUNTS.beginner,
    2: BAG_ROUND_COUNTS.beginner,
    3: BAG_ROUND_COUNTS.beginner,
    4: BAG_ROUND_COUNTS.beginner,
    5: BAG_ROUND_COUNTS.beginner,
    6: 3,
  },
  intermediate: {
    1: BAG_ROUND_COUNTS.intermediate,
    2: BAG_ROUND_COUNTS.intermediate,
    3: BAG_ROUND_COUNTS.intermediate,
    4: BAG_ROUND_COUNTS.intermediate,
    5: BAG_ROUND_COUNTS.intermediate,
    6: 3,
  },
  advanced: {
    1: BAG_ROUND_COUNTS.advanced,
    2: BAG_ROUND_COUNTS.advanced,
    3: BAG_ROUND_COUNTS.advanced,
    4: BAG_ROUND_COUNTS.advanced,
    5: BAG_ROUND_COUNTS.advanced,
    6: 4,
  },
};

const STRENGTH_REST: Record<ScaleBand, number> = {
  beginner: 90,
  intermediate: 60,
  advanced: 45,
};

const HARD_STRENGTH: Record<string, Partial<ScaleableExercise>> = {
  "Goblet squat": {
    sets: 4,
    reps: "8–10",
    loadText: "Heavy — last 2 reps grind but stay clean",
  },
  "Romanian deadlift": {
    sets: 4,
    reps: "8",
    loadText: "Heavy hinge — flat back",
  },
  "Reverse lunge": {
    sets: 4,
    reps: "10 / leg",
    loadText: "Loaded if you have bells",
  },
  "Squat jump or box step-up": {
    sets: 4,
    reps: "6",
    loadText: "Crisp landings",
  },
  "Front plank": {
    sets: 4,
    reps: "45–60 sec",
    loadText: "Hold — no weight",
    restSeconds: 30,
  },
  "Push-up or dumbbell bench press": {
    sets: 4,
    reps: "8–10",
    loadText: "Heavy or hard variation",
  },
  "One-arm row": {
    sets: 4,
    reps: "8 / side",
    loadText: "Heavy dumbbell or band",
  },
  "Overhead press": {
    sets: 4,
    reps: "6–8",
    loadText: "Heavy, lockout clean",
  },
  "Band pull-apart or face pull": {
    sets: 4,
    reps: "15",
    loadText: "Strong band, full squeeze",
  },
  "Farmer carry": {
    sets: 4,
    reps: "40–50 sec",
    loadText: "Heavy — walk tall",
    restSeconds: 45,
  },
  "Kettlebell swing or hip hinge": {
    sets: 5,
    reps: "12",
    loadText: "Hard, crisp snaps",
  },
  "Chin-up, band-assist, or lat pulldown": {
    sets: 4,
    reps: "6–10",
    loadText: "Add load if 8+ are easy",
  },
  "Lateral bound or side step-over": {
    sets: 4,
    reps: "6 / side",
    loadText: "Cover more ground",
  },
  "Jump rope or easy bike intervals": {
    sets: 10,
    reps: "25 sec on / 35 sec easy",
    loadText: "Hard but repeatable",
    restSeconds: 0,
  },
  "Side plank": {
    sets: 4,
    reps: "30–45 sec / side",
    loadText: "Hold — no weight",
    restSeconds: 30,
  },
};

export function scaleBandFromPrefs(prefs?: ScalePrefs | null): ScaleBand {
  const experience = prefs?.experienceLevel ?? "";
  const competition = prefs?.competitionStatus ?? "";
  if (experience === "advanced" || competition === "pro") return "advanced";
  if (competition === "amateur" && experience !== "beginner") return "advanced";
  if (experience === "beginner") return "beginner";
  // Unset profile level defaults to intermediate (clear toggle still available on Train).
  return "intermediate";
}

export function scaleCopy(band: ScaleBand) {
  if (band === "advanced") return "Scaled for advanced / competition";
  if (band === "intermediate") return "Scaled for intermediate";
  return "DEMO Core — beginner pacing";
}

export function isHardStrengthBand(band: ScaleBand) {
  return band === "advanced";
}

function skillRoundSeconds(band: ScaleBand, dayNumber: number) {
  return SKILL_ROUND_SECONDS[band][dayNumber] ?? SKILL_ROUND_SECONDS[band][1];
}

function skillRestSeconds(band: ScaleBand, dayNumber: number) {
  return SKILL_REST_SECONDS[band][dayNumber] ?? SKILL_REST_SECONDS[band][1];
}

export function scaleExercise(
  exercise: ScaleableExercise,
  input: { band: ScaleBand; programSlug?: string; dayNumber?: number },
): ScaleableExercise {
  const mode = resolveLogMode(exercise);
  const slug = input.programSlug ?? "";
  const dayNumber = input.dayNumber ?? 1;
  const band = input.band;

  if (isBikeIntervalName(exercise.name)) {
    return scaleBikeInterval(exercise, band);
  }

  if (slug === DEMO_SKILL_PROGRAM_SLUG || slug === "skill") {
    if (mode === "timed_round") {
      const seconds = skillRoundSeconds(band, dayNumber);
      const rounds =
        SKILL_ROUND_COUNTS[band][dayNumber] ??
        (band === "beginner" ? 7 : band === "advanced" ? 10 : 8);
      const isBagBlock = /\bbag rounds?\b/i.test(exercise.name);
      return {
        ...exercise,
        logMode: mode,
        sets: isBagBlock
          ? rounds
          : Math.max(exercise.sets, band === "beginner" ? 3 : band === "advanced" ? 4 : 3),
        reps: formatClock(seconds),
        restSeconds: skillRestSeconds(band, dayNumber),
        loadText:
          band === "beginner"
            ? exercise.loadText
            : `${exercise.loadText} · fight pace`,
      };
    }
    if (mode === "timed" && isHoldOrIntervalName(exercise.name)) {
      return scaleHoldOrInterval(exercise, band, mode);
    }
  }

  if (slug === DEMO_PROGRAM_SLUG || slug === "strength") {
    return scaleStrengthExercise(exercise, band, mode);
  }

  if (mode === "load_timed") {
    return scaleLoadedCarry(exercise, band, mode, restForBand(exercise.restSeconds, band));
  }

  if (mode === "timed" || mode === "timed_round") {
    return scaleHoldOrInterval(exercise, band, mode);
  }

  return { ...exercise, logMode: mode, restSeconds: restForBand(exercise.restSeconds, band) };
}

function scaleBikeInterval(exercise: ScaleableExercise, band: ScaleBand): ScaleableExercise {
  const session = bikeSessionForName(exercise.name);
  const scaled = session ? scaleBikeSession(session, band) : null;
  return {
    ...exercise,
    logMode: "timed_round",
    sets: scaled?.sets ?? exercise.sets,
    reps: scaled ? bikeIntervalReps(scaled) : exercise.reps,
    restSeconds: scaled?.restBetweenSetsSeconds ?? 60,
    loadText: scaled?.loadText ?? "Timed — no lbs or reps",
  };
}

function isHoldOrIntervalName(name: string) {
  return /\b(plank|jump rope|easy bike|interval|hollow|dead hang|wall sit)\b/i.test(name);
}

function scaleHoldOrInterval(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
): ScaleableExercise {
  if (/\bplank\b/i.test(exercise.name)) {
    if (band === "advanced") {
      return {
        ...exercise,
        logMode: mode,
        sets: 4,
        reps: /side/i.test(exercise.reps) ? "30–45 sec / side" : "45–60 sec",
        loadText: "Hold — no weight",
        restSeconds: 30,
      };
    }
    if (band === "intermediate") {
      return {
        ...exercise,
        logMode: mode,
        restSeconds: 45,
        loadText: "Hold — no weight",
      };
    }
    return {
      ...exercise,
      logMode: mode,
      restSeconds: Math.max(exercise.restSeconds, 60),
      loadText: "Hold — no weight",
    };
  }
  if (/\b(jump rope|easy bike|interval)\b/i.test(exercise.name) && band === "advanced") {
    return {
      ...exercise,
      logMode: mode,
      sets: Math.max(exercise.sets, 10),
      reps: "25 sec on / 35 sec easy",
      restSeconds: 0,
    };
  }
  return { ...exercise, logMode: mode };
}

function scaleLoadedCarry(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
  rest: number,
): ScaleableExercise {
  if (band === "advanced") {
    return {
      ...exercise,
      logMode: mode,
      sets: Math.max(exercise.sets, 4),
      reps: "40–50 sec",
      loadText: "Heavy — walk tall",
      restSeconds: 45,
    };
  }
  if (band === "intermediate") {
    return {
      ...exercise,
      logMode: mode,
      reps: "35–45 sec",
      loadText: exercise.loadText || "Heavy for you, walk tall",
      restSeconds: rest,
    };
  }
  return {
    ...exercise,
    logMode: mode,
    reps: "30–40 sec",
    restSeconds: Math.max(rest, 75),
  };
}

function scaleStrengthExercise(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
): ScaleableExercise {
  const daru = daruExerciseForName(exercise.name);
  if (daru) {
    const scaled = daru.scale[band];
    return {
      ...exercise,
      logMode: daru.logMode,
      sets: scaled.sets,
      reps: scaled.reps,
      restSeconds: scaled.restSeconds,
      loadText: scaled.loadText,
    };
  }
  const rest = restForBand(exercise.restSeconds, band);
  if (mode === "load_timed") {
    return scaleLoadedCarry(exercise, band, mode, rest);
  }
  if (band !== "advanced") {
    const hold = mode === "timed" ? { loadText: "Hold — no weight" } : {};
    return { ...exercise, logMode: mode, restSeconds: rest, ...hold };
  }
  const override = HARD_STRENGTH[exercise.name];
  return {
    ...exercise,
    logMode: mode,
    restSeconds: override?.restSeconds ?? rest,
    sets: override?.sets ?? Math.min(exercise.sets + 1, 5),
    reps: override?.reps ?? exercise.reps,
    loadText: override?.loadText ?? harderLoadText(exercise.loadText),
  };
}

function restForBand(seedRest: number, band: ScaleBand) {
  if (seedRest <= 0) return 0;
  if (band === "advanced") return Math.min(STRENGTH_REST.advanced, Math.max(30, seedRest - 45));
  if (band === "intermediate") return Math.min(STRENGTH_REST.intermediate, Math.max(45, seedRest - 15));
  return Math.max(seedRest, 75);
}

function harderLoadText(text: string) {
  if (/hold/i.test(text)) return "Hold — no weight";
  return text.replace(/moderate/i, "Heavy").replace(/light/i, "Challenging");
}

export function scaleExercises<T extends ScaleableExercise>(
  exercises: T[],
  input: { band: ScaleBand; programSlug?: string; dayNumber?: number },
): T[] {
  return exercises.map((exercise) => ({ ...exercise, ...scaleExercise(exercise, input) }));
}

export function scaleProgramDay<T extends { dayNumber: number; focus: string; exercises: ScaleableExercise[] }>(
  day: T,
  input: { band: ScaleBand; programSlug?: string },
): T {
  const exercises = scaleExercises(day.exercises, {
    band: input.band,
    programSlug: input.programSlug,
    dayNumber: day.dayNumber,
  });
  const note = scaleCopy(input.band);
  const focus = day.focus.includes("Scaled") || day.focus.includes("DEMO Core")
    ? day.focus
    : `${day.focus} · ${note}`;
  return { ...day, exercises, focus };
}

export function scaleDemoCatalog<
  T extends {
    strength?: { slug?: string; days: Array<{ dayNumber: number; focus: string; exercises: ScaleableExercise[] }> } | null;
    skill?: { slug?: string; days: Array<{ dayNumber: number; focus: string; exercises: ScaleableExercise[] }> } | null;
  },
>(catalog: T, prefs?: ScalePrefs | null): T {
  const band = scaleBandFromPrefs(prefs);
  return {
    ...catalog,
    strength: catalog.strength
      ? {
          ...catalog.strength,
          days: catalog.strength.days.map((day) =>
            scaleProgramDay(day, { band, programSlug: DEMO_PROGRAM_SLUG }),
          ),
        }
      : catalog.strength,
    skill: catalog.skill
      ? {
          ...catalog.skill,
          days: catalog.skill.days.map((day) =>
            scaleProgramDay(day, { band, programSlug: DEMO_SKILL_PROGRAM_SLUG }),
          ),
        }
      : catalog.skill,
  };
}

export function plannedDurationSeconds(exercise: ScaleableExercise): number | null {
  if (isBikeIntervalName(exercise.name)) return null;
  const mode = resolveLogMode(exercise);
  if (!isDurationMode(mode)) return null;
  return parseDurationSeconds(exercise.reps);
}

export function plannedWorkSeconds(exercise: ScaleableExercise): number | null {
  if (isBikeIntervalName(exercise.name)) {
    const session = bikeSessionForLogger(exercise.name, exercise);
    return session ? bikeWorkSecondsPerSet(session) : null;
  }
  return plannedDurationSeconds(exercise);
}
