import { intensityBand, resolveAiCoach, type AiCoachId, type IntensityBand } from "@/lib/coaches";

/** One spoken cue per this many milliseconds. The window is 45–60s. */
export const MOTIVATION_GAP_MS = 45_000;

export const MOTIVATION_MOMENTS = [
  "start",
  "exercise",
  "rest10",
  "hard-set",
  "pr",
  "halfway",
  "bag-round",
  "finish",
] as const;

export type MotivationMoment = (typeof MOTIVATION_MOMENTS)[number];

export function isMotivationMoment(value: string): value is MotivationMoment {
  return (MOTIVATION_MOMENTS as readonly string[]).includes(value);
}

export type MotivationSet = {
  id: string;
  completed: boolean;
  loadValue: number | null;
  rir: string;
  previousLoad?: number | null;
};

export type MotivationGroup = {
  name: string;
  logMode: string;
  sets: MotivationSet[];
  /** Last logged load for this exercise, if the member has one. */
  previousLoad: number | null;
};

export type MotivationView = {
  groups: MotivationGroup[];
  restRemaining: number | null;
  restActive: boolean;
  restKey: string;
};

export type PlannedCue = {
  id: string;
  moment: MotivationMoment;
  /** Cache key. Generic keys are shared. Dynamic keys include the exercise. */
  cueKey: string;
  dynamic: boolean;
  exerciseName?: string;
  previousLoad?: number | null;
  load?: number | null;
  bagTheme?: string;
};

const LEAD: Record<AiCoachId, Record<IntensityBand, string>> = {
  skye: {
    calm: "Skye.",
    balanced: "Skye.",
    lifted: "Skye.",
    intense: "Skye.",
  },
  maya: {
    calm: "Maya.",
    balanced: "Maya.",
    lifted: "Maya.",
    intense: "Maya.",
  },
  mateo: {
    calm: "Mateo.",
    balanced: "Mateo.",
    lifted: "Mateo.",
    intense: "Mateo.",
  },
  cole: {
    calm: "Cole.",
    balanced: "Cole.",
    lifted: "Cole.",
    intense: "Cole.",
  },
  ricky: {
    calm: "Ricky here.",
    balanced: "Ricky here.",
    lifted: "Ricky here.",
    intense: "Ricky here.",
  },
};

function sign(coachId: AiCoachId, band: IntensityBand) {
  if (band === "calm") {
    if (coachId === "skye") return "Keep the pace honest.";
    if (coachId === "maya") return "Stay on that detail.";
    if (coachId === "mateo") return "Do it clean.";
    if (coachId === "cole") return "I'm with you.";
    return "No fluff.";
  }
  if (band === "intense") {
    if (coachId === "ricky") return "Do it. No fluff.";
    if (coachId === "mateo") return "Do it clean.";
    if (coachId === "maya") return "That detail.";
    if (coachId === "cole") return "Do it. I'm with you.";
    return "Do it.";
  }
  if (band === "lifted") return "Next rep.";
  return "That's the standard.";
}

export function formCueForExercise(name: string) {
  const text = name.toLowerCase();
  if (/squat/.test(text)) return "Heels stay down and the knees track over the toes.";
  if (/deadlift|rdl|hinge|romanian/.test(text)) return "Hinge, keep the bar close, and use soft knees.";
  if (/bench|press/.test(text)) return "Set the shoulder blades and stack the wrists.";
  if (/\brow\b|rows/.test(text)) return "Chest up, and pull the elbows rather than the neck.";
  if (/plank|hollow|dead bug/.test(text)) return "Ribs down, and don't let the low back sag.";
  if (/lunge|split squat/.test(text)) return "Front heel down and the torso stays tall.";
  if (/carry|farmer/.test(text)) return "Stay tall and take even steps.";
  if (/bike|assault|rower/.test(text)) return "Sit tall and push and pull the pedals.";
  if (/jab|bag|shadow|mitt|pad/.test(text)) return "Hands home, chin in, and snap it back.";
  return "Own the position so the last rep looks like the first.";
}

export function isBagWork(name: string, logMode?: string) {
  if (/\b(bike|assault|rower|row erg)\b/i.test(name)) return false;
  if (logMode === "timed_round") return true;
  return /\b(bag|shadow|mitt|mitts|pads)\b/i.test(name);
}

export function bagThemeFromName(name: string) {
  const parts = name.split(/[—–-]/);
  const theme = (parts[1] ?? parts[0] ?? name).trim();
  return theme.slice(0, 80);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function hardRir(rir: string) {
  return /\b0\b|\b1\b|\b2\b|0\s*-\s*2|near/.test(rir);
}

function activeName(view: MotivationView) {
  for (const group of view.groups) {
    if (group.sets.some((set) => !set.completed)) return group.name;
  }
  return view.groups[0]?.name ?? "";
}

function completedCount(view: MotivationView) {
  return view.groups.reduce(
    (sum, group) => sum + group.sets.filter((set) => set.completed).length,
    0,
  );
}

function totalCount(view: MotivationView) {
  return view.groups.reduce((sum, group) => sum + group.sets.length, 0);
}

function newlyDone(prev: MotivationView, next: MotivationView) {
  const before = new Set(
    prev.groups.flatMap((group) => group.sets.filter((set) => set.completed).map((set) => set.id)),
  );
  const found: Array<{ group: MotivationGroup; set: MotivationSet }> = [];
  for (const group of next.groups) {
    for (const set of group.sets) {
      if (set.completed && !before.has(set.id)) found.push({ group, set });
    }
  }
  return found;
}

/** Lines are 1–2 sentences, about 3–6 seconds spoken. */
export function motivationScript(
  moment: MotivationMoment,
  coachId?: string | null,
  coachingStyle?: string | null,
  detail?: { exerciseName?: string; formCue?: string; load?: number | null; previousLoad?: number | null; bagTheme?: string },
) {
  const coach = resolveAiCoach(coachId);
  const band = intensityBand(coachingStyle);
  const lead = LEAD[coach.id][band];
  const close = sign(coach.id, band);
  const name = detail?.exerciseName?.trim() || "this piece";
  const form = detail?.formCue?.trim() || formCueForExercise(name);
  if (moment === "start") {
    return `${lead} We start with ${name}. ${form}`;
  }
  if (moment === "exercise") {
    return `${lead} ${name}. ${form}`;
  }
  if (moment === "rest10") {
    if (band === "calm") return `${lead} Last 10 seconds. Shake it out and get set.`;
    return `${lead} Last 10 seconds. Get set.`;
  }
  if (moment === "hard-set") {
    return `${lead} That was the hard one. ${close}`;
  }
  if (moment === "pr") {
    const from = detail?.previousLoad;
    const to = detail?.load;
    const moved = from != null && to != null ? `, ${Math.round(from)} to ${Math.round(to)}` : "";
    return `${lead} ${name}${moved}. You beat the last load.`;
  }
  if (moment === "halfway") {
    return `${lead} Halfway. Same standard as the first piece.`;
  }
  if (moment === "bag-round") {
    const theme = detail?.bagTheme?.trim() || bagThemeFromName(name);
    return `${lead} Bag round, theme is ${theme}. ${form}`;
  }
  return `${lead} That's the session. ${close}`;
}

export function scriptForCue(
  cue: PlannedCue,
  coachId?: string | null,
  coachingStyle?: string | null,
) {
  return motivationScript(cue.moment, coachId, coachingStyle, {
    exerciseName: cue.exerciseName,
    formCue: cue.exerciseName ? formCueForExercise(cue.exerciseName) : undefined,
    load: cue.load,
    previousLoad: cue.previousLoad,
    bagTheme: cue.bagTheme,
  });
}

function exerciseCue(group: MotivationGroup, moment: "exercise" | "bag-round"): PlannedCue {
  const bag = isBagWork(group.name, group.logMode);
  const theme = bag ? bagThemeFromName(group.name) : undefined;
  const resolved = bag ? "bag-round" : moment;
  const key = bag ? `bag:${slug(theme || group.name)}` : `exercise:${slug(group.name)}`;
  return {
    id: `${resolved}:${group.name}`,
    moment: resolved,
    cueKey: key,
    dynamic: true,
    exerciseName: group.name,
    bagTheme: theme,
  };
}

/**
 * Edges between two logger snapshots.
 * The player speaks at most one, and retries a cue that lost the gap.
 */
export function cuesOnTransition(prev: MotivationView | null, next: MotivationView): PlannedCue[] {
  const cues: PlannedCue[] = [];
  const total = totalCount(next);
  if (!prev) {
    const first =
      next.groups.find((group) => group.sets.some((set) => !set.completed)) ?? next.groups[0];
    cues.push({
      id: "start",
      moment: "start",
      cueKey: "start",
      dynamic: false,
      exerciseName: first?.name,
    });
    return cues;
  }

  const done = newlyDone(prev, next);
  const prevCompleted = completedCount(prev);
  const nextCompleted = completedCount(next);
  for (const { group, set } of done) {
    const previous = set.previousLoad ?? group.previousLoad;
    if (
      previous != null &&
      set.loadValue != null &&
      set.loadValue > previous
    ) {
      cues.push({
        id: `pr:${set.id}`,
        moment: "pr",
        cueKey: `pr:${slug(group.name)}:${Math.round(previous)}:${Math.round(set.loadValue)}`,
        dynamic: true,
        exerciseName: group.name,
        previousLoad: previous,
        load: set.loadValue,
      });
    } else if (
      hardRir(set.rir) ||
      group.sets.every((row) => row.completed)
    ) {
      cues.push({
        id: `hard:${set.id}`,
        moment: "hard-set",
        cueKey: "hard-set",
        dynamic: false,
        exerciseName: group.name,
      });
    }
  }

  if (total > 0 && prevCompleted / total < 0.5 && nextCompleted / total >= 0.5) {
    cues.push({
      id: "halfway",
      moment: "halfway",
      cueKey: "halfway",
      dynamic: false,
    });
  }

  if (total > 0 && nextCompleted === total && prevCompleted < total) {
    cues.push({
      id: "finish",
      moment: "finish",
      cueKey: "finish",
      dynamic: false,
    });
  }

  const prevActive = activeName(prev);
  const nextActive = activeName(next);
  const restJustEnded = prev.restActive && !next.restActive;
  const moved = nextActive && nextActive !== prevActive;
  if ((moved && !next.restActive) || (restJustEnded && moved)) {
    const group = next.groups.find((row) => row.name === nextActive);
    if (group && group.sets.some((set) => !set.completed)) {
      cues.push(exerciseCue(group, "exercise"));
    }
  }

  const prevRest = prev.restRemaining;
  const nextRest = next.restRemaining;
  if (
    next.restActive &&
    nextRest != null &&
    nextRest <= 10 &&
    nextRest > 3 &&
    (prevRest == null || prevRest > 10)
  ) {
    cues.push({
      id: `rest10:${next.restKey}`,
      moment: "rest10",
      cueKey: "rest10",
      dynamic: false,
    });
  }

  return cues;
}

/**
 * Clips to fetch when a workout opens: the start line, one line per exercise,
 * the rest-ending line, and the finish line. Playback then reads memory.
 */
export function cuesToPrefetch(view: MotivationView): PlannedCue[] {
  const cues: PlannedCue[] = [];
  const seen = new Set<string>();
  const first =
    view.groups.find((group) => group.sets.some((set) => !set.completed)) ?? view.groups[0];
  const start: PlannedCue = {
    id: "start",
    moment: "start",
    cueKey: "start",
    dynamic: false,
    exerciseName: first?.name,
  };
  cues.push(start);
  seen.add(start.cueKey);
  for (const group of view.groups) {
    const cue = exerciseCue(group, "exercise");
    if (seen.has(cue.cueKey)) continue;
    seen.add(cue.cueKey);
    cues.push(cue);
  }
  for (const moment of ["rest10", "finish"] as const) {
    cues.push({
      id: moment,
      moment,
      cueKey: moment,
      dynamic: false,
    });
  }
  return cues;
}

export type CueDecision = "speak" | "queue" | "skip";

export function decideMotivationCue(input: {
  enabled: boolean;
  nowMs: number;
  lastSpokenAtMs: number | null;
  beepUntilMs: number;
  restRemaining?: number | null;
  moment?: MotivationMoment;
}): { decision: CueDecision; reason: "off" | "gap" | "beep" | "late" | "ok" } {
  if (!input.enabled) return { decision: "skip", reason: "off" };
  const remaining = input.restRemaining;
  const inBeep =
    input.nowMs < input.beepUntilMs ||
    (remaining != null && remaining > 0 && remaining <= 3);
  if (input.moment === "rest10" && remaining != null && remaining <= 4) {
    return { decision: "skip", reason: "late" };
  }
  if (inBeep) return { decision: "queue", reason: "beep" };
  if (input.lastSpokenAtMs != null && input.nowMs - input.lastSpokenAtMs < MOTIVATION_GAP_MS) {
    return { decision: "skip", reason: "gap" };
  }
  return { decision: "speak", reason: "ok" };
}
