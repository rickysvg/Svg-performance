/**
 * Chip marks after swaps and My Workouts day plans.
 * A lime check still means every session planned on that chip is done.
 * A moved workout follows the chip that shows it. A replace plan is the plan.
 * An off-plan log is Done or Partial, never a missed day.
 */

export type ChipDayRef = {
  dayParam: string;
  weekStart: string;
  sessionIds: string[];
};

export type ChipPlanMark = {
  id: string;
  mode: string;
  complete: boolean;
  partial: boolean;
};

export type OffPlanMark = {
  done: boolean;
  partial: boolean;
};

export function overlayChipSessionIds(programIds: readonly string[], plans: readonly ChipPlanMark[]) {
  const extras = plans.filter((plan) => plan.mode === "extra").map((plan) => plan.id);
  const replacements = plans.filter((plan) => plan.mode === "replace");
  if (replacements.length > 0) return [...replacements.map((plan) => plan.id), ...extras];
  return [...programIds.filter((id) => id.length > 0), ...extras];
}

/**
 * A completion stays on the day it was logged when that chip still shows the
 * program day. After a swap, it moves to the chip in the same week that shows it.
 */
export function realignProgramCompletions(
  days: readonly ChipDayRef[],
  completedByDay: Readonly<Record<string, readonly string[]>>,
) {
  const byWeek = new Map<string, ChipDayRef[]>();
  for (const day of days) {
    const list = byWeek.get(day.weekStart) ?? [];
    list.push(day);
    byWeek.set(day.weekStart, list);
  }
  const next: Record<string, string[]> = {};
  for (const [dayParam, ids] of Object.entries(completedByDay)) {
    const home = days.find((day) => day.dayParam === dayParam);
    const week = home ? (byWeek.get(home.weekStart) ?? [home]) : [];
    for (const id of ids) {
      const stays = Boolean(home && home.sessionIds.includes(id));
      const placed = stays ? home : (week.find((day) => day.sessionIds.includes(id)) ?? home);
      const key = placed?.dayParam ?? dayParam;
      const list = next[key] ?? [];
      if (!list.includes(id)) list.push(id);
      next[key] = list;
    }
  }
  return next;
}

export function chipMarksAfterPlans(input: {
  days: readonly ChipDayRef[];
  completedByDay: Readonly<Record<string, readonly string[]>>;
  partialDays: readonly string[];
  plansByDay: Readonly<Record<string, readonly ChipPlanMark[]>>;
  offPlan: Readonly<Record<string, OffPlanMark>>;
}) {
  const aligned = realignProgramCompletions(input.days, input.completedByDay);
  const partialProgramDays = new Set(input.partialDays);
  const sessionIdsByDay: Record<string, string[]> = {};
  const completedByDay: Record<string, string[]> = {};
  const partial = new Set<string>();
  const logged = new Set<string>();

  for (const day of input.days) {
    const plans = input.plansByDay[day.dayParam] ?? [];
    const replaced = plans.some((plan) => plan.mode === "replace");
    const sessionIds = overlayChipSessionIds(day.sessionIds, plans);
    sessionIdsByDay[day.dayParam] = sessionIds;
    const done = new Set<string>();
    if (!replaced) {
      for (const id of aligned[day.dayParam] ?? []) {
        if (sessionIds.includes(id)) done.add(id);
      }
    }
    for (const plan of plans) {
      if (plan.complete && sessionIds.includes(plan.id)) done.add(plan.id);
      if (plan.partial) partial.add(day.dayParam);
    }
    completedByDay[day.dayParam] = [...done];
    const off = input.offPlan[day.dayParam];
    const allDone = sessionIds.length > 0 && sessionIds.every((id) => done.has(id));
    const noPlanDone = sessionIds.length === 0 && Boolean(off?.done) && !off?.partial;
    if (allDone || noPlanDone) logged.add(day.dayParam);
    if (off?.partial) partial.add(day.dayParam);
    if (off?.done && sessionIds.length > 0 && !allDone) partial.add(day.dayParam);
    if (!replaced && partialProgramDays.has(day.dayParam) && !allDone) partial.add(day.dayParam);
    if (done.size > 0 && !allDone) partial.add(day.dayParam);
    if (allDone || noPlanDone) partial.delete(day.dayParam);
    if (plans.some((plan) => plan.partial)) {
      partial.add(day.dayParam);
      logged.delete(day.dayParam);
    }
  }

  return {
    sessionIdsByDay,
    completedByDay,
    partialDays: [...partial],
    loggedDays: [...logged],
  };
}

export function chipDayRefs(
  weeks: readonly {
    weekStart: string;
    days: readonly { dayParam: string; sessionIds?: readonly string[] }[];
  }[],
): ChipDayRef[] {
  return weeks.flatMap((week) =>
    week.days.map((day) => ({
      dayParam: day.dayParam,
      weekStart: week.weekStart,
      sessionIds: [...(day.sessionIds ?? [])],
    })),
  );
}

export function chipPlanMarksByDay(
  plans: readonly { id: string; dayKey: string; mode: string; complete: boolean; partial: boolean }[],
) {
  const plansByDay: Record<string, ChipPlanMark[]> = {};
  for (const plan of plans) {
    const list = plansByDay[plan.dayKey] ?? [];
    list.push({
      id: plan.id,
      mode: plan.mode,
      complete: plan.complete,
      partial: plan.partial,
    });
    plansByDay[plan.dayKey] = list;
  }
  return plansByDay;
}

export function withOverlaySessionIds<
  T extends { days: Array<{ dayParam: string; sessionIds?: string[] }> },
>(weeks: readonly T[], sessionIdsByDay: Readonly<Record<string, readonly string[]>>): T[] {
  return weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => ({
      ...day,
      sessionIds: [...(sessionIdsByDay[day.dayParam] ?? day.sessionIds ?? [])],
    })),
  }));
}
