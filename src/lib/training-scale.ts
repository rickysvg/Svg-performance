import {
  BAG_REST_SECONDS,
  BAG_ROUND_COUNTS,
  BAG_ROUND_SECONDS,
  OPTIONAL_BAG_DAY_NUMBERS,
  bagDayNumber,
  bagMinutesForBand,
  bagRoundCountFor,
  isAdvancedLongBagDay,
} from "@/lib/bag-sessions";
import { campBikeBand, type CampPhase } from "@/lib/fight-camp";
import { weekInBlock } from "@/lib/mesocycle";
import { parseWeekDoses, stripWeekMarker } from "@/lib/v2-lifts";
import { bagFocusLines, formatBagRoundNotes } from "@/lib/bag-themes";
import {
  bikeIntervalReps,
  bikeSessionForLogger,
  bikeSessionForName,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
  scaleBikeSession,
} from "@/lib/bike-sessions";
import { floorSessionForDay } from "@/lib/bodyweight-plan";
import { daruExerciseForName } from "@/lib/daru-exercises";
import { formVideoFieldsFor } from "@/lib/form-videos";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import {
  formatClock,
  isDurationMode,
  isEmptyShadowRound,
  isShadowName,
  isWeightedShadowName,
  parseDurationSeconds,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import { prescribeGymExercise } from "@/lib/gym-exercise";
import { effortLoadText, mergeLoadText } from "@/lib/rir";
import { capSetsForRole, exerciseSetRole, isConditioningIntervalName } from "@/lib/set-budget";
import { memberCopy } from "@/lib/member-copy";
import { normalizeWeightAccess, type WeightAccess } from "@/lib/weight-access";

export type ScaleBand = "beginner" | "intermediate" | "advanced";

export type ScalePrefs = {
  experienceLevel?: string | null;
  competitionStatus?: string | null;
  weightAccess?: string | null;
  /** Member week since they started. Picks week 1–3 loads inside the block. */
  weekIndex?: number | null;
  /** Fight-camp phase. Bike days use a harder band of the same session. */
  campPhase?: CampPhase | null;
};

export type ScaleableExercise = {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode?: string;
  notes?: string;
  /** Comma-separated training tags from the plan, when the row has them. */
  tags?: string;
  formVideoUrl?: string;
  formVideoPending?: boolean;
  /** Week 1–3 dose is already applied. Skip Daru, set caps, and rest shrink. */
  lockWeek?: boolean;
};

/**
 * Skill-day round length (seconds) by DEMO Combat Skills dayNumber.
 * Every bag day is 30–45 minutes: warm-up, themed rounds, cooldown.
 */
export const SKILL_ROUND_SECONDS: Record<ScaleBand, Record<number, number>> = {
  beginner: {
    1: BAG_ROUND_SECONDS.beginner,
    2: BAG_ROUND_SECONDS.beginner,
    3: BAG_ROUND_SECONDS.beginner,
    4: BAG_ROUND_SECONDS.beginner,
    5: BAG_ROUND_SECONDS.beginner,
    6: BAG_ROUND_SECONDS.beginner,
  },
  intermediate: {
    1: BAG_ROUND_SECONDS.intermediate,
    2: BAG_ROUND_SECONDS.intermediate,
    3: BAG_ROUND_SECONDS.intermediate,
    4: BAG_ROUND_SECONDS.intermediate,
    5: BAG_ROUND_SECONDS.intermediate,
    6: BAG_ROUND_SECONDS.intermediate,
  },
  advanced: {
    1: BAG_ROUND_SECONDS.advanced,
    2: BAG_ROUND_SECONDS.advanced,
    3: BAG_ROUND_SECONDS.advanced,
    4: BAG_ROUND_SECONDS.advanced,
    5: BAG_ROUND_SECONDS.advanced,
    6: BAG_ROUND_SECONDS.advanced,
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
    6: BAG_REST_SECONDS.beginner,
  },
  intermediate: {
    1: BAG_REST_SECONDS.intermediate,
    2: BAG_REST_SECONDS.intermediate,
    3: BAG_REST_SECONDS.intermediate,
    4: BAG_REST_SECONDS.intermediate,
    5: BAG_REST_SECONDS.intermediate,
    6: BAG_REST_SECONDS.intermediate,
  },
  advanced: {
    1: BAG_REST_SECONDS.advanced,
    2: BAG_REST_SECONDS.advanced,
    3: BAG_REST_SECONDS.advanced,
    4: BAG_REST_SECONDS.advanced,
    5: BAG_REST_SECONDS.advanced,
    6: BAG_REST_SECONDS.advanced,
  },
};

export const SKILL_ROUND_COUNTS: Record<ScaleBand, Record<number, number>> = {
  beginner: {
    1: BAG_ROUND_COUNTS.beginner,
    2: BAG_ROUND_COUNTS.beginner,
    3: BAG_ROUND_COUNTS.beginner,
    4: BAG_ROUND_COUNTS.beginner,
    5: BAG_ROUND_COUNTS.beginner,
    6: BAG_ROUND_COUNTS.beginner,
  },
  intermediate: {
    1: BAG_ROUND_COUNTS.intermediate,
    2: BAG_ROUND_COUNTS.intermediate,
    3: BAG_ROUND_COUNTS.intermediate,
    4: BAG_ROUND_COUNTS.intermediate,
    5: BAG_ROUND_COUNTS.intermediate,
    6: BAG_ROUND_COUNTS.intermediate,
  },
  advanced: {
    1: BAG_ROUND_COUNTS.advanced,
    2: BAG_ROUND_COUNTS.advanced,
    3: BAG_ROUND_COUNTS.advanced,
    4: BAG_ROUND_COUNTS.advanced,
    5: BAG_ROUND_COUNTS.advanced,
    6: BAG_ROUND_COUNTS.advanced,
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
    reps: "5–6",
    loadText: "0-2 RIR · ~80% of a 5-rep max · Heavy — last rep slows but stays clean",
    restSeconds: 120,
  },
  "Romanian deadlift": {
    sets: 4,
    reps: "5",
    loadText: "0-2 RIR · ~80% of a 5-rep max · Heavy hinge — flat back",
    restSeconds: 120,
  },
  "Reverse lunge": {
    sets: 3,
    reps: "6 / leg",
    loadText: "2-4 RIR · Heavy dumbbells — knee tracks over the toes",
  },
  "Squat jump": {
    sets: 3,
    reps: "6",
    loadText: "3-5 RIR · Crisp landings",
  },
  "Front plank": {
    sets: 3,
    reps: "45–60 sec",
    loadText: "Hold — no weight",
    restSeconds: 30,
  },
  "Dumbbell bench press": {
    sets: 4,
    reps: "8–10",
    loadText: "0-2 RIR · ~80% of a 5-rep max · Heavy dumbbells",
    restSeconds: 120,
  },
  "One-arm row": {
    sets: 4,
    reps: "8 / side",
    loadText: "0-2 RIR · ~80% of a 5-rep max · Heavy dumbbell",
  },
  "Overhead press": {
    sets: 4,
    reps: "6–8",
    loadText: "0-2 RIR · ~80% of a 5-rep max · Heavy, lockout clean",
  },
  "Face pull": {
    sets: 3,
    reps: "15",
    loadText: "2-4 RIR · Full squeeze to the face",
  },
  "Farmer carry": {
    sets: 3,
    reps: "40–50 sec",
    loadText: "2-3 RIR · Heavy — walk tall",
    restSeconds: 75,
  },
  "Kettlebell swing": {
    sets: 4,
    reps: "12",
    loadText: "3-5 RIR · Hard, crisp snaps",
  },
  "Lat pulldown": {
    sets: 4,
    reps: "6–10",
    loadText: "1-3 RIR · Pull to the chest, control the return",
  },
  "Lateral bound": {
    sets: 3,
    reps: "6 / side",
    loadText: "3-5 RIR · Cover more ground",
  },
  "Jump rope intervals": {
    sets: 10,
    reps: "25 sec on / 35 sec easy",
    loadText: "Hard but repeatable",
    restSeconds: 0,
  },
  "Side plank": {
    sets: 3,
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

export function scaleCopy(band: ScaleBand, dayNumber?: number) {
  if (band === "advanced" && dayNumber != null && isAdvancedLongBagDay(dayNumber)) {
    return "Scaled for advanced / competition";
  }
  if (band === "advanced") return "Scaled for advanced / competition";
  if (band === "intermediate") return "Scaled for intermediate";
  return "Beginner pacing";
}

export function isHardStrengthBand(band: ScaleBand) {
  return band === "advanced";
}

function skillRoundSeconds(band: ScaleBand, dayNumber: number) {
  const listed = SKILL_ROUND_SECONDS[band][dayNumber];
  if (listed != null) return listed;
  if (OPTIONAL_BAG_DAY_NUMBERS.has(dayNumber)) return SKILL_ROUND_SECONDS[band][6];
  return BAG_ROUND_SECONDS[band];
}

function skillRestSeconds(band: ScaleBand, dayNumber: number) {
  const listed = SKILL_REST_SECONDS[band][dayNumber];
  if (listed != null) return listed;
  if (OPTIONAL_BAG_DAY_NUMBERS.has(dayNumber)) return SKILL_REST_SECONDS[band][6];
  return BAG_REST_SECONDS[band];
}

const SHORT_BAG_DAY_NUMBERS = new Set<number>([
  bagDayNumber("Tuesday", "A"),
  bagDayNumber("Tuesday", "B"),
  bagDayNumber("Tuesday", "C"),
]);

function roundsForBagDay(band: ScaleBand, dayNumber: number) {
  const full = bagRoundCountFor(band, dayNumber);
  if (SHORT_BAG_DAY_NUMBERS.has(dayNumber)) return Math.min(4, full);
  return full;
}

function withWeekDose(exercise: ScaleableExercise, weekIndex?: number | null): ScaleableExercise {
  const doses = parseWeekDoses(exercise.notes);
  if (!doses) {
    return { ...exercise, notes: stripWeekMarker(exercise.notes) };
  }
  const slot = Math.min(2, Math.max(0, weekInBlock(weekIndex ?? 0) - 1));
  const next = doses[slot];
  if (!next) return { ...exercise, notes: stripWeekMarker(exercise.notes) };
  return {
    ...exercise,
    sets: next.sets,
    reps: next.reps,
    loadText: next.loadText,
    restSeconds: next.restSeconds,
    notes: stripWeekMarker(exercise.notes),
    lockWeek: true,
  };
}

/** Hard compounds keep a long rest. Light finishers and power primers stay short. */
function floorStrengthRest(name: string, rest: number) {
  if (rest <= 0) return rest;
  if (/neck|pallof|plank|woodchop|landmine rotation|lateral bound|squat jump|med-ball|medicine ball/i.test(name)) {
    return rest;
  }
  if (/trap-bar deadlift/i.test(name)) return Math.max(rest, 150);
  if (/bench press|overhead press|goblet squat|walking lunge|pause goblet/i.test(name)) {
    return Math.max(rest, 120);
  }
  if (/farmer|suitcase/i.test(name)) return Math.max(rest, 75);
  if (/row|pulldown|deadlift|rdl|step-up|landmine press|\blunge\b/i.test(name)) {
    return Math.max(rest, 90);
  }
  return rest;
}

export function scaleExercise(
  exercise: ScaleableExercise,
  input: {
    band: ScaleBand;
    programSlug?: string;
    dayNumber?: number;
    weightAccess?: WeightAccess;
    weekIndex?: number | null;
    campPhase?: CampPhase | null;
  },
): ScaleableExercise {
  const gym = prescribeGymExercise(exercise, input.band);
  const named: ScaleableExercise = {
    ...exercise,
    name: gym.name,
    notes: gym.notes ?? exercise.notes,
    loadText: gym.loadText ?? exercise.loadText,
    logMode: gym.logMode,
  };
  const scaled = scaleNamedExercise(named, input);
  if (!gym.renamed) return scaled;
  return { ...scaled, ...formVideoFieldsFor(gym.name) };
}

function scaleNamedExercise(
  exercise: ScaleableExercise,
  input: {
    band: ScaleBand;
    programSlug?: string;
    dayNumber?: number;
    weightAccess?: WeightAccess;
    weekIndex?: number | null;
    campPhase?: CampPhase | null;
  },
): ScaleableExercise {
  exercise = withWeekDose(exercise, input.weekIndex);
  const mode = resolveLogMode(exercise);
  const slug = input.programSlug ?? "";
  const dayNumber = input.dayNumber ?? 1;
  const band = input.band;

  if (isWeightedShadowName(exercise.name) && input.weightAccess === "none") {
    return {
      ...exercise,
      name: "Shadowbox round 2 — fists, no weights",
      logMode: "timed",
      sets: 1,
      reps: band === "beginner" ? "2:00" : "3:00",
      restSeconds: band === "advanced" ? 30 : 45,
      loadText: "Empty hands — no hand weights",
      formVideoUrl: "",
      formVideoPending: false,
    };
  }

  if (isWeightedShadowName(exercise.name)) {
    return {
      ...exercise,
      logMode: "load_timed",
      sets: 1,
      reps: band === "beginner" ? "2:00" : "3:00",
      restSeconds: band === "advanced" ? 30 : 45,
      loadText:
        band === "beginner"
          ? "1 lb hand weights — fists if you have none"
          : band === "advanced"
            ? "2–3 lb hand weights"
            : "1–2 lb hand weights",
    };
  }

  if (isBikeIntervalName(exercise.name)) {
    return scaleBikeInterval(exercise, band, input.campPhase);
  }

  if (exercise.lockWeek) {
    const { lockWeek: _locked, ...rest } = exercise;
    return { ...rest, logMode: mode };
  }

  if (slug === DEMO_SKILL_PROGRAM_SLUG || slug === "skill") {
    if (/\bcool/i.test(exercise.name) && isShadowName(exercise.name)) {
      return {
        ...exercise,
        logMode: "timed",
        sets: 1,
        reps: "2:00",
        restSeconds: 0,
        loadText: "Breathe — no power",
      };
    }
    if (isEmptyShadowRound(exercise.name)) {
      return {
        ...exercise,
        logMode: "timed",
        sets: 1,
        reps: band === "beginner" ? "2:00" : "3:00",
        restSeconds: 30,
        loadText: "Empty hands — technical pace",
      };
    }
    if (mode === "timed_round") {
      const seconds = skillRoundSeconds(band, dayNumber);
      const rounds = roundsForBagDay(band, dayNumber);
      const isBagBlock = /\bbag rounds?\b/i.test(exercise.name);
      const parsed = isBagBlock && exercise.notes ? bagFocusLines(exercise.notes) : null;
      const notes =
        parsed && parsed.rounds.length > rounds
          ? `${formatBagRoundNotes(
              parsed.rounds.slice(0, rounds).map((line) => line.replace(/^R\d+\s+/, "")),
              parsed.credit ?? undefined,
            )} Heavy bag or pads if you have them. Bodyweight only: shadow the same work at technical speed — no full power.`
          : exercise.notes;
      return {
        ...exercise,
        notes,
        logMode: mode,
        sets: isBagBlock ? rounds : 1,
        reps: formatClock(seconds),
        restSeconds: skillRestSeconds(band, dayNumber),
        loadText: isBagBlock
          ? `${rounds} rounds × ${formatClock(seconds)}, ${skillRestSeconds(band, dayNumber)}s rest`
          : band === "beginner"
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

function scaleBikeInterval(
  exercise: ScaleableExercise,
  band: ScaleBand,
  campPhase?: CampPhase | null,
): ScaleableExercise {
  const used =
    campPhase && campPhase !== "pre-camp" && campPhase !== "complete"
      ? campBikeBand(campPhase, band)
      : band;
  const session = bikeSessionForName(exercise.name);
  const scaled = session ? scaleBikeSession(session, used) : null;
  const campNote =
    campPhase && campPhase !== "pre-camp" && campPhase !== "complete"
      ? `Camp ${campPhase}: same bike, ${used} dose.`
      : "";
  const loadText = scaled?.loadText ?? "Timed — no lbs or reps";
  return {
    ...exercise,
    logMode: "timed_round",
    sets: scaled?.sets ?? exercise.sets,
    reps: scaled ? bikeIntervalReps(scaled) : exercise.reps,
    restSeconds: scaled?.restBetweenSetsSeconds ?? 60,
    loadText: campNote ? `${loadText} · ${campNote}` : loadText,
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
        sets: capSetsForRole("accessory", exercise.sets),
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
      reps: "40–50 sec",
      loadText: mergeLoadText(exercise.loadText, "Heavy — walk tall"),
      restSeconds: floorStrengthRest(exercise.name, 75),
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

const BENCH_OR_PUSHUP = /^(?:push-up(?: or dumbbell bench press)?|dumbbell bench press)$/i;

function withForm(name: string, exercise: ScaleableExercise): ScaleableExercise {
  const video = formVideoFieldsFor(name);
  return {
    ...exercise,
    name,
    formVideoUrl: video.formVideoUrl,
    formVideoPending: video.formVideoPending,
  };
}

/** The stored name is the gym press. Beginners keep a push-up. Everyone else logs the bench. */
function prescribeGymPush(exercise: ScaleableExercise, band: ScaleBand): ScaleableExercise {
  if (BENCH_OR_PUSHUP.test(exercise.name)) {
    if (band === "beginner") {
      return withForm("Push-up", {
        ...exercise,
        logMode: "reps_only",
        sets: Math.min(exercise.sets, 4),
        reps: "8–12",
        loadText: effortLoadText("2-4", "Straight body. Knees if the last reps fall apart."),
        restSeconds: Math.max(exercise.restSeconds, 60),
        notes:
          "Main press on a beginner day. Chest to the floor. Use a stair, then a couch, if the floor is too hard.",
      });
    }
    const notes = (exercise.notes ?? "")
      .replace(/Chest or floor\.\s*/gi, "")
      .replace(/Do not bounce the weight off the chest\.?/gi, "Do not bounce the bells off the chest.")
      .trim();
    return withForm("Dumbbell bench press", {
      ...exercise,
      logMode: "load_reps",
      notes: /dumbbell/i.test(notes)
        ? notes
        : notes
          ? `Dumbbells on a bench. ${notes}`
          : "Dumbbells on a bench. Last rep slow and clean.",
    });
  }
  if (/^plyo push-up$/i.test(exercise.name) && band !== "beginner") {
    return withForm("Explosive dumbbell press", {
      ...exercise,
      logMode: "load_reps",
      loadText: effortLoadText("3-5", "Light bells. Speed off the chest, not a grind."),
      notes: "Power primer before the heavy bench. Leave speed in the tank.",
    });
  }
  return exercise;
}

function scaleStrengthExercise(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
): ScaleableExercise {
  return prescribeGymPush(scaleStrengthLoad(exercise, band, mode), band);
}

function withSetBudget(exercise: ScaleableExercise): ScaleableExercise {
  if (isConditioningIntervalName(exercise.name, exercise.reps)) return exercise;
  return {
    ...exercise,
    sets: capSetsForRole(exerciseSetRole(exercise), exercise.sets),
  };
}

/** Bike, rope, sled, and other interval prescriptions keep their old set math. */
function scaleConditioningStrength(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
): ScaleableExercise {
  const rest = restForBand(exercise.restSeconds, band);
  if (band === "intermediate" && mode === "load_reps") {
    return {
      ...exercise,
      logMode: mode,
      sets: Math.min(5, exercise.sets + 1),
      restSeconds: rest,
      loadText: /slow|heavy|grind|\bRIR\b/i.test(exercise.loadText)
        ? exercise.loadText
        : `${exercise.loadText} · last reps should slow`,
    };
  }
  if (band !== "advanced") {
    const hold = mode === "timed" ? { loadText: "Hold — no weight" } : {};
    return { ...exercise, logMode: mode, restSeconds: rest, ...hold };
  }
  const override = HARD_STRENGTH[exercise.name];
  return {
    ...exercise,
    logMode: mode,
    restSeconds: floorStrengthRest(exercise.name, override?.restSeconds ?? rest),
    sets: override?.sets ?? Math.min(exercise.sets + 1, 5),
    reps: override?.reps ?? exercise.reps,
    loadText: mergeLoadText(exercise.loadText, override?.loadText ?? harderLoadText(exercise.loadText)),
  };
}

function scaleStrengthLoad(
  exercise: ScaleableExercise,
  band: ScaleBand,
  mode: LogMode,
): ScaleableExercise {
  const daru = daruExerciseForName(exercise.name);
  if (daru) {
    const scaled = daru.scale[band];
    const next: ScaleableExercise = {
      ...exercise,
      logMode: daru.logMode,
      sets: scaled.sets,
      reps: scaled.reps,
      restSeconds: scaled.restSeconds,
      loadText: scaled.loadText,
    };
    if (isConditioningIntervalName(exercise.name, next.reps)) return next;
    return withSetBudget(next);
  }
  if (isConditioningIntervalName(exercise.name, exercise.reps)) {
    return scaleConditioningStrength(exercise, band, mode);
  }
  const rest = floorStrengthRest(exercise.name, restForBand(exercise.restSeconds, band));
  if (mode === "load_timed") {
    return withSetBudget(scaleLoadedCarry(exercise, band, mode, rest));
  }
  const role = exerciseSetRole(exercise);
  if (band === "intermediate" && mode === "load_reps") {
    return withSetBudget({
      ...exercise,
      logMode: mode,
      sets: role === "main" ? exercise.sets + 1 : exercise.sets,
      restSeconds: rest,
      loadText: /slow|heavy|grind|\bRIR\b/i.test(exercise.loadText)
        ? exercise.loadText
        : `${exercise.loadText} · last reps should slow`,
    });
  }
  if (band !== "advanced") {
    const hold = mode === "timed" ? { loadText: "Hold — no weight" } : {};
    return withSetBudget({ ...exercise, logMode: mode, restSeconds: rest, ...hold });
  }
  const override = HARD_STRENGTH[exercise.name];
  return withSetBudget({
    ...exercise,
    logMode: mode,
    restSeconds: floorStrengthRest(exercise.name, override?.restSeconds ?? rest),
    sets: override?.sets ?? (role === "main" ? exercise.sets + 1 : exercise.sets),
    reps: override?.reps ?? exercise.reps,
    loadText: mergeLoadText(exercise.loadText, override?.loadText ?? harderLoadText(exercise.loadText)),
  });
}

function restForBand(seedRest: number, band: ScaleBand) {
  if (seedRest <= 0) return 0;
  if (band === "beginner") return Math.max(seedRest, STRENGTH_REST.beginner);
  // Written strength rest stays. Do not crush a main lift down to 45s.
  return seedRest;
}

function harderLoadText(text: string) {
  if (/hold/i.test(text)) return "Hold — no weight";
  if (/heavy/i.test(text)) return text;
  return text.replace(/moderate/i, "Heavy").replace(/light/i, "Challenging");
}

const BEGINNER_NAME: Record<string, string> = {
  "Squat jump": "Sit-to-stand",
  "Jump squat": "Sit-to-stand",
  "Jump squats": "Sit-to-stand",
  "Broad jump": "Step and stick",
  "Broad jumps": "Step and stick",
  "Lateral bound": "Step-out and stick",
};

function formFirstBeginner<T extends ScaleableExercise>(exercise: T): T {
  const load = exercise.loadText ?? "";
  if (/hold/i.test(load) || /2-4 RIR/.test(load)) return exercise;
  if (!/\d+\s*%|0-2 RIR|1-2 RIR|1-3 RIR/.test(load)) return exercise;
  const softened = load
    .replace(/·?\s*~?\d+\s*%[^·]*/g, "")
    .replace(/0-2 RIR|1-2 RIR|1-3 RIR/g, "3-5 RIR")
    .replace(/\s+/g, " ")
    .trim();
  return { ...exercise, loadText: `Form first — light. ${softened}`.replace(/\s+/g, " ").trim() };
}

function presentExercise<T extends ScaleableExercise>(exercise: T, band: ScaleBand, seen: Set<string>): T {
  let next: T = {
    ...exercise,
    loadText: memberCopy(exercise.loadText ?? ""),
    notes: exercise.notes ? memberCopy(stripWeekMarker(exercise.notes)) : exercise.notes,
  };
  if (band === "beginner") {
    next = formFirstBeginner(next);
    const swapped = BEGINNER_NAME[next.name];
    if (swapped) next = { ...next, name: swapped };
  }
  if (seen.has(next.name)) next = { ...next, name: `${next.name} (second)` };
  seen.add(next.name);
  if (
    next.sets >= 5 &&
    !/finisher|interval|round|conditioning|reason|extra set/i.test(`${next.notes ?? ""} ${next.name}`)
  ) {
    next = {
      ...next,
      notes: `${next.notes ? `${next.notes} ` : ""}Extra sets are the conditioning finisher, not a strength set.`.trim(),
    };
  }
  if (!next.reps?.trim()) next = { ...next, reps: "8" };
  return next;
}

export function scaleExercises<T extends ScaleableExercise>(
  exercises: T[],
  input: {
    band: ScaleBand;
    programSlug?: string;
    dayNumber?: number;
    weightAccess?: WeightAccess;
    weekIndex?: number | null;
    campPhase?: CampPhase | null;
  },
): T[] {
  const seen = new Set<string>();
  return exercises.map((exercise) =>
    presentExercise({ ...exercise, ...scaleExercise(exercise, input) }, input.band, seen),
  );
}

function stampFloorExercises<T extends ScaleableExercise>(
  originals: T[],
  menu: ScaleableExercise[],
): T[] {
  return menu.map((exercise, index) => {
    const base = originals[index] ?? originals[0];
    const video = formVideoFieldsFor(exercise.name);
    const id =
      base && typeof (base as unknown as { id?: unknown }).id === "string"
        ? `${(base as unknown as { id: string }).id}-floor-${index}`
        : undefined;
    return {
      ...(base ?? ({} as T)),
      ...exercise,
      ...(id ? { id } : {}),
      sortOrder: index + 1,
      formVideoUrl: video.formVideoUrl,
      formVideoPending: video.formVideoPending,
    } as T;
  });
}

export function scaleProgramDay<
  T extends { dayNumber: number; focus: string; title?: string; exercises: ScaleableExercise[] },
>(
  day: T,
  input: {
    band: ScaleBand;
    programSlug?: string;
    weightAccess?: string | null;
    weekIndex?: number | null;
    campPhase?: CampPhase | null;
  },
): T {
  const weightAccess = normalizeWeightAccess(input.weightAccess);
  const floor =
    weightAccess === "none"
      ? floorSessionForDay(day.dayNumber, input.programSlug, input.band)
      : null;
  if (floor) {
    const note = scaleCopy(input.band);
    const focus = floor.focus.includes(note) ? floor.focus : `${floor.focus} · ${note}`;
    const seen = new Set<string>();
    return {
      ...day,
      title: memberCopy(floor.title),
      focus: memberCopy(focus),
      exercises: stampFloorExercises(day.exercises, floor.exercises).map((exercise) =>
        presentExercise(exercise, input.band, seen),
      ),
    };
  }
  const exercises = scaleExercises(day.exercises, {
    band: input.band,
    programSlug: input.programSlug,
    dayNumber: day.dayNumber,
    weightAccess,
    weekIndex: input.weekIndex,
    campPhase: input.campPhase,
  });
  const note = scaleCopy(
    input.band,
    input.programSlug === DEMO_SKILL_PROGRAM_SLUG || input.programSlug === "skill"
      ? day.dayNumber
      : undefined,
  );
  const focus = day.focus.includes("Scaled") || day.focus.includes("DEMO Core")
    ? day.focus
    : `${day.focus} · ${note}`;
  const minutes =
    input.programSlug === DEMO_SKILL_PROGRAM_SLUG || input.programSlug === "skill"
      ? bagMinutesForBand(input.band, day.dayNumber)
      : null;
  const timedFocus = minutes ? `${focus} · about ${minutes} min` : focus;
  return {
    ...day,
    title: day.title ? memberCopy(day.title) : day.title,
    exercises,
    focus: memberCopy(timedFocus),
  };
}

export function scaleDemoCatalog<
  T extends {
    strength?: { slug?: string; days: Array<{ dayNumber: number; focus: string; exercises: ScaleableExercise[] }> } | null;
    skill?: { slug?: string; days: Array<{ dayNumber: number; focus: string; exercises: ScaleableExercise[] }> } | null;
  },
>(catalog: T, prefs?: ScalePrefs | null): T {
  const band = scaleBandFromPrefs(prefs);
  const weightAccess = normalizeWeightAccess(prefs?.weightAccess);
  return {
    ...catalog,
    strength: catalog.strength
      ? {
          ...catalog.strength,
          days: catalog.strength.days.map((day) =>
            scaleProgramDay(day, {
              band,
              programSlug: DEMO_PROGRAM_SLUG,
              weightAccess,
              weekIndex: prefs?.weekIndex,
              campPhase: prefs?.campPhase,
            }),
          ),
        }
      : catalog.strength,
    skill: catalog.skill
      ? {
          ...catalog.skill,
          days: catalog.skill.days.map((day) =>
            scaleProgramDay(day, {
              band,
              programSlug: DEMO_SKILL_PROGRAM_SLUG,
              weightAccess,
              weekIndex: prefs?.weekIndex,
              campPhase: prefs?.campPhase,
            }),
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
