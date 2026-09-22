import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVELS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import { isLoadUnit } from "@/lib/units";
import { LESSON_LEVELS, LESSON_TOPICS } from "@/lib/lessons";
import {
  toProfileRecord,
  type ProfileRecord,
} from "@/lib/profile";

export type OnboardingInput = {
  displayName: string;
  goalKey: string;
  goalNote: string;
  experienceLevel: string;
  primaryFocus: string;
  equipment: string[];
  weeklyAvailability: string[];
  sessionsPerWeek: number | null;
  preferredUnits: string;
  trainingLimitations: string;
  foodPreferences: string;
  allergies: string;
};

export function goalLabel(goalKey: string) {
  return GOAL_OPTIONS.find((goal) => goal.value === goalKey)?.label ?? "";
}

export function focusLabel(focus: string) {
  return FOCUS_OPTIONS.find((item) => item.value === focus)?.label ?? focus;
}

export function formatGoalDisplay(goalKey: string, goalNote: string) {
  const label = goalLabel(goalKey) || "Training goal";
  const note = goalNote.trim();
  return note ? `${label} — ${note}` : label;
}

export function isFocusOption(value: string) {
  return FOCUS_OPTIONS.some((item) => item.value === value);
}

export function learnTopicFromFocus(focus: string): string | undefined {
  if (LESSON_TOPICS.includes(focus as (typeof LESSON_TOPICS)[number])) {
    return focus;
  }
  return undefined;
}

export function hasCompletedOnboarding(profile: {
  onboardingCompletedAt: Date | null;
} | null) {
  return Boolean(profile?.onboardingCompletedAt);
}

export function memberEntryPath(onboardingCompletedAt: Date | null) {
  return onboardingCompletedAt ? "/home" : "/onboarding";
}

export function shouldBlockMemberRoute(onboardingCompletedAt: Date | null) {
  return !onboardingCompletedAt;
}

export async function getOnboardingStatus(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  return {
    profile: profile ? toProfileRecord(profile) : null,
    completedAt: profile?.onboardingCompletedAt ?? null,
    completed: hasCompletedOnboarding(profile),
  };
}

function parseSessionsPerWeek(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value) || value < 1 || value > 14) {
    throw new AppError("ONBOARDING", "Sessions per week should be between 1 and 14.");
  }
  return Math.round(value);
}

export function validateOnboardingInput(input: OnboardingInput): OnboardingInput & {
  goals: string;
} {
  const displayName = input.displayName.trim().slice(0, 80);
  if (!displayName) {
    throw new AppError("ONBOARDING", "Add the name we should use for you.");
  }
  if (!GOAL_OPTIONS.some((goal) => goal.value === input.goalKey)) {
    throw new AppError("ONBOARDING", "Pick a main goal.");
  }
  if (!EXPERIENCE_LEVELS.some((level) => level.value === input.experienceLevel)) {
    throw new AppError("ONBOARDING", "Pick your experience level.");
  }
  if (!isFocusOption(input.primaryFocus)) {
    throw new AppError("ONBOARDING", "Pick a primary martial art or focus.");
  }
  const equipment = input.equipment.filter((item) =>
    (EQUIPMENT_OPTIONS as readonly string[]).includes(item),
  );
  if (equipment.length === 0) {
    throw new AppError("ONBOARDING", "Pick at least one equipment option.");
  }
  const weeklyAvailability = input.weeklyAvailability.filter((item) =>
    (WEEKDAYS as readonly string[]).includes(item),
  );
  if (weeklyAvailability.length === 0) {
    throw new AppError("ONBOARDING", "Pick at least one day you can train.");
  }
  if (!isLoadUnit(input.preferredUnits)) {
    throw new AppError("ONBOARDING", "Units must be lb or kg.");
  }
  const goalNote = input.goalNote.trim().slice(0, 400);
  return {
    displayName,
    goalKey: input.goalKey,
    goalNote,
    experienceLevel: input.experienceLevel,
    primaryFocus: input.primaryFocus,
    equipment,
    weeklyAvailability,
    sessionsPerWeek: parseSessionsPerWeek(input.sessionsPerWeek),
    preferredUnits: input.preferredUnits,
    trainingLimitations: input.trainingLimitations.trim().slice(0, 500),
    foodPreferences: input.foodPreferences.trim().slice(0, 400),
    allergies: input.allergies.trim().slice(0, 400),
    goals: formatGoalDisplay(input.goalKey, goalNote),
  };
}

export async function completeOnboardingForUser(userId: string, input: OnboardingInput) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new NotFoundError("Profile not found.");
  }
  const data = validateOnboardingInput(input);
  const row = await prisma.profile.update({
    where: { userId },
    data: {
      displayName: data.displayName,
      goalKey: data.goalKey,
      goals: data.goals,
      experienceLevel: data.experienceLevel,
      primaryFocus: data.primaryFocus,
      equipmentJson: JSON.stringify(data.equipment),
      weeklyAvailabilityJson: JSON.stringify(data.weeklyAvailability),
      sessionsPerWeek: data.sessionsPerWeek,
      preferredUnits: data.preferredUnits,
      trainingLimitations: data.trainingLimitations,
      foodPreferences: data.foodPreferences,
      allergies: data.allergies,
      onboardingCompletedAt: existing.onboardingCompletedAt ?? new Date(),
    },
  });
  return toProfileRecord(row);
}

export function preferredLearnLevel(profile: Pick<ProfileRecord, "experienceLevel"> | null) {
  if (
    profile &&
    LESSON_LEVELS.includes(profile.experienceLevel as (typeof LESSON_LEVELS)[number])
  ) {
    return profile.experienceLevel;
  }
  return "beginner";
}

export function preferredLearnTopic(profile: Pick<ProfileRecord, "primaryFocus"> | null) {
  return profile ? learnTopicFromFocus(profile.primaryFocus) : undefined;
}

export function preferredDemoDayNumber(input: {
  goalKey?: string;
  primaryFocus?: string;
}) {
  if (input.goalKey === "conditioning") {
    return 3;
  }
  if (input.primaryFocus === "boxing" || input.primaryFocus === "muay-thai") {
    return 2;
  }
  if (
    input.primaryFocus === "wrestling" ||
    input.primaryFocus === "jiu-jitsu" ||
    input.primaryFocus === "cagework"
  ) {
    return 1;
  }
  if (input.goalKey === "more-athletic" || input.goalKey === "stay-consistent") {
    return 2;
  }
  return 1;
}

export function suggestDemoProgramDay<T extends { id: string; dayNumber: number }>(
  days: T[],
  completedDayIds: Set<string>,
  prefs: { goalKey?: string; primaryFocus?: string },
): T | null {
  if (days.length === 0) {
    return null;
  }
  const unused = days.filter((day) => !completedDayIds.has(day.id));
  const pool = unused.length > 0 ? unused : days;
  const preferred = preferredDemoDayNumber(prefs);
  return pool.find((day) => day.dayNumber === preferred) ?? pool[0] ?? null;
}

export function demoSuggestionCopy(prefs: { goalKey?: string; primaryFocus?: string }) {
  const art = prefs.primaryFocus ? focusLabel(prefs.primaryFocus) : "";
  const goal = prefs.goalKey ? goalLabel(prefs.goalKey) : "";
  const matched = [goal, art].filter(Boolean).join(" · ");
  if (!matched) {
    return "Suggested from the DEMO template. This is not a custom Elite coaching plan.";
  }
  return `Matched to your intake (${matched}) on the DEMO template. Not a custom Elite coaching plan.`;
}
