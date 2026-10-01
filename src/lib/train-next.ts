export type TrainActionSession = {
  title: string;
  kind: string;
  dayId?: string;
  href?: string;
};

export type NextTrainAction = {
  verb: "Start" | "Resume" | "Open";
  title: string;
  dayId?: string;
  draftId?: string;
  href?: string;
};

/** First real session on the selected day. A draft on that session is Resume. */
export function nextTrainAction(
  sessions: TrainActionSession[],
  draftIdForDay: (dayId: string) => string | undefined,
): NextTrainAction | null {
  const target = sessions.find(
    (session) => session.kind !== "rest" && (session.dayId || session.href),
  );
  if (!target) return null;
  const draftId = target.dayId ? draftIdForDay(target.dayId) : undefined;
  if (draftId) {
    return {
      verb: "Resume",
      title: target.title,
      dayId: target.dayId,
      draftId,
      href: target.href,
    };
  }
  if (target.dayId) {
    return { verb: "Start", title: target.title, dayId: target.dayId, href: target.href };
  }
  if (target.href) {
    return { verb: "Open", title: target.title, href: target.href };
  }
  return null;
}
