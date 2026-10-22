export type ChipMark = "complete" | "partial" | "none";

/**
 * A lime check means every planned session that day is done.
 * `dayLogged` comes from `completedLocalDayKeys` (a day that passes the
 * full-prescription rule). `partial` is a shorter log on that civil day:
 * ticked sets that do not finish the prescription. A short log is not a check
 * and it is not an empty chip.
 */
export function chipMarkForDay(input: {
  plannedSessionIds: string[];
  completedSessionIds: string[];
  dayLogged: boolean;
  partial?: boolean;
}): ChipMark {
  if (!input.dayLogged && !input.partial) return "none";
  const planned = input.plannedSessionIds.filter((id) => id.length > 0);
  if (planned.length === 0) return input.dayLogged ? "complete" : "partial";
  const done = new Set(input.completedSessionIds);
  const finished = planned.filter((id) => done.has(id)).length;
  if (input.dayLogged && finished === planned.length) return "complete";
  if (input.partial || finished > 0 || input.dayLogged) return "partial";
  return "none";
}
