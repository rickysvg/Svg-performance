import type { OpenLogRef } from "@/lib/today-start";

export type TrainActionSession = {
  title: string;
  kind: string;
  dayId?: string;
  href?: string;
  startHref?: string;
};

export type NextTrainAction = {
  verb: "Start" | "Resume" | "Open";
  title: string;
  dayId?: string;
  draftId?: string;
  partial?: boolean;
  ticked?: number;
  planned?: number;
  progress?: string;
  href?: string;
  startHref?: string;
};

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
 * First real session on the selected day.
 * A short save and a draft are both Resume. A finished day is skipped.
 */
export function nextTrainAction(
  sessions: TrainActionSession[],
  draftIdForDay: (dayId: string) => OpenLogRef,
  completedDay?: (dayId: string) => boolean,
): NextTrainAction | null {
  const target = sessions.find((session) => {
    if (session.kind === "rest" || !(session.dayId || session.href)) return false;
    const open = session.dayId ? openLog(draftIdForDay(session.dayId)) : undefined;
    if (open?.partial) return true;
    if (session.dayId && completedDay?.(session.dayId)) return false;
    return true;
  });
  if (!target) return null;
  const open = target.dayId ? openLog(draftIdForDay(target.dayId)) : undefined;
  if (open) {
    return {
      verb: "Resume",
      title: target.title,
      dayId: target.dayId,
      draftId: open.id,
      partial: open.partial,
      ticked: open.ticked,
      planned: open.planned,
      progress: open.progress,
      href: target.href,
      startHref: target.startHref,
    };
  }
  if (target.dayId) {
    return {
      verb: "Start",
      title: target.title,
      dayId: target.dayId,
      href: target.href,
      startHref: target.startHref,
    };
  }
  if (target.href) {
    return { verb: "Open", title: target.title, href: target.href };
  }
  return null;
}
