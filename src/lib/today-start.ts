import { sessionCompletionDay } from "@/lib/performed-at";
import {
  exerciseSetProgress,
  partialSetsLine,
  prescribedSetTotal,
  progressTotals,
  sessionCountsAsPlannedCompletion,
  draftHasResumeWork,
  type TickedSet,
} from "@/lib/logged-work";

export type ResumableLog = {
  id: string;
  status: string;
  performedAt: Date;
  createdAt?: Date;
  programDayId: string | null;
  /** Applied My Workout log. It is not the free custom resume. */
  dayPlanId?: string | null;
  plannedSetCount?: number | null;
  sets: TickedSet[];
  programDay?: { exercises?: { name?: string | null; sets?: number | null }[] } | null;
};

export type OpenProgramLog = {
  id: string;
  /** A short save or status partial. A plain draft is false. */
  partial: boolean;
  ticked: number;
  planned: number;
  /** "Partial · 1/34 sets" when the save is short. */
  progress?: string;
};

/** Same shape `calendarPlanDoses` returns. A later plan-doses module can pass it through. */
export type PlanDose = {
  dose: number;
  names: readonly string[];
};

/**
 * Newest session on this civil day that is still open: a draft, a partial,
 * or a short save that did not finish the prescription. A finished day is omitted.
 * Sessions must be newest first. An empty draft, and a draft whose only numbers
 * are an unticked library prefill, never claim the day. A real partial save
 * still shows when a second tab started a newer blank draft.
 * `planByDay` is the scaled dose from `calendarPlanDoses`.
 */
export function openLogsByProgramDay(
  sessions: ResumableLog[],
  onDay: string,
  timeZone: string,
  planByDay?: ReadonlyMap<string, PlanDose>,
) {
  const map = new Map<string, OpenProgramLog>();
  const finished = new Set<string>();
  for (const session of sessions) {
    if (!session.programDayId) continue;
    if (sessionCompletionDay(session, timeZone) !== onDay) continue;
    if (session.status === "abandoned") continue;
    const untouchedDraft = session.status === "draft" && !draftHasResumeWork(session.sets);
    if (untouchedDraft) continue;
    const exercises = session.programDay?.exercises ?? [];
    const plan = planByDay?.get(session.programDayId);
    const names =
      plan && plan.names.length > 0
        ? [...plan.names]
        : exercises.map((exercise) => exercise.name ?? "");
    const dose = plan && plan.dose > 0 ? plan.dose : prescribedSetTotal(exercises);
    if (
      session.status === "complete" &&
      sessionCountsAsPlannedCompletion(session, names, dose)
    ) {
      finished.add(session.programDayId);
      const existing = map.get(session.programDayId);
      if (existing && !existing.partial) map.delete(session.programDayId);
      continue;
    }
    if (finished.has(session.programDayId) || map.has(session.programDayId)) continue;
    const totals = progressTotals(exerciseSetProgress(exercises, session.sets));
    const planned = plan && plan.dose > 0 ? plan.dose : totals.planned > 0 ? totals.planned : dose;
    const partial = session.status !== "draft";
    map.set(session.programDayId, {
      id: session.id,
      partial,
      ticked: totals.ticked,
      planned,
      progress: partial ? partialSetsLine(totals.ticked, planned) : undefined,
    });
  }
  return map;
}

/** Home key for a free or custom log that is not tied to a planned day. */
export const CUSTOM_HOME_RESUME = "custom";

/**
 * Newest custom or free session today that is ticked or edited.
 * A blank draft and a finished custom workout do not take Resume.
 * Sessions must be newest first.
 */
export function openCustomLog(
  sessions: ResumableLog[],
  onDay: string,
  timeZone: string,
): OpenProgramLog | null {
  for (const session of sessions) {
    if (session.programDayId || session.dayPlanId) continue;
    if (sessionCompletionDay(session, timeZone) !== onDay) continue;
    if (session.status === "abandoned") continue;
    if (session.status === "draft" && !draftHasResumeWork(session.sets)) continue;
    if (
      session.status === "complete" &&
      sessionCountsAsPlannedCompletion(session, [], session.plannedSetCount)
    ) {
      continue;
    }
    const totals = progressTotals(exerciseSetProgress([], session.sets));
    const planned =
      session.plannedSetCount && session.plannedSetCount > 0
        ? session.plannedSetCount
        : totals.planned;
    const partial = session.status !== "draft";
    return {
      id: session.id,
      partial,
      ticked: totals.ticked,
      planned,
      progress: partial ? partialSetsLine(totals.ticked, planned) : undefined,
    };
  }
  return null;
}

export type TodayStartSession = {
  kind: string;
  label: string;
  title: string;
  subtitle: string;
  dayId?: string;
  href?: string;
  logHref?: string;
  startHref?: string;
  minutes: number;
  completed?: boolean;
};

export type TodayStartAction = {
  verb: "Start today" | "Resume";
  modality: string;
  theme: string;
  minutes: number;
  dayId?: string;
  draftId?: string;
  partial?: boolean;
  ticked?: number;
  planned?: number;
  /** "Partial · 1/34 sets" when a short save is already on this session. */
  progress?: string;
  href?: string;
  logHref?: string;
  startHref?: string;
};

export type OpenLogRef = OpenProgramLog | string | undefined;

const MODALITY: Record<string, string> = {
  skill: "Skill",
  strength: "Strength",
  conditioning: "Conditioning",
  mobility: "Recovery",
  rest: "Rest",
};

export function sessionModality(kind: string) {
  return MODALITY[kind] ?? kind;
}

function isEstimateClause(value: string) {
  return /^(moderate pace\s*[·.]?\s*)?(est\.|~)\s*\d+\s*min\b/i.test(value) || /^est\.\s*\d+\s*min\b/i.test(value);
}

/** First clause of the day focus. Bag days lead with the theme, not a second minute estimate. */
export function sessionTheme(subtitle: string, fallback: string) {
  const clauses = subtitle
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !isEstimateClause(part) && !/^est\./i.test(part));
  const head = clauses[0] ?? "";
  if (head && !/^rest day$/i.test(head)) return head;
  return fallback.trim() || "Session";
}

export function todayStartLabel(
  action: Pick<TodayStartAction, "verb" | "modality" | "theme" | "minutes" | "progress">,
) {
  const minutes = action.minutes > 0 ? ` · ~${action.minutes} min` : "";
  const progress = action.progress ? ` · ${action.progress}` : "";
  return `${action.verb} · ${action.modality} · ${action.theme}${minutes}${progress}`;
}

function openLog(value: OpenLogRef) {
  if (!value) return undefined;
  if (typeof value === "string") {
    return {
      id: value,
      partial: false,
      ticked: 0,
      planned: 0,
      progress: undefined as string | undefined,
    };
  }
  return value;
}

/**
 * One button for today. A draft or a short save is Resume.
 * Otherwise the first session not already finished today is Start today.
 */
export function todayStartAction(
  sessions: TodayStartSession[],
  draftIdForDay: (dayId: string) => OpenLogRef,
): TodayStartAction | null {
  const real = sessions.filter(
    (session) => session.kind !== "rest" && (session.dayId || session.href),
  );
  const inProgress = real.find((session) => {
    if (!session.dayId || session.completed) return false;
    const open = openLog(draftIdForDay(session.dayId));
    return Boolean(open);
  });
  const target = inProgress ?? real.find((session) => !session.completed);
  if (!target) return null;
  const open = target.dayId ? openLog(draftIdForDay(target.dayId)) : undefined;
  return {
    verb: open ? "Resume" : "Start today",
    modality: sessionModality(target.kind),
    theme: sessionTheme(target.subtitle, target.label || target.title),
    minutes: Math.max(0, Math.round(target.minutes)),
    dayId: target.dayId,
    draftId: open?.id,
    partial: open?.partial,
    ticked: open?.ticked,
    planned: open?.planned,
    progress: open?.progress,
    href: target.href,
    logHref: target.logHref,
    startHref: target.startHref,
  };
}
