import { FOCUS_OPTIONS, GOAL_OPTIONS } from "@/lib/constants";
import { disciplineLabel } from "@/lib/fight-disciplines";
import { getFightCampRow } from "@/lib/fight-camp";
import { getProfileForUser } from "@/lib/profile";

const LIMIT_CAP = 180;

export type MemberContextInput = {
  experienceLevel?: string | null;
  primaryFocus?: string | null;
  trainingEmphasis?: string | null;
  goals?: string | null;
  goalKey?: string | null;
  sessionsPerWeek?: number | null;
  weeklyAvailability?: string[] | null;
  trainingLimitations?: string | null;
  competitionStatus?: string | null;
  laneTopic?: string | null;
  laneArt?: string | null;
  camp?: {
    status?: string | null;
    weightClass?: string | null;
    fightDate?: string | null;
    discipline?: string | null;
  } | null;
};

function focusLabel(value?: string | null) {
  const found = FOCUS_OPTIONS.find((item) => item.value === value);
  return found?.label || value?.trim() || "";
}

function goalLabel(input: MemberContextInput) {
  const written = input.goals?.trim() || "";
  if (written) return written;
  return GOAL_OPTIONS.find((item) => item.value === input.goalKey)?.label || "";
}

function clip(value: string, max = LIMIT_CAP) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).replace(/\s+\S*$/, "").trim()}…`;
}

/**
 * Compact profile for every coach turn.
 * No body weight and no calorie targets. Those are not a medical plan.
 */
export function formatMemberContext(input: MemberContextInput): string {
  const level = input.experienceLevel?.trim() || "unknown";
  const focus = focusLabel(input.primaryFocus);
  const emphasis = input.trainingEmphasis?.trim() || "";
  const arts = [input.laneArt?.trim(), focus].filter(Boolean);
  const uniqueArts = [...new Set(arts)];
  const goal = goalLabel(input);
  const days =
    input.sessionsPerWeek && input.sessionsPerWeek > 0
      ? `${input.sessionsPerWeek} days/week`
      : "days/week not set";
  const available = (input.weeklyAvailability ?? []).filter(Boolean);
  const limits = input.trainingLimitations?.trim()
    ? clip(input.trainingLimitations)
    : "none on file";
  const lines = [
    `Level: ${level}.`,
    uniqueArts.length ? `Art / training focus: ${uniqueArts.join(", ")}.` : "Art / training focus: not set.",
    emphasis ? `Training emphasis: ${emphasis}.` : "",
    goal ? `Goal: ${clip(goal, 120)}.` : "Goal: not set.",
    `Schedule: ${days}${available.length ? ` (${available.join(", ")})` : ""}.`,
    `Injury flags: ${limits}.`,
  ];
  const status = input.competitionStatus?.trim();
  if (status && status !== "none") lines.push(`Competition: ${status}.`);
  const camp = input.camp;
  if (camp && camp.status === "active" && (camp.fightDate || camp.weightClass)) {
    const discipline = camp.discipline ? disciplineLabel(camp.discipline) || camp.discipline : "";
    const bits = [
      discipline,
      camp.weightClass?.trim() ? `weight class ${camp.weightClass.trim()}` : "",
      camp.fightDate?.trim() ? `fight date ${camp.fightDate.trim()}` : "",
    ].filter(Boolean);
    if (bits.length) lines.push(`Fight camp: ${bits.join(", ")}.`);
  } else {
    lines.push("Fight camp: none on file.");
  }
  lines.push("Do not invent a weigh-in number or a meal plan from stored data.");
  return lines.filter(Boolean).join(" ");
}

export async function loadMemberContext(
  userId: string,
  lane?: { topic?: string; art?: string },
): Promise<string> {
  try {
    const [profile, camp] = await Promise.all([
      getProfileForUser(userId),
      getFightCampRow(userId).catch(() => null),
    ]);
    return formatMemberContext({
      experienceLevel: profile?.experienceLevel,
      primaryFocus: profile?.primaryFocus,
      trainingEmphasis: profile?.trainingEmphasis,
      goals: profile?.goals,
      goalKey: profile?.goalKey,
      sessionsPerWeek: profile?.sessionsPerWeek,
      weeklyAvailability: profile?.weeklyAvailability,
      trainingLimitations: profile?.trainingLimitations,
      competitionStatus: profile?.competitionStatus,
      laneTopic: lane?.topic,
      laneArt: lane?.art,
      camp: camp
        ? {
            status: camp.status,
            weightClass: camp.weightClass,
            fightDate: camp.fightDateKey,
            discipline: camp.discipline,
          }
        : null,
    });
  } catch {
    return formatMemberContext({ laneTopic: lane?.topic, laneArt: lane?.art });
  }
}
