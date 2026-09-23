import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  COMPETITION_STATUS_OPTIONS,
  COACHING_TONE_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_LEVELS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  OBSTACLE_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
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

export function hasCompletedDeepOnboarding(profile: {
  onboardingDeepCompletedAt: Date | null;
} | null) {
  return Boolean(profile?.onboardingDeepCompletedAt);
}

export function needsDeepOnboardingPrompt(profile: {
  onboardingCompletedAt: Date | null;
  onboardingDeepCompletedAt: Date | null;
} | null) {
  return Boolean(profile?.onboardingCompletedAt && !profile.onboardingDeepCompletedAt);
}

export async function getOnboardingStatus(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  return {
    profile: profile ? toProfileRecord(profile) : null,
    completedAt: profile?.onboardingCompletedAt ?? null,
    completed: hasCompletedOnboarding(profile),
    deepCompletedAt: profile?.onboardingDeepCompletedAt ?? null,
    deepCompleted: hasCompletedDeepOnboarding(profile),
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

export type DeepOnboardingInput = {
  currentWeight: number | null;
  goalWeight: number | null;
  sessionLengthMin: number | null;
  trainingLocation: string;
  competitionStatus: string;
  nextFightDate: Date | null;
  coachingTone: string;
  obstacles: string[];
};

function parseOptionalWeight(value: number | null, units: string, label: string) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const min = units === "kg" ? 20 : 50;
  const max = units === "kg" ? 250 : 500;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new AppError("ONBOARDING", `${label} should be between ${min} and ${max} ${units}.`);
  }
  return Math.round(value * 10) / 10;
}

export function validateDeepOnboardingInput(
  input: DeepOnboardingInput,
  units: string,
): DeepOnboardingInput {
  const sessionLengthMin =
    input.sessionLengthMin == null
      ? null
      : SESSION_LENGTH_OPTIONS.some((item) => item.value === input.sessionLengthMin)
        ? input.sessionLengthMin
        : null;
  const trainingLocation = TRAINING_LOCATION_OPTIONS.some(
    (item) => item.value === input.trainingLocation,
  )
    ? input.trainingLocation
    : "";
  const competitionStatus = COMPETITION_STATUS_OPTIONS.some(
    (item) => item.value === input.competitionStatus,
  )
    ? input.competitionStatus
    : "";
  const coachingTone = COACHING_TONE_OPTIONS.some((item) => item.value === input.coachingTone)
    ? input.coachingTone
    : "";
  const obstacles = input.obstacles.filter((item) =>
    OBSTACLE_OPTIONS.some((option) => option.value === item),
  );
  let nextFightDate = input.nextFightDate;
  if (nextFightDate && Number.isNaN(nextFightDate.getTime())) {
    throw new AppError("ONBOARDING", "Use a real next-fight date or leave it blank.");
  }
  if (competitionStatus === "none" || competitionStatus === "") {
    nextFightDate = null;
  }
  return {
    currentWeight: parseOptionalWeight(input.currentWeight, units, "Current body weight"),
    goalWeight: parseOptionalWeight(input.goalWeight, units, "Goal weight"),
    sessionLengthMin,
    trainingLocation,
    competitionStatus,
    nextFightDate,
    coachingTone,
    obstacles,
  };
}

export async function saveDeepOnboardingForUser(userId: string, input: DeepOnboardingInput) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new NotFoundError("Profile not found.");
  }
  if (!existing.onboardingCompletedAt) {
    throw new AppError("ONBOARDING", "Finish the required questions first.");
  }
  const data = validateDeepOnboardingInput(input, existing.preferredUnits);
  const row = await prisma.profile.update({
    where: { userId },
    data: {
      currentWeight: data.currentWeight,
      goalWeight: data.goalWeight,
      sessionLengthMin: data.sessionLengthMin,
      trainingLocation: data.trainingLocation,
      competitionStatus: data.competitionStatus,
      nextFightDate: data.nextFightDate,
      coachingTone: data.coachingTone,
      obstaclesJson: JSON.stringify(data.obstacles),
      onboardingDeepCompletedAt: existing.onboardingDeepCompletedAt ?? new Date(),
    },
  });
  return toProfileRecord(row);
}

export function sessionLengthHint(sessionLengthMin: number | null) {
  if (!sessionLengthMin) {
    return "";
  }
  return `You said typical sessions are ${sessionLengthMin} minutes. This DEMO day is a template — stop when the work is honest.`;
}

export function trainingLocationHint(location: string) {
  if (location === "home") {
    return "You train at home. The DEMO template uses simple equipment.";
  }
  if (location === "gym") {
    return "You train at the gym. The DEMO template still stays labeled DEMO.";
  }
  if (location === "both") {
    return "You train at the gym and at home. The DEMO template uses simple equipment on purpose.";
  }
  return "";
}

export function competitionNote(status: string, nextFightDate: Date | null) {
  if (status !== "amateur" && status !== "pro") {
    return "";
  }
  const label = status === "pro" ? "Pro" : "Amateur";
  const date = nextFightDate
    ? ` Next fight on file: ${nextFightDate.toLocaleDateString()}.`
    : "";
  return `${label} status is saved for later fight-camp tools.${date} This app still does not run a fight camp.`;
}

export function coachingToneNote(tone: string) {
  if (tone === "tough") {
    return "Preferred tone: more tough. Keep the standard high. No sugarcoating — still no shame.";
  }
  if (tone === "encouraging") {
    return "Preferred tone: more encouraging. Lead with what is working, then one next step.";
  }
  if (tone === "balanced") {
    return "Preferred tone: balanced. Be direct and even.";
  }
  return "";
}

export function obstacleNote(obstacles: string[]) {
  const labels = obstacles
    .map((item) => OBSTACLE_OPTIONS.find((option) => option.value === item)?.label)
    .filter((label): label is (typeof OBSTACLE_OPTIONS)[number]["label"] => Boolean(label));
  if (labels.length === 0) {
    return "";
  }
  return `Biggest obstacle on file: ${labels.join(", ")}. We will not invent a medical plan from that.`;
}

export function demoSuggestionCopy(prefs: { goalKey?: string; primaryFocus?: string }) {
  const art = prefs.primaryFocus ? focusLabel(prefs.primaryFocus) : "";
  const goal = prefs.goalKey ? goalLabel(prefs.goalKey) : "";
  const matched = [goal, art].filter(Boolean).join(" · ");
  const skillMix =
    prefs.primaryFocus && prefs.primaryFocus !== "general-fitness"
      ? "DEMO skill + strength templates"
      : "DEMO strength template";
  if (!matched) {
    return `Suggested from the ${skillMix}. This is not a custom Elite coaching plan.`;
  }
  return `Matched to your intake (${matched}) on the ${skillMix}. Not a custom Elite coaching plan.`;
}
