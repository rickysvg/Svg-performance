import { isHoldName, resolveLogMode } from "@/lib/exercise-log-mode";
import { convertLoad, formatLoad, isLoadUnit, type LoadUnit } from "@/lib/units";

export const PR_KINDS = ["heaviest", "reps_at_weight", "e1rm", "most_rounds", "longest"] as const;
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

/** Unit the best value is stored in (for formatLoad → lbs display). */
function weightUnit(best: PersonalBest, displayUnit: LoadUnit): LoadUnit {
  if (best.unit === "kg" || best.unit === "lb") return best.unit;
  return displayUnit;
}

function deltaText(current: number, previous: number | null, unit: string) {
  if (previous == null || previous <= 0) return "first mark";
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return "tied your last best";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff} ${unit} on your last best`;
}

function isIsometricHold(set: SetLike) {
  if (!isHoldName(set.exerciseName)) return false;
  const mode = modeOf(set);
  return mode === "timed" || mode === "load_timed";
}

/** Bike / bag interval work — most completed rounds in a session, never hold time. */
function isIntervalRoundWork(set: SetLike) {
  if (isHoldName(set.exerciseName)) return false;
  return modeOf(set) === "timed_round";
}

export function bestsFromSets(
  sets: DatedSetLike[],
  displayUnit: LoadUnit,
): PersonalBest[] {
  const heaviest = new Map<string, PersonalBest>();
  const repsAt = new Map<string, PersonalBest>();
  const e1rm = new Map<string, PersonalBest>();
  const longest = new Map<string, PersonalBest>();
  const sessionRounds = new Map<string, { name: string; date: Date; count: number }>();

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

    if (isIntervalRoundWork(set)) {
      const key = `${name}::${set.performedAt.getTime()}`;
      const current = sessionRounds.get(key);
      if (current) {
        current.count += 1;
      } else {
        sessionRounds.set(key, { name, date: set.performedAt, count: 1 });
      }
    }

    if (seconds != null && isIsometricHold(set)) {
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

  const mostRounds = new Map<string, PersonalBest>();
  for (const row of sessionRounds.values()) {
    const current = mostRounds.get(row.name);
    if (!current || row.count > current.value) {
      mostRounds.set(row.name, {
        kind: "most_rounds",
        exerciseName: row.name,
        value: row.count,
        unit: "rounds",
        reps: row.count,
        load: null,
        date: row.date,
      });
    }
  }

  return [
    ...heaviest.values(),
    ...repsAt.values(),
    ...e1rm.values(),
    ...mostRounds.values(),
    ...longest.values(),
  ];
}

export function headlineForBest(best: PersonalBest, displayUnit: LoadUnit = "lb") {
  if (best.kind === "longest") {
    return formatDuration(best.value);
  }
  if (best.kind === "most_rounds") {
    return `${best.value} ${best.value === 1 ? "round" : "rounds"}`;
  }
  const unit = weightUnit(best, displayUnit);
  if (best.kind === "reps_at_weight" && best.load != null) {
    return `${best.value} × ${formatLoad(best.load, unit)}`;
  }
  if (best.kind === "e1rm") {
    return `${formatLoad(best.value, unit)} e1RM`;
  }
  if (best.reps != null && best.reps > 0) {
    return `${formatLoad(best.value, unit)} × ${best.reps}`;
  }
  return formatLoad(best.value, unit);
}

function kindLabel(kind: PrKind) {
  if (kind === "heaviest") return "Heaviest";
  if (kind === "reps_at_weight") return "Most reps at a load";
  if (kind === "e1rm") return "Estimated 1RM";
  if (kind === "most_rounds") return "Most rounds";
  return "Longest hold";
}

function valueUnit(best: PersonalBest, _displayUnit: LoadUnit) {
  if (best.kind === "longest") return "sec";
  if (best.kind === "reps_at_weight") return "reps";
  if (best.kind === "most_rounds") return "rounds";
  return "lb";
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
    found.push({
      ...best,
      previousValue: previous?.value ?? null,
      headline: headlineForBest(best, displayUnit),
      detail: `${best.exerciseName} · ${deltaText(best.value, previous?.value ?? null, valueUnit(best, displayUnit))} · ${formatDate(best.date)}`,
    });
  }

  const rank: Record<PrKind, number> = {
    heaviest: 0,
    e1rm: 1,
    reps_at_weight: 2,
    most_rounds: 3,
    longest: 4,
  };
  return found.sort((a, b) => rank[a.kind] - rank[b.kind] || b.value - a.value);
}

export function recordListFromBests(bests: PersonalBest[], displayUnit: LoadUnit = "lb") {
  const byExercise = new Map<string, PersonalBest[]>();
  for (const best of bests) {
    const list = byExercise.get(best.exerciseName) ?? [];
    list.push(best);
    byExercise.set(best.exerciseName, list);
  }

  return [...byExercise.entries()]
    .map(([exerciseName, rows]) => {
      const heaviest = rows.find((row) => row.kind === "heaviest");
      const mostRounds = rows.find((row) => row.kind === "most_rounds");
      const longest = rows.find((row) => row.kind === "longest");
      const e1rm = rows.find((row) => row.kind === "e1rm");
      const primary = heaviest ?? mostRounds ?? longest ?? e1rm ?? rows[0]!;
      return {
        exerciseName,
        slug: exerciseSlug(exerciseName),
        primary,
        headline: headlineForBest(primary, displayUnit),
        kindLabel: kindLabel(primary.kind),
        date: primary.date,
        isNew: false,
      };
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
