export type TodayStartSession = {
  kind: string;
  label: string;
  title: string;
  subtitle: string;
  dayId?: string;
  href?: string;
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
  href?: string;
};

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

/** First clause of the day focus. Bag days lead with the theme. */
export function sessionTheme(subtitle: string, fallback: string) {
  const head = subtitle.split("·")[0]?.trim() ?? "";
  if (head && !/^rest day$/i.test(head)) return head;
  return fallback.trim() || "Session";
}

export function todayStartLabel(action: Pick<TodayStartAction, "verb" | "modality" | "theme" | "minutes">) {
  const minutes = action.minutes > 0 ? ` · ~${action.minutes} min` : "";
  return `${action.verb} · ${action.modality} · ${action.theme}${minutes}`;
}

/**
 * One button for today. A draft on a real session is Resume.
 * Otherwise the first session not already finished today is Start today.
 */
export function todayStartAction(
  sessions: TodayStartSession[],
  draftIdForDay: (dayId: string) => string | undefined,
): TodayStartAction | null {
  const real = sessions.filter(
    (session) => session.kind !== "rest" && (session.dayId || session.href),
  );
  const inProgress = real.find((session) => session.dayId && draftIdForDay(session.dayId));
  const target = inProgress ?? real.find((session) => !session.completed);
  if (!target) return null;
  const draftId = target.dayId ? draftIdForDay(target.dayId) : undefined;
  return {
    verb: draftId ? "Resume" : "Start today",
    modality: sessionModality(target.kind),
    theme: sessionTheme(target.subtitle, target.label || target.title),
    minutes: Math.max(0, Math.round(target.minutes)),
    dayId: target.dayId,
    draftId,
    href: target.href,
  };
}
