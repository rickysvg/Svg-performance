/**
 * Saved-workout rules. No database and no model calls, so the logger can use it.
 * Applying a list changes one civil day. It does not move week index or other days.
 */
import { isDurationMode, resolveLogMode } from "@/lib/exercise-log-mode";
import { parseAddedPlan } from "@/lib/logger-insert";
import { memberFacingTitle } from "@/lib/member-copy";
import { rirFromLoadText } from "@/lib/rir";
import { APP_TIMEZONE } from "@/lib/timezone";

export type SavedExercise = {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  rir: string;
  logMode: string;
  notes: string;
};

export type DayPlanMode = "replace" | "extra";

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string) {
  if (!DAY_KEY.test(value)) return false;
  const [, month, day] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function isDayPlanMode(value: string): value is DayPlanMode {
  return value === "replace" || value === "extra";
}

export function defaultSavedWorkoutName(input: { title: string; date: Date; timeZone?: string }) {
  const zone = input.timeZone || APP_TIMEZONE;
  const day = memberFacingTitle(input.title).trim() || "Workout";
  const dated = input.date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone,
  });
  return `${day} · ${dated}`.slice(0, 80);
}

export function cleanSavedName(name: string, fallback: string) {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 80);
  return trimmed || fallback.trim().replace(/\s+/g, " ").slice(0, 80) || "My workout";
}

export function formatLastUsed(date: Date | null, timeZone = APP_TIMEZONE) {
  if (!date) return "Not used yet";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function text(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function sanitizeSavedExercises(raw: unknown): SavedExercise[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: SavedExercise[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = text(item.name, 80);
    if (!name) continue;
    const reps = text(item.reps, 40);
    out.push({
      name,
      sets: clampInt(item.sets, 1, 12, 1),
      reps,
      loadText: text(item.loadText, 80),
      restSeconds: clampInt(item.restSeconds, 0, 600, 60),
      rir: text(item.rir, 24),
      logMode: resolveLogMode({ logMode: text(item.logMode, 20), name, reps }),
      notes: text(item.notes, 200),
    });
    if (out.length >= 40) break;
  }
  return out;
}

function loadNote(values: Array<{ loadValue?: number | null; loadUnit?: string | null }>) {
  const labels: string[] = [];
  for (const row of values) {
    if (row.loadValue == null || !Number.isFinite(row.loadValue) || row.loadValue <= 0) continue;
    const unit = (row.loadUnit || "lb").trim() || "lb";
    const shown = Number.isInteger(row.loadValue) ? String(row.loadValue) : String(row.loadValue);
    const label = `${shown} ${unit}`;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.join(" / ").slice(0, 80);
}

function consistentNumber(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  if (nums.length === 0) return "";
  const first = nums[0]!;
  return nums.every((value) => value === first) ? String(first) : "";
}

type ProgramLike = {
  name: string;
  reps?: string;
  restSeconds?: number;
  loadText?: string;
  logMode?: string;
  notes?: string;
};

type SetLike = {
  exerciseName: string;
  sortOrder?: number;
  setNumber?: number;
  reps?: number | null;
  loadValue?: number | null;
  loadUnit?: string | null;
  logMode?: string | null;
  rir?: string | null;
  notes?: string | null;
  prescriptionKey?: string | null;
  durationSeconds?: number | null;
};

export function exercisesFromLoggedSets(sets: SetLike[], program: ProgramLike[] = []): SavedExercise[] {
  const ordered = [...sets].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.setNumber ?? 0) - (b.setNumber ?? 0),
  );
  const names: string[] = [];
  const groups = new Map<string, SetLike[]>();
  for (const set of ordered) {
    const name = set.exerciseName.trim();
    if (!name) continue;
    if (!groups.has(name)) names.push(name);
    const list = groups.get(name) ?? [];
    list.push(set);
    groups.set(name, list);
  }
  const saved: SavedExercise[] = [];
  for (const name of names) {
    const group = groups.get(name) ?? [];
    const planned = program.find((row) => row.name === name);
    const added = parseAddedPlan(group[0]?.prescriptionKey);
    const mode = resolveLogMode({
      logMode: group[0]?.logMode || planned?.logMode,
      name,
      reps: added?.reps || planned?.reps || "",
    });
    let reps = consistentNumber(group.map((set) => set.reps)) || added?.reps || planned?.reps || "";
    if (!reps && isDurationMode(mode)) {
      const seconds = consistentNumber(group.map((set) => set.durationSeconds));
      if (seconds) reps = `${seconds} sec`;
    }
    const loggedLoad = loadNote(group);
    const loadText = loggedLoad || planned?.loadText || added?.loadText || "";
    const rir =
      group.map((set) => (set.rir ?? "").trim()).find(Boolean) ||
      rirFromLoadText(loadText) ||
      rirFromLoadText(planned?.loadText) ||
      "";
    const notes =
      [...new Set(group.map((set) => (set.notes ?? "").trim()).filter(Boolean))].join("; ").slice(0, 200) ||
      planned?.notes ||
      added?.notes ||
      "";
    const row = sanitizeSavedExercises([
      {
        name,
        sets: group.length,
        reps,
        loadText,
        restSeconds: added?.restSeconds ?? planned?.restSeconds ?? 60,
        rir,
        logMode: mode,
        notes,
      },
    ])[0];
    if (row) saved.push(row);
  }
  return saved;
}

export type LoggerGroupSnapshot = {
  name: string;
  restSeconds: number;
  planned?: { reps?: string; loadText?: string; notes?: string; logMode?: string } | null;
  sets: Array<Omit<SetLike, "exerciseName">>;
};

/** Current logger order, including swaps and inserts, using the rest showing on each card. */
export function exercisesFromLoggerGroups(groups: LoggerGroupSnapshot[]): SavedExercise[] {
  const flat: SetLike[] = [];
  const program: ProgramLike[] = [];
  groups.forEach((group, index) => {
    const name = group.name.trim();
    if (!name) return;
    program.push({
      name,
      reps: group.planned?.reps,
      restSeconds: group.restSeconds,
      loadText: group.planned?.loadText,
      notes: group.planned?.notes,
      logMode: group.planned?.logMode,
    });
    group.sets.forEach((set, setIndex) => {
      flat.push({
        ...set,
        exerciseName: name,
        sortOrder: index * 20 + setIndex,
        setNumber: setIndex + 1,
        prescriptionKey: undefined,
      });
    });
  });
  return exercisesFromLoggedSets(flat, program);
}

export function exerciseCountLabel(count: number) {
  return `${count} ${count === 1 ? "exercise" : "exercises"}`;
}

export function applyPlansToProgramCards<T>(cards: T[], plans: { mode: string }[]) {
  const replaced = plans.some((plan) => plan.mode === "replace");
  return { cards: replaced ? [] : cards, replaced };
}

export type HomeDayPlan = {
  id: string;
  mode: string;
  name: string;
  exerciseNames: string[];
  exercises: { name: string; sets: number; restSeconds: number }[];
  complete: boolean;
  partial: boolean;
  draftId: string | null;
};

/** Home card id for an applied My Workout. It does not collide with a program day id. */
export function homePlanDayId(planId: string) {
  return `plan:${planId}`;
}

export function homePlanSession(plan: HomeDayPlan) {
  return {
    slot: "A" as const,
    kind: "strength" as const,
    label: plan.mode === "replace" ? "Your workout" : "Extra session",
    title: plan.name,
    subtitle: plan.exerciseNames.slice(0, 4).join(" · "),
    optional: plan.mode !== "replace",
    dayId: homePlanDayId(plan.id),
    href: `/training/my-workouts/day/${plan.id}`,
    startHref: plan.draftId
      ? `/training/log/${plan.draftId}`
      : `/training/my-workouts/day/${plan.id}/start`,
    day: {
      title: plan.name,
      focus: "",
      exercises: plan.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        restSeconds: exercise.restSeconds,
      })),
    },
  };
}

/** Replace hides the program day. Extra keeps it and adds the saved workout. */
export function homeSessionsAfterPlans<T>(sessions: T[], plans: HomeDayPlan[]): Array<T | ReturnType<typeof homePlanSession>> {
  if (plans.length === 0) return sessions;
  const cards = plans.map(homePlanSession);
  if (plans.some((plan) => plan.mode === "replace")) return cards;
  return [...sessions, ...cards];
}

export function summaryAfterDayPlans(programSummary: string, plans: { mode: string; name: string }[]) {
  if (!plans.some((plan) => plan.mode === "replace")) return programSummary;
  const names = plans.map((plan) => plan.name.trim()).filter(Boolean);
  return names.join(" · ") || programSummary;
}

type OverlayPlan = {
  id: string;
  name: string;
  mode: string;
  exerciseCount: number;
  complete: boolean;
  partial?: boolean;
  exerciseNames?: string[];
};

function activityWasLogged(activity: { kind: string; status?: string; subtitle?: string }) {
  if (activity.kind !== "workout") return false;
  if (activity.status === "complete") return true;
  const subtitle = activity.subtitle ?? "";
  return subtitle.startsWith("Logged this day") || subtitle.startsWith("Partial") || subtitle.includes("· Partial");
}

export function withDayPlans<T extends { kind: string }>(activities: T[], plans: OverlayPlan[]): T[] {
  const replaced = plans.some((plan) => plan.mode === "replace");
  const kept = replaced
    ? activities.filter((activity) => {
        if (activity.kind !== "workout") return true;
        return activityWasLogged(activity as { kind: string; status?: string; subtitle?: string });
      })
    : [...activities];
  const custom = plans.map((plan) => {
    const preview = (plan.exerciseNames ?? []).slice(0, 3).join(" · ");
    const count = exerciseCountLabel(plan.exerciseCount);
    const role = plan.mode === "replace" ? "Your workout" : "Extra session";
    return {
      kind: "workout",
      title: plan.name,
      subtitle: plan.complete
      ? `${plan.name} · Done`
      : plan.partial
        ? `${plan.name} · Partial`
        : preview
          ? `${role} · ${count} · ${preview}`
          : `${role} · ${count}`,
      href: `/training/my-workouts/day/${plan.id}`,
      status: plan.complete ? "complete" : "scheduled",
      customPlan: true,
      customPlanId: plan.id,
    };
  });
  return [...kept, ...(custom as unknown as T[])];
}
