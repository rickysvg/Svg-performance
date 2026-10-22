/**
 * Rule-based assault / air bike workouts a member can swap onto today's bike.
 * No model calls. The choice rides on the set prescription key and, when the
 * session is saved, on the exercise rep string. No schema change.
 */

import {
  isBikeIntervalName,
  parseBikeIntervalReps,
  type BikeSession,
} from "@/lib/bike-sessions";
import {
  bikeSetDurationSeconds,
  sprintCountForSpec,
  type BikeIntervalSpec,
} from "@/lib/bike-interval-timer";
import { addedPrescriptionKey, parseAddedPlan } from "@/lib/logger-insert";

export type BikeGoal = "power" | "anaerobic" | "aerobic" | "fight-sim";
export type BikeLevel = "beginner" | "intermediate" | "advanced";

export type BikeChoice = {
  id: string;
  name: string;
  description: string;
  goal: BikeGoal;
  level: BikeLevel;
  /** Human line stored with My Workouts. A trailing bw tag is added on save. */
  plain: string;
  spec: BikeIntervalSpec;
};

export const BIKE_GOAL_LABEL: Record<BikeGoal, string> = {
  power: "Power",
  anaerobic: "Anaerobic",
  aerobic: "Aerobic",
  "fight-sim": "Fight sim",
};

export const BIKE_LEVEL_LABEL: Record<BikeLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const LADDER = [
  { workSeconds: 10, restSeconds: 50 },
  { workSeconds: 20, restSeconds: 40 },
  { workSeconds: 30, restSeconds: 30 },
  { workSeconds: 40, restSeconds: 20 },
  { workSeconds: 50, restSeconds: 10 },
  { workSeconds: 40, restSeconds: 20 },
  { workSeconds: 30, restSeconds: 30 },
  { workSeconds: 20, restSeconds: 40 },
  { workSeconds: 10, restSeconds: 50 },
] as const;

function choice(
  id: string,
  name: string,
  description: string,
  goal: BikeGoal,
  level: BikeLevel,
  plain: string,
  spec: BikeIntervalSpec,
): BikeChoice {
  return { id, name, description, goal, level, plain, spec };
}

export const BIKE_CHOICES: readonly BikeChoice[] = [
  choice(
    "tabata",
    "Tabata 20/10 × 8",
    "Eight all-out 20s sprints with 10s rest. The original 4-minute bike protocol.",
    "anaerobic",
    "advanced",
    "20s work / 10s rest × 8",
    { workSeconds: 20, restSeconds: 10, roundsPerSet: 8 },
  ),
  choice(
    "alactic-10",
    "10 × 10s / 50s",
    "Ten max 10s sprints with 50s easy spin, so the next one stays fast.",
    "power",
    "intermediate",
    "10s work / 50s rest × 10",
    { workSeconds: 10, restSeconds: 50, roundsPerSet: 10 },
  ),
  choice(
    "thirty-thirty",
    "30/30 × 10",
    "Ten rounds of 30s hard and 30s easy. Hold a pace you can repeat.",
    "anaerobic",
    "intermediate",
    "30s work / 30s rest × 10",
    { workSeconds: 30, restSeconds: 30, roundsPerSet: 10 },
  ),
  choice(
    "ten-twenty-thirty",
    "Bike 10-20-30",
    "Three 5-minute blocks, 2 minutes easy between. Each minute is 30s easy, 20s moderate, 10s sprint.",
    "aerobic",
    "intermediate",
    "3 × 5 min · 30s easy / 20s moderate / 10s sprint · 2 min between",
    {
      workSeconds: 10,
      restSeconds: 50,
      roundsPerSet: 5,
      blocks: 3,
      restBetweenBlocksSeconds: 120,
      pattern: "ten-twenty-thirty",
    },
  ),
  choice(
    "emom-15-45",
    "15/45 EMOM",
    "Ten minutes. Sprint 15s at the start of each minute, then easy spin for 45s.",
    "power",
    "intermediate",
    "15s work / 45s rest × 10",
    { workSeconds: 15, restSeconds: 45, roundsPerSet: 10 },
  ),
  choice(
    "fight-minute",
    "60/60 × 8",
    "Eight hard minutes, each followed by an easy minute. A fight-minute repeat.",
    "fight-sim",
    "intermediate",
    "60s work / 60s rest × 8",
    { workSeconds: 60, restSeconds: 60, roundsPerSet: 8 },
  ),
  choice(
    "threshold-5",
    "3 × 5 min threshold",
    "Three 5-minute pieces at a hard, steady pace. 2 minutes easy between.",
    "aerobic",
    "intermediate",
    "5 min work / 2 min easy × 3",
    {
      workSeconds: 300,
      restSeconds: 0,
      roundsPerSet: 1,
      blocks: 3,
      restBetweenBlocksSeconds: 120,
    },
  ),
  choice(
    "twenty-forty",
    "20s / 40s × 10",
    "Ten 20s hard efforts with 40s easy spin. A first fan-bike interval.",
    "anaerobic",
    "beginner",
    "20s work / 40s rest × 10",
    { workSeconds: 20, restSeconds: 40, roundsPerSet: 10 },
  ),
  choice(
    "fight-rounds",
    "5-round fight sim",
    "Five 3-minute rounds, 1 minute between. Each minute is a 15s surge and 45s pace.",
    "fight-sim",
    "advanced",
    "5 × 3 min · 15s surge / 45s pace · 1 min between",
    {
      workSeconds: 15,
      restSeconds: 45,
      roundsPerSet: 3,
      blocks: 5,
      restBetweenBlocksSeconds: 60,
      pattern: "surge",
    },
  ),
  choice(
    "norwegian-4x4",
    "Norwegian 4×4",
    "Four 4-minute efforts near 90% of max heart rate, 3 minutes easy between. Warm up first.",
    "aerobic",
    "intermediate",
    "4 × 4 min hard / 3 min easy",
    {
      workSeconds: 240,
      restSeconds: 0,
      roundsPerSet: 1,
      blocks: 4,
      restBetweenBlocksSeconds: 180,
    },
  ),
  choice(
    "sprint-ladder",
    "Sprint calorie ladder",
    "Sprints climb from 10s to 50s and back down. Rest fills the minute. Score calories if the bike shows them.",
    "anaerobic",
    "intermediate",
    "10s to 50s sprint ladder, rest fills the minute",
    {
      workSeconds: 10,
      restSeconds: 50,
      roundsPerSet: LADDER.length,
      pattern: "ladder",
      ladder: LADDER,
    },
  ),
  choice(
    "vo2-15-15",
    "15/15 VO2 × 20",
    "Twenty 15s hard / 15s easy repeats. A shorter block of the Helgerud 15/15.",
    "aerobic",
    "advanced",
    "15s work / 15s rest × 20",
    { workSeconds: 15, restSeconds: 15, roundsPerSet: 20 },
  ),
];

const BY_ID = new Map(BIKE_CHOICES.map((row) => [row.id, row]));

export function bikeChoiceById(id: string): BikeChoice | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Rounds the Assault Bike timer logs.
 * A fight sim counts its rounds (5), not every surge inside the round.
 */
export function bikeTimerRoundCount(choice: BikeChoice) {
  const blocks = Math.max(1, Math.round(choice.spec.blocks ?? 1));
  if (choice.spec.pattern === "surge" && blocks > 1) return blocks;
  const repeats = Math.max(1, Math.round(choice.spec.repeatRounds ?? 1));
  return repeats * Math.max(1, Math.round(choice.spec.roundsPerSet));
}

export function bikeChoiceMinutes(choice: BikeChoice) {
  return Math.max(1, Math.round(bikeSetDurationSeconds(choice.spec) / 60));
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/** Picker steps. Sprint and rest stay on sensible jumps. Prep is whole minutes. */
export const BIKE_SPRINT_SECONDS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120] as const;
export const BIKE_REST_SECONDS = [5, 10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180] as const;
export const BIKE_SPRINT_COUNTS = Array.from({ length: 30 }, (_, index) => index + 1);
export const BIKE_ROUND_COUNTS = Array.from({ length: 10 }, (_, index) => index + 1);
export const BIKE_BETWEEN_SECONDS = [0, 15, 30, 45, 60, 90, 120, 180, 240, 300] as const;
export const BIKE_PREP_MINUTES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const REPEAT_SUFFIX = / · \d+ rounds(?: · \d+s between)?$/;

export function bikeChoiceWithRounds(
  choice: BikeChoice,
  repeatRounds: number,
  restBetweenRoundsSeconds: number,
): BikeChoice | null {
  const rounds = clampInt(repeatRounds, 1, 10);
  const between = clampInt(restBetweenRoundsSeconds, 0, 600);
  if (rounds == null || between == null) return null;
  const basePlain = choice.plain.replace(REPEAT_SUFFIX, "");
  const baseName = choice.name.replace(/ · \d+ rounds$/, "");
  if (rounds <= 1) {
    return {
      ...choice,
      name: baseName,
      plain: basePlain,
      spec: { ...choice.spec, repeatRounds: 1, restBetweenRoundsSeconds: 0 },
    };
  }
  return {
    ...choice,
    name: `${baseName} · ${rounds} rounds`,
    plain: `${basePlain} · ${rounds} rounds · ${between}s between`,
    spec: { ...choice.spec, repeatRounds: rounds, restBetweenRoundsSeconds: between },
  };
}

export function customBikeChoice(input: {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
  repeatRounds?: number;
  restBetweenRoundsSeconds?: number;
}): BikeChoice | null {
  const workSeconds = clampInt(input.workSeconds, 5, 120);
  const restSeconds = clampInt(input.restSeconds, 5, 180);
  const rounds = clampInt(input.rounds, 1, 30);
  const warmupSeconds = clampInt(input.warmupSeconds ?? 0, 0, 600);
  const cooldownSeconds = clampInt(input.cooldownSeconds ?? 0, 0, 600);
  const repeatRounds = input.repeatRounds == null ? 1 : clampInt(input.repeatRounds, 1, 10);
  const between = input.restBetweenRoundsSeconds == null ? 0 : clampInt(input.restBetweenRoundsSeconds, 0, 600);
  if (
    workSeconds == null ||
    restSeconds == null ||
    rounds == null ||
    warmupSeconds == null ||
    cooldownSeconds == null ||
    repeatRounds == null ||
    between == null
  ) {
    return null;
  }
  const shownBetween = repeatRounds > 1 ? between : 0;
  const basePlain = `${workSeconds}s work / ${restSeconds}s rest × ${rounds} · wu ${warmupSeconds} · cd ${cooldownSeconds}`;
  const plain = repeatRounds > 1 ? `${basePlain} · ${repeatRounds} rounds · ${shownBetween}s between` : basePlain;
  return {
    id: "custom",
    name: repeatRounds > 1 ? `Custom sprints · ${repeatRounds} rounds` : "Custom sprints",
    description: "Your sprint, rest, and count. Repeat the block for extra rounds.",
    goal: "anaerobic",
    level: "intermediate",
    plain,
    spec: {
      workSeconds,
      restSeconds,
      roundsPerSet: rounds,
      warmupSeconds,
      cooldownSeconds,
      repeatRounds,
      restBetweenRoundsSeconds: shownBetween,
    },
  };
}

export function formatBikeRecipe(choice: BikeChoice) {
  return `${choice.plain} · bw ${choiceToken(choice)}`;
}

/** Short reps string that still parses after the 160-character prescription key cut. */
export function compactBikeReps(reps: string) {
  const choice = parseBikeRecipe(reps);
  if (!choice) return reps;
  return `bw ${choiceToken(choice)}`;
}

export function plainBikeReps(reps: string) {
  return reps.replace(/\s*·\s*bw\s+[a-z0-9.-]+\s*$/i, "").replace(/^\s*bw\s+[a-z0-9.-]+\s*$/i, "").trim();
}

function legacyCustomRecipe(reps: string): BikeChoice | null {
  const interval = reps.match(/(\d+)\s*s\s*work\s*\/\s*(\d+)\s*s\s*rest\s*[×x]\s*(\d+)/i);
  if (!interval) return null;
  const warmup = reps.match(/·\s*wu\s*(\d+)/i);
  const cooldown = reps.match(/·\s*cd\s*(\d+)/i);
  const repeat = reps.match(/(\d+)\s*rounds/i);
  const between = reps.match(/(\d+)\s*s\s*between/i);
  return customBikeChoice({
    workSeconds: Number(interval[1]),
    restSeconds: Number(interval[2]),
    rounds: Number(interval[3]),
    warmupSeconds: warmup ? Number(warmup[1]) : 0,
    cooldownSeconds: cooldown ? Number(cooldown[1]) : 0,
    repeatRounds: repeat ? Number(repeat[1]) : 1,
    restBetweenRoundsSeconds: between ? Number(between[1]) : 0,
  });
}

export function parseBikeRecipe(reps: string): BikeChoice | null {
  const tag = reps.match(/(?:^|\s)bw\s+([a-z0-9.-]+)\s*$/i);
  if (!tag) return null;
  const token = tag[1]!.toLowerCase();
  if (token === "custom") return legacyCustomRecipe(reps);
  return choiceFromToken(token);
}

const MARK = "#bw:";

export const BIKE_CHOICE_STORAGE_KEY = "svg_bike_choice";
export const BIKE_CHOICE_EVENT = "svg-bike-choice";

export function rememberBikeChoice(choice: BikeChoice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BIKE_CHOICE_STORAGE_KEY, choiceToken(choice));
    window.dispatchEvent(new Event(BIKE_CHOICE_EVENT));
  } catch {
    /* private mode */
  }
}

export function readRememberedBikeChoice(): BikeChoice | null {
  if (typeof window === "undefined") return null;
  try {
    return choiceFromToken(window.localStorage.getItem(BIKE_CHOICE_STORAGE_KEY) ?? "");
  } catch {
    return null;
  }
}

export function choiceToken(choice: BikeChoice) {
  const spec = choice.spec;
  const rounds = spec.repeatRounds ?? 1;
  const between = spec.restBetweenRoundsSeconds ?? 0;
  if (choice.id === "custom") {
    const core = `c.${spec.workSeconds}.${spec.restSeconds}.${spec.roundsPerSet}.${spec.warmupSeconds ?? 0}.${spec.cooldownSeconds ?? 0}`;
    if (rounds <= 1 && between <= 0) return core;
    return `${core}.${rounds}.${between}`;
  }
  if (rounds <= 1) return choice.id;
  return `${choice.id}.${rounds}.${between}`;
}

export function choiceFromToken(token: string): BikeChoice | null {
  if (token.startsWith("c.")) {
    const [work, rest, rounds, warmup, cooldown, repeat, between] = token.slice(2).split(".").map(Number);
    return customBikeChoice({
      workSeconds: work ?? Number.NaN,
      restSeconds: rest ?? Number.NaN,
      rounds: rounds ?? Number.NaN,
      warmupSeconds: warmup,
      cooldownSeconds: cooldown,
      repeatRounds: Number.isFinite(repeat) ? repeat : undefined,
      restBetweenRoundsSeconds: Number.isFinite(between) ? between : undefined,
    });
  }
  const [id, roundsRaw, betweenRaw] = token.split(".");
  const base = bikeChoiceById(id ?? "");
  if (!base) return null;
  if (roundsRaw == null || roundsRaw === "") return base;
  return bikeChoiceWithRounds(base, Number(roundsRaw), betweenRaw == null ? 0 : Number(betweenRaw));
}

export function attachBikeChoice(prescriptionKey: string, token: string) {
  const cut = prescriptionKey.indexOf(MARK);
  const base = cut === -1 ? prescriptionKey : prescriptionKey.slice(0, cut);
  const mark = `${MARK}${token}`;
  const room = 160 - mark.length;
  const trimmed = base.length <= room ? base : base.slice(0, Math.max(0, room));
  return `${trimmed}${mark}`;
}

export function bikeChoiceFromKey(prescriptionKey: string | null | undefined): BikeChoice | null {
  const key = prescriptionKey ?? "";
  if (key.startsWith("added|")) {
    const plan = parseAddedPlan(key);
    return plan?.reps ? parseBikeRecipe(plan.reps) : null;
  }
  const cut = key.indexOf(MARK);
  if (cut === -1) return null;
  return choiceFromToken(key.slice(cut + MARK.length));
}

export function prescriptionWithBikeChoice(
  prescriptionKey: string,
  exerciseName: string,
  choice: BikeChoice,
) {
  if (prescriptionKey.startsWith("added|")) {
    const plan = parseAddedPlan(prescriptionKey);
    return addedPrescriptionKey({
      exerciseName,
      reps: `bw ${choiceToken(choice)}`,
      restSeconds: 0,
      loadText: plan?.loadText ?? "",
      notes: "",
    });
  }
  return attachBikeChoice(prescriptionKey, choiceToken(choice));
}

export function sessionWithChoice(base: BikeSession, choice: BikeChoice): BikeSession {
  const spec = choice.spec;
  return {
    ...base,
    workSeconds: spec.workSeconds,
    restSeconds: spec.restSeconds,
    roundsPerSet: spec.roundsPerSet,
    sets: 1,
    restBetweenSetsSeconds: 0,
    warmupSeconds: spec.warmupSeconds ?? 0,
    cooldownSeconds: spec.cooldownSeconds ?? 0,
    blocks: spec.blocks ?? 1,
    restBetweenBlocksSeconds: spec.restBetweenBlocksSeconds ?? 0,
    repeatRounds: spec.repeatRounds ?? 1,
    restBetweenRoundsSeconds: spec.restBetweenRoundsSeconds ?? 0,
    pattern: spec.pattern ?? "binary",
    ladder: spec.ladder,
    chooserLabel: choice.plain,
    focus: choice.name,
    notes: choice.description,
  };
}

export function retainBikeChoiceSets<
  T extends {
    exerciseName: string;
    completed: boolean;
    setNumber: number;
    prescriptionKey: string;
  },
>(sets: T[], exerciseName: string, choice: BikeChoice): T[] {
  const first = sets.findIndex((set) => set.exerciseName === exerciseName);
  if (first < 0) return sets;
  const mine = sets.filter((set) => set.exerciseName === exerciseName);
  const completed = mine.filter((set) => set.completed);
  const open = mine.find((set) => !set.completed) ?? (completed.length === 0 ? mine[0] : undefined);
  const kept = completed.map((set) => ({
    ...set,
    prescriptionKey: prescriptionWithBikeChoice(set.prescriptionKey, exerciseName, choice),
  }));
  if (open && !open.completed) {
    kept.push({
      ...open,
      prescriptionKey: prescriptionWithBikeChoice(open.prescriptionKey, exerciseName, choice),
    });
  } else if (!open && mine[0] && completed.length === 0) {
    kept.push({
      ...mine[0],
      completed: false,
      prescriptionKey: prescriptionWithBikeChoice(mine[0].prescriptionKey, exerciseName, choice),
    });
  }
  const renumbered = kept.map((set, index) => ({ ...set, setNumber: index + 1 }));
  const before = sets.slice(0, first).filter((set) => set.exerciseName !== exerciseName);
  const after = sets.slice(first).filter((set) => set.exerciseName !== exerciseName);
  return [...before, ...renumbered, ...after];
}

export type BikeHistorySet = {
  exerciseName: string;
  completed: boolean;
  durationSeconds?: number | null;
  prescriptionKey?: string | null;
};

export type BikeHistorySession = {
  id: string;
  title: string;
  performedAt: Date | string;
  sets: readonly BikeHistorySet[];
};

export type BikeHistoryRow = {
  id: string;
  sessionId: string;
  performedAt: Date;
  title: string;
  workoutName: string;
  recipe: string;
  workSeconds: number | null;
  restSeconds: number | null;
  sprints: number | null;
  rounds: number | null;
  restBetweenRoundsSeconds: number;
  completed: boolean;
  doneSets: number;
  totalSets: number;
};

function intervalFromProgramKey(key: string) {
  const cut = key.indexOf(MARK);
  const base = cut === -1 ? key : key.slice(0, cut);
  if (base.startsWith("added|")) return null;
  const scheme = base.split("|").pop() ?? "";
  const raw = scheme.includes("::") ? scheme.split("::").slice(1).join("::") : "";
  if (!raw) return null;
  const spaced = raw.replace(/(\d+)swork/gi, "$1s work").replace(/(\d+)srest/gi, "$1s rest");
  const parsed = parseBikeIntervalReps(spaced);
  if (!parsed) return null;
  const recipe =
    parsed.restSeconds > 0
      ? `${parsed.workSeconds}s work / ${parsed.restSeconds}s rest × ${parsed.roundsPerSet}`
      : `${parsed.workSeconds}s work × ${parsed.roundsPerSet}`;
  return { ...parsed, recipe };
}

export function bikeHistoryFromSessions(sessions: readonly BikeHistorySession[]): BikeHistoryRow[] {
  const rows: BikeHistoryRow[] = [];
  for (const session of sessions) {
    const groups = new Map<string, BikeHistorySet[]>();
    for (const set of session.sets) {
      const name = set.exerciseName.trim();
      if (!name) continue;
      const list = groups.get(name) ?? [];
      list.push(set);
      groups.set(name, list);
    }
    for (const [exerciseName, sets] of groups) {
      const choice = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((row) => row != null) ?? null;
      if (!choice && !isBikeIntervalName(exerciseName)) continue;
      const programmed = choice ? null : intervalFromProgramKey(sets[0]?.prescriptionKey ?? "");
      const spec = choice?.spec;
      const doneSets = sets.filter((set) => set.completed).length;
      rows.push({
        id: `${session.id}:${exerciseName}`,
        sessionId: session.id,
        performedAt: new Date(session.performedAt),
        title: session.title,
        workoutName: choice?.name ?? exerciseName,
        recipe: choice?.plain ?? programmed?.recipe ?? exerciseName,
        workSeconds: spec?.workSeconds ?? programmed?.workSeconds ?? null,
        restSeconds: spec?.restSeconds ?? programmed?.restSeconds ?? null,
        sprints: spec ? sprintCountForSpec(spec) : programmed?.roundsPerSet ?? null,
        rounds: spec ? Math.max(1, spec.repeatRounds ?? 1) : sets.length,
        restBetweenRoundsSeconds: spec?.restBetweenRoundsSeconds ?? 0,
        completed: sets.length > 0 && doneSets === sets.length,
        doneSets,
        totalSets: sets.length,
      });
    }
  }
  return rows;
}

export function bikeHistoryLine(session: BikeHistorySession) {
  const rows = bikeHistoryFromSessions([session]);
  if (rows.length === 0) return null;
  return rows
    .map((row) => {
      const parts = [row.workoutName];
      if (row.workSeconds != null && row.restSeconds != null) {
        parts.push(`${row.workSeconds}s/${row.restSeconds}s`);
      }
      if (row.sprints != null) parts.push(`${row.sprints} sprints`);
      if (row.rounds != null) parts.push(`${row.rounds} ${row.rounds === 1 ? "round" : "rounds"}`);
      parts.push(row.completed ? "completed" : "open");
      return parts.join(" · ");
    })
    .join(" · ");
}
