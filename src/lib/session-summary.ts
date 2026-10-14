import { classifyCompletedWorkout, type WorkoutTypeKey } from "@/lib/difficulty";
import { parseStoredTags, tagsForExercise } from "@/lib/exercise-tags";
import { MESO_BLOCK_META, type MesoBlock } from "@/lib/mesocycle";

export type SessionSummaryKind = WorkoutTypeKey;

export type SessionSummaryExercise = {
  name: string;
  /** Comma-separated tags stored on the plan row, when the seed wrote them. */
  tags?: string | null;
};

export type SessionSummary = {
  kind: SessionSummaryKind;
  goal: string;
  targets: string[];
  payoff: string;
};

const TARGET_CAP = 4;

/** Warm-up tags. Keep them only when the session has room after the real work. */
const WARMUP_TAGS = new Set([
  "footwork",
  "hand speed",
  "shoulder endurance",
  "fight conditioning",
  "recovery",
]);

type BlockPhase = {
  label: string;
  intent: string;
};

function blockPhase(focus: string): BlockPhase | null {
  const match = focus.match(/Block\s+([ABC])/i);
  if (!match) return null;
  const block = match[1].toUpperCase() as MesoBlock;
  const meta = MESO_BLOCK_META[block];
  if (!meta) return null;
  return { label: meta.title, intent: meta.intent };
}

function focusJob(focus: string, title: string): string {
  const head = focus.split("·")[0]?.trim() ?? "";
  return head || title.trim();
}

function tagsFor(exercise: SessionSummaryExercise): string[] {
  const stored = parseStoredTags(exercise.tags);
  if (stored.length > 0) return stored;
  return tagsForExercise(exercise.name);
}

export function collectSessionTargets(exercises: SessionSummaryExercise[]): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const exercise of exercises) {
    for (const tag of tagsFor(exercise)) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(tag);
    }
  }
  if (targets.length <= TARGET_CAP) return targets;
  const specific = targets.filter((tag) => !WARMUP_TAGS.has(tag.toLowerCase()));
  const warmup = targets.filter((tag) => WARMUP_TAGS.has(tag.toLowerCase()));
  const ranked = specific.length > 0 ? [...specific, ...warmup] : targets;
  return ranked.slice(0, TARGET_CAP);
}

function listPhrase(tags: string[]): string {
  if (tags.length <= 1) return tags[0] ?? "this work";
  if (tags.length === 2) return `${tags[0]} and ${tags[1]}`;
  return `${tags.slice(0, -1).join(", ")}, and ${tags[tags.length - 1]}`;
}

function goalLine(kind: SessionSummaryKind, job: string, phase: BlockPhase | null): string {
  if (kind === "bag") {
    const theme = job.replace(/^Bag\s+[—-]\s+/i, "").trim() || "Bag work";
    if (phase) return `${theme}. ${phase.label} targets ${phase.intent}.`;
    return `${theme}. Sharpen the shots you actually throw.`;
  }
  if (kind === "bike") {
    const line = job || "Bike conditioning";
    return `${line}. Build the engine that keeps your work rate up late.`;
  }
  if (kind === "gpp") {
    if (phase) {
      return `General preparation so you can repeat hard efforts. ${phase.label} is ${phase.intent}.`;
    }
    return "General preparation so you can repeat hard efforts without falling apart.";
  }
  if (kind === "lift") {
    const clean = job.replace(/^Day\s+\d+\s+[—-]\s+/i, "").trim() || "Strength work";
    if (phase) return `${clean}. ${phase.label} supports ${phase.intent}.`;
    return `${clean}. Strength that shows up in your base and your shots.`;
  }
  return job || "Today's session.";
}

function payoffLine(kind: SessionSummaryKind, targets: string[], phase: BlockPhase | null): string {
  const list = listPhrase(targets.slice(0, 3));
  const phaseBit = phase ? ` That is what ${phase.label} (${phase.intent}) is for.` : "";
  if (kind === "bag") {
    return `Repeating ${list} is how a fighter keeps those weapons sharp when a round gets messy.${phaseBit}`;
  }
  if (kind === "bike") {
    return `Consistent ${list} is what lets a fighter recover while still working, instead of fading when the pace jumps.${phaseBit}`;
  }
  if (kind === "gpp") {
    return `Showing up for ${list} is the base under the skill work. A fighter who keeps this in the week still has legs late.${phaseBit}`;
  }
  if (kind === "lift") {
    return `Stay with ${list}. Those patterns hold a fighter's hips, brace, and shots together when they get tired.${phaseBit}`;
  }
  return `Keep ${list} in the week. That is what a fighter can still do when the pace rises.${phaseBit}`;
}

const KIND_FALLBACK: Record<SessionSummaryKind, string[]> = {
  bag: ["bag rounds"],
  lift: ["strength"],
  bike: ["aerobic conditioning"],
  gpp: ["general conditioning"],
  other: ["fight conditioning"],
};

export function summaryExercises(session: {
  sets: { exerciseName: string }[];
  programDay?: { exercises: { name: string; tags?: string | null }[] } | null;
}): SessionSummaryExercise[] {
  const planned = new Map(
    (session.programDay?.exercises ?? []).map((row) => [row.name, row.tags ?? ""]),
  );
  const names: string[] = [];
  const seen = new Set<string>();
  for (const set of session.sets) {
    if (!set.exerciseName || seen.has(set.exerciseName)) continue;
    seen.add(set.exerciseName);
    names.push(set.exerciseName);
  }
  if (names.length === 0) {
    for (const row of session.programDay?.exercises ?? []) {
      if (seen.has(row.name)) continue;
      seen.add(row.name);
      names.push(row.name);
    }
  }
  return names.map((name) => ({ name, tags: planned.get(name) ?? "" }));
}

export function buildSessionSummary(input: {
  title: string;
  programDayTitle?: string | null;
  programDayFocus?: string | null;
  exercises: SessionSummaryExercise[];
}): SessionSummary {
  const focus = input.programDayFocus?.trim() ?? "";
  const title = input.programDayTitle?.trim() || input.title.trim();
  const kind = classifyCompletedWorkout({
    title: input.title,
    programDayTitle: input.programDayTitle,
    programDayFocus: focus,
    exerciseNames: input.exercises.map((exercise) => exercise.name),
  });
  const phase = blockPhase(focus);
  const collected = collectSessionTargets(input.exercises);
  const targets = collected.length > 0 ? collected : KIND_FALLBACK[kind];
  const job = focusJob(focus, title);
  return {
    kind,
    goal: goalLine(kind, job, phase),
    targets,
    payoff: payoffLine(kind, targets, phase),
  };
}
