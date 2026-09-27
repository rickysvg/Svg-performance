import { resolveLogMode } from "@/lib/exercise-log-mode";
import { convertLoad, formatLoad, isLoadUnit, type LoadUnit } from "@/lib/units";

export const PR_KINDS = ["heaviest", "reps_at_weight", "e1rm", "longest"] as const;
export type PrKind = (typeof PR_KINDS)[number];

export type SetLike = {
  exerciseName: string;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  durationSeconds?: number | null;
  logMode?: string | null;
  completed?: boolean;
};

export type DatedSetLike = SetLike & { performedAt: Date };

export type PersonalBest = {
  kind: PrKind;
  exerciseName: string;
  value: number;
  unit: string;
  reps: number | null;
  load: number | null;
  date: Date;
};

export type DetectedPr = PersonalBest & {
  previousValue: number | null;
  headline: string;
  detail: string;
};

function logged(set: SetLike) {
  return set.completed !== false;
}

function loadInUnit(set: SetLike, displayUnit: LoadUnit): number | null {
  if (set.loadValue == null || !isLoadUnit(set.loadUnit)) return null;
  return Math.round(convertLoad(set.loadValue, set.loadUnit, displayUnit) * 10) / 10;
}

/** Epley estimated 1RM. Single reps count as the load itself. */
export function epley1rm(weight: number, reps: number) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function exerciseSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function findExerciseBySlug(names: string[], slug: string) {
  const wanted = slug.trim().toLowerCase();
  return names.find((name) => exerciseSlug(name) === wanted) ?? null;
}

function modeOf(set: SetLike) {
  return resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function deltaText(current: number, previous: number | null, unit: string) {
  if (previous == null || previous <= 0) return "first mark";
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return "tied your last best";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff} ${unit} on your last best`;
}

export function bestsFromSets(
  sets: DatedSetLike[],
  displayUnit: LoadUnit,
): PersonalBest[] {
  const heaviest = new Map<string, PersonalBest>();
  const repsAt = new Map<string, PersonalBest>();
  const e1rm = new Map<string, PersonalBest>();
  const longest = new Map<string, PersonalBest>();

  for (const set of sets) {
    if (!logged(set)) continue;
    const name = set.exerciseName.trim();
    if (!name) continue;
    const mode = modeOf(set);
    const load = loadInUnit(set, displayUnit);
    const reps = set.reps != null && set.reps > 0 ? set.reps : null;
    const seconds =
      set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : null;

    if (load != null && (mode === "load_reps" || mode === "load_timed")) {
      const current = heaviest.get(name);
      if (!current || load > current.value) {
        heaviest.set(name, {
          kind: "heaviest",
          exerciseName: name,
          value: load,
          unit: displayUnit,
          reps,
          load,
          date: set.performedAt,
        });
      }
    }

    if (load != null && reps != null && mode === "load_reps") {
      const key = `${name}::${load}`;
      const current = repsAt.get(key);
      if (!current || reps > current.value) {
        repsAt.set(key, {
          kind: "reps_at_weight",
          exerciseName: name,
          value: reps,
          unit: "reps",
          reps,
          load,
          date: set.performedAt,
        });
      }

      const estimate = epley1rm(load, reps);
      const currentE1 = e1rm.get(name);
      if (estimate > 0 && (!currentE1 || estimate > currentE1.value)) {
        e1rm.set(name, {
          kind: "e1rm",
          exerciseName: name,
          value: estimate,
          unit: displayUnit,
          reps,
          load,
          date: set.performedAt,
        });
      }
    }

    if (seconds != null && (mode === "timed" || mode === "load_timed" || mode === "timed_round")) {
      const current = longest.get(name);
      if (!current || seconds > current.value) {
        longest.set(name, {
          kind: "longest",
          exerciseName: name,
          value: seconds,
          unit: "sec",
          reps: null,
          load,
          date: set.performedAt,
        });
      }
    }
  }

  return [...heaviest.values(), ...repsAt.values(), ...e1rm.values(), ...longest.values()];
}

export function headlineForBest(best: PersonalBest) {
  if (best.kind === "longest") {
    return formatDuration(best.value);
  }
  if (best.kind === "reps_at_weight" && best.load != null) {
    return `${best.value} × ${formatLoad(best.load, best.unit === "kg" ? "kg" : "lb")}`;
  }
  if (best.kind === "e1rm") {
    return `${formatLoad(best.value, best.unit === "kg" ? "kg" : "lb")} e1RM`;
  }
  if (best.reps != null && best.reps > 0) {
    return `${formatLoad(best.value, best.unit === "kg" ? "kg" : "lb")} × ${best.reps}`;
  }
  return formatLoad(best.value, best.unit === "kg" ? "kg" : "lb");
}

function kindLabel(kind: PrKind) {
  if (kind === "heaviest") return "Heaviest";
  if (kind === "reps_at_weight") return "Most reps at a load";
  if (kind === "e1rm") return "Estimated 1RM";
  return "Longest hold";
}

export function detectNewPrs(
  priorSets: DatedSetLike[],
  sessionSets: DatedSetLike[],
  displayUnit: LoadUnit,
): DetectedPr[] {
  const prior = bestsFromSets(priorSets, displayUnit);
  const next = bestsFromSets(sessionSets, displayUnit);
  const found: DetectedPr[] = [];

  for (const best of next) {
    const previous = prior.find(
      (row) =>
        row.kind === best.kind &&
        row.exerciseName === best.exerciseName &&
        (best.kind !== "reps_at_weight" || row.load === best.load),
    );
    if (previous && best.value <= previous.value) continue;
    const unit =
      best.kind === "longest" ? "sec" : best.kind === "reps_at_weight" ? "reps" : displayUnit;
    found.push({
      ...best,
      previousValue: previous?.value ?? null,
      headline: headlineForBest(best),
      detail: `${best.exerciseName} · ${deltaText(best.value, previous?.value ?? null, unit)} · ${formatDate(best.date)}`,
    });
  }

  const rank: Record<PrKind, number> = {
    heaviest: 0,
    e1rm: 1,
    reps_at_weight: 2,
    longest: 3,
  };
  return found.sort((a, b) => rank[a.kind] - rank[b.kind] || b.value - a.value);
}

export function recordListFromBests(bests: PersonalBest[]) {
  const byExercise = new Map<string, PersonalBest[]>();
  for (const best of bests) {
    const list = byExercise.get(best.exerciseName) ?? [];
    list.push(best);
    byExercise.set(best.exerciseName, list);
  }

  return [...byExercise.entries()]
    .map(([exerciseName, rows]) => {
      const heaviest = rows.find((row) => row.kind === "heaviest");
      const longest = rows.find((row) => row.kind === "longest");
      const e1rm = rows.find((row) => row.kind === "e1rm");
      const primary = heaviest ?? longest ?? e1rm ?? rows[0]!;
      return {
        exerciseName,
        slug: exerciseSlug(exerciseName),
        primary,
        headline: headlineForBest(primary),
        kindLabel: kindLabel(primary.kind),
        date: primary.date,
        isNew: false,
      };
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
