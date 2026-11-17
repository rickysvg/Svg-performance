import { sessionCompletionDay } from "@/lib/performed-at";
import { draftHasResumeWork, sessionFinishSealed, type TickedSet } from "@/lib/logged-work";
import { sessionProgress } from "@/lib/session-progress";
import { visibleDoseForSession, type MemberExerciseEdits } from "@/lib/finish-plan";
import { trainingBlockKey } from "@/lib/exercise-swap";

export type ResumableLog = {
  id: string;
  status: string;
  performedAt: Date;
  createdAt?: Date;
  /** Set when Finish froze the clock. A draft save leaves this empty. */
  finishedAt?: Date | string | null;
  programDayId: string | null;
  /** Applied My Workout log. It is not the free custom resume. */
  dayPlanId?: string | null;
  plannedSetCount?: number | null;
  sets: TickedSet[];
  programDay?: {
    dayNumber?: number;
    program?: { slug: string };
    exercises?: { name?: string | null; sets?: number | null }[];
  } | null;
};

export type OpenProgramLog = {
  id: string;
  /** A short save or status partial. A plain draft is false. */
  partial: boolean;
  ticked: number;
  planned: number;
  /** "1/34 sets · Partial" when the save is short. Same string as History. */
  progress?: string;
};

/** Same shape `calendarPlanDoses` returns. A later plan-doses module can pass it through. */
export type PlanDose = {
  dose: number;
  names: readonly string[];
  exercises?: readonly { name?: string | null; sets?: number | null }[];
};

export type NewestDaySession = {
  id: string;
  /**
   * One label for Home, Train's day card, and Train's Today.
   * resume: the newest session is an open draft or a partial bag/skill day.
   * done: the newest session is finished (status complete, including a short dose).
   */
  label: "resume" | "done";
  partial: boolean;
  ticked: number;
  planned: number;
  progress?: string;
};

/**
 * For each program day on this civil day, the newest session that counts wins.
 * An open draft or a partial bag/skill day is in progress. A finished session
 * is done, including a short dose. An empty draft and an abandoned row do not
 * count, so a blank second tab does not hide a partial that is still open.
 * Newest is the latest performedAt, then createdAt. Any input order is fine.
 * `planByDay` is the scaled dose from `calendarPlanDoses`.
 */
export function newestDaySession(
  sessions: ResumableLog[],
  onDay: string,
  timeZone: string,
  planByDay?: ReadonlyMap<string, PlanDose>,
  visibleEdits?: { edits: MemberExerciseEdits; anchor?: Date | null } | null,
) {
  const ordered = sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => {
      const performed = b.session.performedAt.getTime() - a.session.performedAt.getTime();
      if (performed !== 0) return performed;
      const created = (b.session.createdAt?.getTime() ?? 0) - (a.session.createdAt?.getTime() ?? 0);
      if (created !== 0) return created;
      return a.index - b.index;
    })
    .map((row) => row.session);
  const map = new Map<string, NewestDaySession>();
  for (const session of ordered) {
    if (!session.programDayId) continue;
    if (sessionCompletionDay(session, timeZone) !== onDay) continue;
    if (session.status === "abandoned") continue;
    if (map.has(session.programDayId)) continue;
    const untouchedDraft = session.status === "draft" && !draftHasResumeWork(session.sets);
    if (untouchedDraft) continue;
    const exercises = session.programDay?.exercises ?? [];
    const plan = planByDay?.get(session.programDayId);
    const names =
      plan && plan.names.length > 0
        ? [...plan.names]
        : exercises.map((exercise) => exercise.name ?? "");
    const scaledExercises =
      plan?.exercises && plan.exercises.length > 0 ? plan.exercises : exercises;
    const dose = plan && plan.dose > 0 ? plan.dose : undefined;
    const shown = visibleEdits
      ? visibleDoseForSession({
          exercises: scaledExercises,
          catalogDose: dose,
          sessionId: session.id,
          blockKey: trainingBlockKey(session.performedAt, timeZone, visibleEdits.anchor),
          programSlug: session.programDay?.program?.slug,
          dayNumber: session.programDay?.dayNumber,
          edits: visibleEdits.edits,
          loggedSets: session.sets,
        })
      : null;
    const progress = sessionProgress(session, {
      dose: shown?.dose ?? dose,
      names: shown?.names ?? names,
      exercises: shown?.exercises ?? scaledExercises,
    });
    // Finish seals a full log and a short one. A Save draft is not sealed.
    if (sessionFinishSealed(session)) {
      map.set(session.programDayId, {
        id: session.id,
        label: "done",
        partial: false,
        ticked: progress.ticked,
        planned: progress.planned,
      });
      continue;
    }
    const partial = session.status !== "draft";
    map.set(session.programDayId, {
      id: session.id,
      label: "resume",
      partial,
      ticked: progress.ticked,
      planned: progress.planned,
      progress: partial ? progress.text : undefined,
    });
  }
  return map;
}

/**
 * Open logs only. A finished day is omitted. Same newest-session rule as
 * `newestDaySession`: a newer saved draft stays resumable after a finish,
 * and a newer finish hides an older draft.
 */
export function openLogsByProgramDay(
  sessions: ResumableLog[],
  onDay: string,
  timeZone: string,
  planByDay?: ReadonlyMap<string, PlanDose>,
  visibleEdits?: { edits: MemberExerciseEdits; anchor?: Date | null } | null,
) {
  const map = new Map<string, OpenProgramLog>();
  for (const [dayId, face] of newestDaySession(sessions, onDay, timeZone, planByDay, visibleEdits)) {
    if (face.label !== "resume") continue;
    map.set(dayId, {
      id: face.id,
      partial: face.partial,
      ticked: face.ticked,
      planned: face.planned,
      progress: face.progress,
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
    if (sessionFinishSealed(session)) continue;
    if (session.status === "draft" && !draftHasResumeWork(session.sets)) continue;
    const progress = sessionProgress(session);
    if (session.status === "complete" && progress.done) continue;
    const partial = session.status !== "draft";
    return {
      id: session.id,
      partial,
      ticked: progress.ticked,
      planned: progress.planned,
      progress: partial ? progress.text : undefined,
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
  /** "1/34 sets · Partial" when a short save is already on this session. */
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
  mobility: "Mobility",
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
