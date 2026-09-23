import { suggestDemoProgramDay } from "@/lib/onboarding";

/**
 * Maps DEMO Combat Skills day numbers to intake primaryFocus values.
 * ProgramDay.focus stays human-readable copy — do not treat it as a machine tag.
 */
export const SKILL_DAY_ARTS: Record<number, readonly string[]> = {
  1: ["mma", "muay-thai"],
  2: ["mma", "muay-thai"],
  3: ["boxing", "mma"],
  4: ["mma", "wrestling", "cagework"],
  5: ["wrestling", "mma", "cagework"],
  6: ["jiu-jitsu", "mma"],
};

export function usesMartialArtsDays(primaryFocus?: string | null) {
  return Boolean(primaryFocus && primaryFocus !== "general-fitness");
}

export function skillDayMatchesFocus(dayNumber: number, primaryFocus?: string | null) {
  if (!usesMartialArtsDays(primaryFocus) || !primaryFocus) {
    return false;
  }
  return (SKILL_DAY_ARTS[dayNumber] ?? []).includes(primaryFocus);
}

export function filterSkillDaysForFocus<T extends { dayNumber: number }>(
  days: T[],
  primaryFocus?: string | null,
) {
  return days.filter((day) => skillDayMatchesFocus(day.dayNumber, primaryFocus));
}

export function skillEquipmentNote(equipment: string[] | undefined) {
  const items = equipment ?? [];
  const hasBag = items.includes("Heavy bag");
  const hasPads = items.includes("Thai pads / focus mitts");
  const bodyweightOnly = items.includes("Bodyweight only") && !hasBag && !hasPads;
  if (bodyweightOnly) {
    return "No bag or pads on file. Shadow or technical reps — no full power.";
  }
  if (hasBag && hasPads) {
    return "You listed a heavy bag and pads. Use them for these DEMO skill rounds.";
  }
  if (hasBag) {
    return "You listed a heavy bag. Use it for these DEMO skill rounds when you have it.";
  }
  if (hasPads) {
    return "You listed pads. Use them if a partner is holding; otherwise shadow the same work.";
  }
  return "If you have a bag or pads, use them. If not, shadow at technical speed.";
}

/**
 * Mix strength + matching skill days. Martial-arts focuses start on a skill
 * session, then alternate so strength stays in the rotation. General fitness
 * stays on the strength DEMO only.
 */
export function suggestTodayWork<T extends { id: string; dayNumber: number }>(input: {
  strengthDays: T[];
  skillDays: T[];
  completedDayIds: Set<string>;
  prefs: { goalKey?: string; primaryFocus?: string };
}): T | null {
  const skillPool = filterSkillDaysForFocus(input.skillDays, input.prefs.primaryFocus);
  const strengthPool = input.strengthDays;

  if (skillPool.length === 0) {
    return suggestDemoProgramDay(strengthPool, input.completedDayIds, input.prefs);
  }

  const strengthDone = strengthPool.filter((day) => input.completedDayIds.has(day.id)).length;
  const skillDone = skillPool.filter((day) => input.completedDayIds.has(day.id)).length;
  const preferSkill = skillDone <= strengthDone;

  const pickFrom = (days: T[], useStrengthHints: boolean) => {
    if (days.length === 0) return null;
    const unused = days.filter((day) => !input.completedDayIds.has(day.id));
    const pool = unused.length > 0 ? unused : days;
    if (useStrengthHints) {
      return suggestDemoProgramDay(pool, new Set(), input.prefs);
    }
    return pool[0] ?? null;
  };

  if (preferSkill) {
    return pickFrom(skillPool, false) ?? pickFrom(strengthPool, true);
  }
  return pickFrom(strengthPool, true) ?? pickFrom(skillPool, false);
}

export function mixCalendarProgramDays<T>(strengthDays: T[], skillDays: T[]): T[] {
  const mixed: T[] = [];
  const max = Math.max(strengthDays.length, skillDays.length);
  for (let i = 0; i < max; i += 1) {
    const skill = skillDays[i];
    const strength = strengthDays[i];
    if (skill) mixed.push(skill);
    if (strength) mixed.push(strength);
  }
  return mixed;
}
