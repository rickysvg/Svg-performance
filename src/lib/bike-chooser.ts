/**
 * Rule-based assault / air bike workouts a member can swap onto today's bike.
 * No model calls. The choice rides on the set prescription key and, when the
 * session is saved, on the exercise rep string. No schema change.
 */

import type { BikeSession } from "@/lib/bike-sessions";
import {
  bikeSetDurationSeconds,
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

export function bikeChoiceMinutes(choice: BikeChoice) {
  return Math.max(1, Math.round(bikeSetDurationSeconds(choice.spec) / 60));
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

export function customBikeChoice(input: {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
}): BikeChoice | null {
  const workSeconds = clampInt(input.workSeconds, 1, 600);
  const restSeconds = clampInt(input.restSeconds, 0, 600);
  const rounds = clampInt(input.rounds, 1, 40);
  const warmupSeconds = clampInt(input.warmupSeconds ?? 0, 0, 900);
  const cooldownSeconds = clampInt(input.cooldownSeconds ?? 0, 0, 900);
  if (workSeconds == null || restSeconds == null || rounds == null || warmupSeconds == null || cooldownSeconds == null) {
    return null;
  }
  const plain = `${workSeconds}s work / ${restSeconds}s rest × ${rounds} · wu ${warmupSeconds} · cd ${cooldownSeconds}`;
  return {
    id: "custom",
    name: "Custom sprints",
    description: "Your sprint, rest, and count. Warm-up and cool-down are optional.",
    goal: "anaerobic",
    level: "intermediate",
    plain,
    spec: {
      workSeconds,
      restSeconds,
      roundsPerSet: rounds,
      warmupSeconds,
      cooldownSeconds,
    },
  };
}

export function formatBikeRecipe(choice: BikeChoice) {
  if (choice.id === "custom") return `${choice.plain} · bw custom`;
  return `${choice.plain} · bw ${choice.id}`;
}

export function plainBikeReps(reps: string) {
  return reps.replace(/\s*·\s*bw\s+[a-z0-9-]+\s*$/i, "").trim();
}

export function parseBikeRecipe(reps: string): BikeChoice | null {
  const tag = reps.match(/·\s*bw\s+([a-z0-9-]+)\s*$/i);
  if (!tag) return null;
  const id = tag[1]!.toLowerCase();
  if (id === "custom") {
    const interval = reps.match(/(\d+)\s*s\s*work\s*\/\s*(\d+)\s*s\s*rest\s*[×x]\s*(\d+)/i);
    if (!interval) return null;
    const warmup = reps.match(/·\s*wu\s*(\d+)/i);
    const cooldown = reps.match(/·\s*cd\s*(\d+)/i);
    return customBikeChoice({
      workSeconds: Number(interval[1]),
      restSeconds: Number(interval[2]),
      rounds: Number(interval[3]),
      warmupSeconds: warmup ? Number(warmup[1]) : 0,
      cooldownSeconds: cooldown ? Number(cooldown[1]) : 0,
    });
  }
  return bikeChoiceById(id);
}

const MARK = "#bw:";

export function choiceToken(choice: BikeChoice) {
  if (choice.id !== "custom") return choice.id;
  const spec = choice.spec;
  return `c.${spec.workSeconds}.${spec.restSeconds}.${spec.roundsPerSet}.${spec.warmupSeconds ?? 0}.${spec.cooldownSeconds ?? 0}`;
}

export function choiceFromToken(token: string): BikeChoice | null {
  if (token.startsWith("c.")) {
    const [work, rest, rounds, warmup, cooldown] = token.slice(2).split(".").map(Number);
    return customBikeChoice({
      workSeconds: work ?? Number.NaN,
      restSeconds: rest ?? Number.NaN,
      rounds: rounds ?? Number.NaN,
      warmupSeconds: warmup,
      cooldownSeconds: cooldown,
    });
  }
  return bikeChoiceById(token);
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
      reps: formatBikeRecipe(choice),
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
