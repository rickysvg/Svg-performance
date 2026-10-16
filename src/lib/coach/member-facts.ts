import { getFightCampRow } from "@/lib/fight-camp";
import { WEEKDAYS } from "@/lib/constants";
import { assignWeek, type TrainingWeekday } from "@/lib/member-plan";
import { getProfileForUser } from "@/lib/profile";

export type OfflineMemberFacts = {
  fightDate?: string | null;
  availability?: string[];
  liftDays?: string[];
  bagDays?: string[];
  sparringDays?: string[];
  classDays?: string[];
  art?: string | null;
  limitations?: string | null;
  experienceLevel?: string | null;
};

function daysWith(
  roles: ReturnType<typeof assignWeek>,
  pick: (day: TrainingWeekday) => boolean,
) {
  return WEEKDAYS.filter((day) => pick(day));
}

function joinDays(days: string[] | undefined, fallback: string) {
  const list = (days ?? []).filter(Boolean);
  if (list.length === 0) return fallback;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

export function dayList(days: string[] | undefined, fallback: string) {
  return joinDays(days, fallback);
}

/**
 * Lift days, bag days, and sparring from this member's week.
 * Empty fields stay empty. Callers must not invent a Saturday that is not here.
 */
export async function loadOfflineMemberFacts(userId: string): Promise<OfflineMemberFacts | null> {
  try {
    const profile = await getProfileForUser(userId);
    if (!profile) return null;
    const camp = await getFightCampRow(userId).catch(() => null);
    const roles = assignWeek({
      trainingFocus: profile.trainingFocus,
      liftDaysPerWeek: profile.liftDaysPerWeek,
      experienceLevel: profile.experienceLevel,
      outsideTraining: profile.outsideTraining,
    });
    const saved =
      camp?.status === "active" && camp.fightDateKey
        ? camp.fightDateKey
        : profile.nextFightDate
          ? profile.nextFightDate.toISOString().slice(0, 10)
          : null;
    return {
      fightDate: saved,
      availability: profile.weeklyAvailability ?? [],
      liftDays: daysWith(roles, (day) => Boolean(roles[day].lift)),
      bagDays: daysWith(roles, (day) => Boolean(roles[day].bag)),
      sparringDays: daysWith(roles, (day) => roles[day].outside?.kind === "sparring"),
      classDays: daysWith(roles, (day) => roles[day].outside?.kind === "class"),
      art: profile.primaryFocus,
      limitations: profile.trainingLimitations?.trim() || null,
      experienceLevel: profile.experienceLevel,
    };
  } catch {
    return null;
  }
}
