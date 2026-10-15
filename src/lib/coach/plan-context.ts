import { getActiveCampSnapshot } from "@/lib/fight-camp";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { rirFromLoadText } from "@/lib/rir";
import { DELOAD_LABEL, TESTING_LABEL, isDeloadWeek, isTestingWeek } from "@/lib/training-cycle";
import { convertLoad } from "@/lib/units";
import { planForDate, resolvePlanSessions } from "@/lib/week-plan";
import { getPreviousLoadsForUser, listRecentSessionsForUser } from "@/lib/workouts";

const PLAN_CONTEXT_CAP = 1200;

type PlanExercise = {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
};

const EXERCISE_ALIASES: Array<{ message: RegExp; name: RegExp }> = [
  { message: /\brdls?\b|romanian/i, name: /rdl|romanian|deadlift/i },
  { message: /\bdeadlifts?\b/i, name: /deadlift/i },
  { message: /\bsquats?\b/i, name: /squat/i },
  { message: /\bbench\b/i, name: /bench/i },
  { message: /\bpress\b/i, name: /press/i },
  { message: /\brows?\b/i, name: /\brow\b/i },
  { message: /\bpull-?ups?\b/i, name: /pull-?up/i },
  { message: /\bplanks?\b/i, name: /plank/i },
];

function exercisesOf(day: unknown): PlanExercise[] {
  if (!day || typeof day !== "object" || !("exercises" in day)) return [];
  const rows = (day as { exercises?: unknown }).exercises;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Partial<PlanExercise>;
    if (!item.name) return [];
    return [
      {
        name: item.name,
        sets: Number(item.sets ?? 0),
        reps: String(item.reps ?? ""),
        loadText: String(item.loadText ?? ""),
      },
    ];
  });
}

function lbsText(value: number | null | undefined, unit: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  const from = unit === "kg" ? "kg" : "lb";
  const lbs = Math.round(convertLoad(value, from, "lb"));
  return `${lbs} lbs`;
}

function mentionedNames(message: string, known: string[]) {
  const hits = new Set<string>();
  const text = message.toLowerCase();
  for (const name of known) {
    if (name && text.includes(name.toLowerCase())) hits.add(name);
    for (const alias of EXERCISE_ALIASES) {
      if (alias.message.test(message) && alias.name.test(name)) hits.add(name);
    }
  }
  return [...hits].slice(0, 4);
}

function clip(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= PLAN_CONTEXT_CAP) return trimmed;
  return trimmed.slice(0, PLAN_CONTEXT_CAP).replace(/\s+\S*$/, "").trim();
}

/**
 * Short plan block for programming answers. This member only.
 * Empty string when nothing is on file. Never includes body weight.
 */
export async function buildPlanContext(userId: string, message = ""): Promise<string> {
  try {
    const timeZone = await timeZoneForUser(userId);
    const now = new Date();
    const profile = await getProfileForUser(userId);
    const [catalog, recent, camp] = await Promise.all([
      findDemoTrainingCatalog(),
      listRecentSessionsForUser(userId, 3),
      getActiveCampSnapshot(userId, now, timeZone),
    ]);
    const lines: string[] = [];
    if (isDeloadWeek(now, timeZone)) lines.push(DELOAD_LABEL);
    else if (isTestingWeek(now, timeZone)) lines.push(TESTING_LABEL);
    if (camp && camp.phase !== "complete") {
      const week = camp.weekNumber ? `week ${camp.weekNumber}` : "pre-camp";
      lines.push(`Fight camp: ${camp.phaseLabel}, ${week}, ${camp.daysToFight} days to fight.`);
    }

    const today = planForDate(
      {
        primaryFocus: profile?.primaryFocus,
        weeklyAvailability: profile?.weeklyAvailability ?? [],
        sessionsPerWeek: profile?.sessionsPerWeek ?? null,
        trainingFocus: profile?.trainingFocus,
        liftDaysPerWeek: profile?.liftDaysPerWeek,
        experienceLevel: profile?.experienceLevel,
        outsideTraining: profile?.outsideTraining,
      },
      now,
      timeZone,
    );
    const resolved = resolvePlanSessions(today, catalog);
    const active = resolved.filter((session) => session.kind !== "rest" && session.day);
    if (active.length > 0) {
      lines.push(
        `Today (${today.weekday}): ${active.map((session) => session.title).join("; ")}.`,
      );
    } else if (resolved[0]) {
      lines.push(`Today (${today.weekday}): ${resolved[0].title}.`);
    }

    const prescribed = active.flatMap((session) => exercisesOf(session.day)).slice(0, 6);
    for (const exercise of prescribed) {
      const rir = rirFromLoadText(exercise.loadText);
      const scheme = [
        exercise.sets ? `${exercise.sets} sets` : "",
        exercise.reps ? `× ${exercise.reps}` : "",
        rir ? `@ ${rir}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (scheme) lines.push(`Prescribed ${exercise.name}: ${scheme}.`);
    }

    for (const session of recent) {
      const when = session.performedAt.toISOString().slice(0, 10);
      const sample = session.sets
        .slice(0, 2)
        .map((set) => {
          const load = lbsText(set.loadValue, set.loadUnit);
          return [set.exerciseName, load].filter(Boolean).join(" ");
        })
        .filter(Boolean);
      lines.push(
        `Logged ${when} ${session.title}${sample.length ? `: ${sample.join("; ")}` : ""}.`,
      );
    }

    const known = [
      ...prescribed.map((exercise) => exercise.name),
      ...recent.flatMap((session) => session.sets.map((set) => set.exerciseName)),
    ];
    const names = mentionedNames(message, known);
    if (names.length > 0) {
      const previous = await getPreviousLoadsForUser(userId, names);
      for (const name of names) {
        const sets = previous[name];
        const first = sets ? Object.values(sets)[0] : undefined;
        if (!first) continue;
        const load = lbsText(first.loadValue, first.loadUnit);
        const detail = [load, first.rir].filter(Boolean).join(", ");
        if (detail) lines.push(`Last logged ${name}: ${detail} (your last logged set).`);
      }
    }

    return clip(lines.join("\n"));
  } catch {
    return "";
  }
}
