import { resolveLogMode, type LogMode } from "@/lib/exercise-log-mode";

export type GymBand = "beginner" | "intermediate" | "advanced";

type GymExerciseInput = {
  name: string;
  notes?: string | null;
  loadText?: string | null;
  logMode?: string | null;
  reps?: string | null;
};

type Variant = {
  name: string;
  /** `keep` leaves the stored mode (cue-only rows). A mode forces the logger column. */
  logMode: LogMode | "keep";
};

type Family = {
  /** Every title this movement has used, including the names we show now. */
  aliases: string[];
  beginner: Variant;
  gym: Variant;
  scrub: (
    input: { notes: string; loadText: string },
    variant: Variant,
  ) => { notes?: string; loadText?: string };
};

export type GymPrescription = {
  name: string;
  notes?: string;
  loadText?: string;
  logMode: LogMode;
  renamed: boolean;
};

function keyOf(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unchanged(previous: string, next: string) {
  return next === previous ? undefined : next;
}

const FAMILIES: Family[] = [
  {
    aliases: ["Band pull-apart or face pull", "Face pull", "Band pull-apart"],
    beginner: { name: "Face pull", logMode: "load_reps" },
    gym: { name: "Face pull", logMode: "load_reps" },
    scrub: ({ notes, loadText }) => ({
      notes: /\bor\b|band pull-?apart/i.test(notes)
        ? "Rear shoulder. Pause at the squeeze."
        : undefined,
      loadText: unchanged(
        loadText,
        loadText.replace(/strong band,?\s*/gi, "").replace(/\s+·/g, " ·").replace(/·\s*·/g, "·").trim(),
      ),
    }),
  },
  {
    aliases: ["Chin-up, band-assist, or lat pulldown", "Chin-up", "Lat pulldown"],
    beginner: { name: "Chin-up", logMode: "reps_only" },
    gym: { name: "Lat pulldown", logMode: "load_reps" },
    scrub: ({ notes }, variant) => {
      if (variant.name === "Chin-up") {
        if (/full hang/i.test(notes) && !/\bor\b|no bar|inverted|pulldown/i.test(notes)) return {};
        return { notes: "Full hang. Control the lower. Stop when the chin stops clearing." };
      }
      if (/pull to the chest/i.test(notes) && !/\bor\b|no bar|inverted|full hang/i.test(notes)) {
        return {};
      }
      return { notes: "Full stretch. Pull to the chest. Control the return." };
    },
  },
  {
    aliases: ["Cable or band woodchop", "Cable woodchop"],
    beginner: { name: "Cable woodchop", logMode: "load_reps" },
    gym: { name: "Cable woodchop", logMode: "load_reps" },
    scrub: ({ notes }) => ({
      notes: /\bor\b/i.test(notes) ? "Hips turn, spine stays quiet. Hands finish late." : undefined,
    }),
  },
  {
    aliases: ["Cable or band Pallof press", "Cable Pallof press"],
    beginner: { name: "Cable Pallof press", logMode: "load_reps" },
    gym: { name: "Cable Pallof press", logMode: "load_reps" },
    scrub: ({ notes }) => ({
      notes: /\bor\b/i.test(notes) ? "Press out and hold the finish for a breath." : undefined,
    }),
  },
  {
    aliases: ["Push-up or dumbbell bench press", "Dumbbell bench press", "Push-up"],
    beginner: { name: "Push-up", logMode: "reps_only" },
    gym: { name: "Dumbbell bench press", logMode: "load_reps" },
    scrub: ({ notes }, variant) => {
      if (variant.name === "Push-up") {
        if (/hands under the shoulders/i.test(notes)) return {};
        if (/dumbbell|bench|chest or floor|\bor\b|\bload\b/i.test(notes)) {
          return { notes: "Hands under the shoulders. Do not bounce off the floor." };
        }
        return {};
      }
      if (!/chest or floor|\bor\b/i.test(notes)) return {};
      return { notes: "Dumbbells on a bench. Do not bounce the bells off the chest." };
    },
  },
  {
    aliases: ["Plyo push-up", "Explosive dumbbell press"],
    beginner: { name: "Plyo push-up", logMode: "reps_only" },
    gym: { name: "Explosive dumbbell press", logMode: "load_reps" },
    scrub: ({ notes, loadText }, variant) => {
      if (variant.name === "Plyo push-up") {
        return {
          notes: unchanged(notes, notes.replace(/\s*Elevate the hands if a full plyo is too much\./i, "")),
        };
      }
      let nextNotes = notes.replace(/\s*Elevate the hands if a full plyo is too much\./i, "");
      nextNotes = nextNotes
        .replace(/^Explosive push\.\s*/i, "Light bells. Speed off the chest. ")
        .replace(/^Explosive push before/i, "Light bells. Speed off the chest before")
        .replace(/^Explosive opener before/i, "Light bells. Speed off the chest before");
      if (!/bell|dumbbell/i.test(nextNotes)) {
        nextNotes = "Light bells. Speed off the chest.";
      }
      return {
        notes: unchanged(notes, nextNotes.trim()),
        loadText: /hands leave|the floor/i.test(loadText)
          ? loadText.replace(/Hands leave the floor\.\s*/i, "Speed off the chest. ")
          : undefined,
      };
    },
  },
  {
    aliases: ["Kettlebell swing or hip hinge", "Kettlebell swing"],
    beginner: { name: "Kettlebell swing", logMode: "load_reps" },
    gym: { name: "Kettlebell swing", logMode: "load_reps" },
    scrub: ({ notes }) => ({
      notes: /\bor\b|hip hinge/i.test(notes) ? "Snap the hips. Do not squat the bell." : undefined,
    }),
  },
  {
    aliases: ["Squat jump or box step-up", "Squat jump"],
    beginner: { name: "Squat jump", logMode: "reps_only" },
    gym: { name: "Squat jump", logMode: "reps_only" },
    scrub: ({ notes }) => ({
      notes: /\bor\b|step-up/i.test(notes) ? "Quiet landing. Stop if the knees cave." : undefined,
    }),
  },
  {
    aliases: ["Lateral bound or side step-over", "Lateral bound"],
    beginner: { name: "Lateral bound", logMode: "reps_only" },
    gym: { name: "Lateral bound", logMode: "reps_only" },
    scrub: ({ notes }) => ({
      notes: unchanged(
        notes,
        notes.replace(/Bound or step-over if a bound is too much\./i, "Stick the landing."),
      ),
    }),
  },
  {
    aliases: ["Jump rope or easy bike intervals", "Jump rope intervals"],
    beginner: { name: "Jump rope intervals", logMode: "timed" },
    gym: { name: "Jump rope intervals", logMode: "timed" },
    scrub: ({ notes }) => ({
      notes: unchanged(notes, notes.replace("Stay tall on the rope or easy on the bike.", "Stay tall on the rope.")),
    }),
  },
];

const FAMILY_BY_KEY = new Map<string, Family>();
for (const family of FAMILIES) {
  for (const alias of family.aliases) {
    FAMILY_BY_KEY.set(keyOf(alias), family);
  }
}

const CUE_FIXES: Array<{
  key: string;
  notes?: (notes: string) => string;
  loadText?: (loadText: string) => string;
}> = [
  {
    key: "goblet squat",
    notes: (notes) => notes.replace(/dumbbell or kettlebell/gi, "dumbbell"),
  },
  {
    key: "overhead press",
    notes: (notes) =>
      /light bar|landmine if/i.test(notes)
        ? "Dumbbells. Ribs down. No lean-back to finish."
        : notes,
  },
  {
    key: "one-arm row",
    loadText: (text) => text.replace(/heavy dumbbell or band/gi, "Heavy dumbbell"),
  },
];

function familyFor(name: string) {
  return FAMILY_BY_KEY.get(keyOf(name));
}

/**
 * One gym movement per card. Menus such as "A or B" collapse to the weighted
 * exercise. Beginners keep a bodyweight name only for push-ups and chin-ups.
 */
export function prescribeGymExercise(exercise: GymExerciseInput, band: GymBand): GymPrescription {
  const notes = exercise.notes ?? "";
  const loadText = exercise.loadText ?? "";
  const family = familyFor(exercise.name);
  const cue = CUE_FIXES.find((row) => row.key === keyOf(exercise.name));

  if (!family) {
    const nextNotes = cue?.notes ? cue.notes(notes) : notes;
    const nextLoad = cue?.loadText ? cue.loadText(loadText) : loadText;
    return {
      name: exercise.name,
      notes: unchanged(notes, nextNotes),
      loadText: unchanged(loadText, nextLoad),
      logMode: resolveLogMode({ ...exercise, reps: exercise.reps ?? undefined }),
      renamed: false,
    };
  }

  const variant = band === "beginner" ? family.beginner : family.gym;
  const scrubbed = family.scrub({ notes, loadText }, variant);
  const logMode =
    variant.logMode === "keep"
      ? resolveLogMode({ ...exercise, name: variant.name, reps: exercise.reps ?? undefined })
      : variant.logMode;
  return {
    name: variant.name,
    notes: scrubbed.notes,
    loadText: scrubbed.loadText,
    logMode,
    renamed: variant.name !== exercise.name,
  };
}

export function gymHistoryNames(names: string[]) {
  const out = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    out.add(trimmed);
    const family = familyFor(trimmed);
    if (!family) continue;
    for (const alias of family.aliases) out.add(alias);
  }
  return [...out];
}

export function rekeyGymRecord<T>(record: Record<string, T>, band: GymBand): Record<string, T> {
  const next: Record<string, T> = { ...record };
  for (const [name, value] of Object.entries(record)) {
    const canonical = prescribeGymExercise({ name }, band).name;
    if (next[canonical] === undefined) next[canonical] = value;
  }
  return next;
}

export function applyGymExerciseName<T extends { exerciseName: string; logMode?: string | null }>(
  set: T,
  band: GymBand,
): T {
  const gym = prescribeGymExercise({ name: set.exerciseName, logMode: set.logMode }, band);
  if (gym.name === set.exerciseName && gym.logMode === set.logMode) return set;
  return { ...set, exerciseName: gym.name, logMode: gym.logMode };
}
