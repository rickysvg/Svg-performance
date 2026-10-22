export type ChipMark = "complete" | "partial" | "none";

/**
 * A lime check means every planned session that day is done.
 * `dayLogged` comes from `completedLocalDayKeys` (something that day counts).
 * `completedSessionIds` is that same completion rule, split by program day,
 * so one finished session on a two-session day stays partial.
 */
export function chipMarkForDay(input: {
  plannedSessionIds: string[];
  completedSessionIds: string[];
  dayLogged: boolean;
}): ChipMark {
  if (!input.dayLogged) return "none";
  const planned = input.plannedSessionIds.filter((id) => id.length > 0);
  if (planned.length === 0) return "complete";
  const done = new Set(input.completedSessionIds);
  const finished = planned.filter((id) => done.has(id)).length;
  if (finished === planned.length) return "complete";
  return "partial";
}
