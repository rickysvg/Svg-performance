import {
  bikeIntervalReps,
  bikeSessionForName,
  bikeSetsForBand,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
} from "@/lib/bike-sessions";
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
 * Power bag / GNP days stay shorter; clinch, wrestling, and BJJ run longer.
 * Beginner ~2–2.5 min. Intermediate ~2.5–3 min. Advanced / pro ~3–5 min.
 */
export const SKILL_ROUND_SECONDS: Record<ScaleBand, Record<number, number>> = {
  beginner: { 1: 120, 2: 150, 3: 120, 4: 120, 5: 150, 6: 150 },
  intermediate: { 1: 150, 2: 180, 3: 150, 4: 150, 5: 180, 6: 180 },
  advanced: { 1: 180, 2: 240, 3: 180, 4: 180, 5: 240, 6: 300 },
};

/** Rest between skill rounds. Advanced power days (1, 3, 4) use 30s. */
export const SKILL_REST_SECONDS: Record<ScaleBand, Record<number, number>> = {
  beginner: { 1: 90, 2: 90, 3: 90, 4: 90, 5: 90, 6: 90 },
  intermediate: { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 },
  advanced: { 1: 30, 2: 45, 3: 30, 4: 30, 5: 45, 6: 45 },
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
  if (experience === "intermediate") return "intermediate";
  return "beginner";
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
      return {
        ...exercise,
        logMode: mode,
        sets: Math.max(exercise.sets, band === "beginner" ? 3 : 3),
        reps: formatClock(seconds),
        restSeconds: skillRestSeconds(band, dayNumber),
        loadText: band === "beginner" ? exercise.loadText : `${exercise.loadText} · fight pace`,
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
  return {
    ...exercise,
    logMode: "timed_round",
    sets: bikeSetsForBand(band),
    reps: session ? bikeIntervalReps(session) : exercise.reps,
    restSeconds: session?.restBetweenSetsSeconds ?? 60,
    loadText: "All-out sprint / easy — no lbs",
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
    return bikeWorkSecondsPerSet(bikeSessionForName(exercise.name) ?? undefined);
  }
  return plannedDurationSeconds(exercise);
}
