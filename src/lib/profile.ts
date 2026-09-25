import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  COMPETITION_STATUS_OPTIONS,
  COACHING_TONE_OPTIONS,
  DEMO_NUTRITION_TARGETS,
  EQUIPMENT_OPTIONS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  OBSTACLE_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { isValidTimeZone, resolveRequestTimeZone } from "@/lib/timezone";

export type ProfileRecord = {
  userId: string;
  displayName: string;
  isAdultConfirmed: boolean;
  claimsGymMembership: boolean;
  gymMembershipVerified: boolean;
  goals: string;
  goalKey: string;
  experienceLevel: string;
  primaryFocus: string;
  equipment: string[];
  weeklyAvailability: string[];
  hoursPerWeek: number | null;
  sessionsPerWeek: number | null;
  preferredUnits: LoadUnit;
  timeZone: string;
  foodPreferences: string;
  allergies: string;
  trainingLimitations: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  onboardingCompletedAt: Date | null;
  onboardingDeepCompletedAt: Date | null;
  currentWeight: number | null;
  goalWeight: number | null;
  sessionLengthMin: number | null;
  trainingLocation: string;
  competitionStatus: string;
  nextFightDate: Date | null;
  coachingTone: string;
  obstacles: string[];
};

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function toProfileRecord(row: {
  userId: string;
  displayName: string;
  isAdultConfirmed: boolean;
  claimsGymMembership: boolean;
  gymMembershipVerified: boolean;
  goals: string;
  goalKey: string;
  experienceLevel: string;
  primaryFocus: string;
  equipmentJson: string;
  weeklyAvailabilityJson: string;
  hoursPerWeek: number | null;
  sessionsPerWeek: number | null;
  preferredUnits: string;
  timeZone?: string;
  foodPreferences: string;
  allergies: string;
  trainingLimitations: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  onboardingCompletedAt: Date | null;
  onboardingDeepCompletedAt: Date | null;
  currentWeight: number | null;
  goalWeight: number | null;
  sessionLengthMin: number | null;
  trainingLocation: string;
  competitionStatus: string;
  nextFightDate: Date | null;
  coachingTone: string;
  obstaclesJson: string;
}): ProfileRecord {
  return {
    userId: row.userId,
    displayName: row.displayName,
    isAdultConfirmed: row.isAdultConfirmed,
    claimsGymMembership: row.claimsGymMembership,
    gymMembershipVerified: row.gymMembershipVerified,
    goals: row.goals,
    goalKey: row.goalKey,
    experienceLevel: row.experienceLevel,
    primaryFocus: row.primaryFocus,
    equipment: parseJsonArray(row.equipmentJson),
    weeklyAvailability: parseJsonArray(row.weeklyAvailabilityJson),
    hoursPerWeek: row.hoursPerWeek,
    sessionsPerWeek: row.sessionsPerWeek,
    preferredUnits: isLoadUnit(row.preferredUnits) ? row.preferredUnits : "lb",
    timeZone: row.timeZone ?? "",
    foodPreferences: row.foodPreferences,
    allergies: row.allergies,
    trainingLimitations: row.trainingLimitations,
    onboardingDeepCompletedAt: row.onboardingDeepCompletedAt,
    currentWeight: row.currentWeight,
    goalWeight: row.goalWeight,
    sessionLengthMin: row.sessionLengthMin,
    trainingLocation: row.trainingLocation,
    competitionStatus: row.competitionStatus,
    nextFightDate: row.nextFightDate,
    coachingTone: row.coachingTone,
    obstacles: parseJsonArray(row.obstaclesJson),
    calorieTarget: row.calorieTarget,
    proteinTargetG: row.proteinTargetG,
    carbsTargetG: row.carbsTargetG,
    fatTargetG: row.fatTargetG,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

export function firstNameFrom(displayName: string) {
  const part = displayName.trim().split(/\s+/)[0];
  return part || "";
}

export function nutritionTargetsFromProfile(profile: ProfileRecord | null) {
  return {
    calories: profile?.calorieTarget || DEMO_NUTRITION_TARGETS.calories,
    proteinG: profile?.proteinTargetG || DEMO_NUTRITION_TARGETS.proteinG,
    carbsG: profile?.carbsTargetG || DEMO_NUTRITION_TARGETS.carbsG,
    fatG: profile?.fatTargetG || DEMO_NUTRITION_TARGETS.fatG,
  };
}

export async function getProfileForUser(
  userId: string,
): Promise<ProfileRecord | null> {
  const row = await prisma.profile.findUnique({ where: { userId } });
  return row ? toProfileRecord(row) : null;
}

/** Saved profile zone, then cookie, then America/Denver, then UTC. */
export async function timeZoneForUser(userId: string, saved?: string | null) {
  if (saved !== undefined) {
    return resolveRequestTimeZone(saved);
  }
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return resolveRequestTimeZone(row?.timeZone);
}

export async function persistDetectedTimeZone(userId: string, timeZone: string) {
  if (!isValidTimeZone(timeZone)) return false;
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing || existing.timeZone) return false;
  await prisma.profile.update({
    where: { userId },
    data: { timeZone },
  });
  return true;
}

export async function requireProfileForUser(
  userId: string,
): Promise<ProfileRecord> {
  const profile = await getProfileForUser(userId);
  if (!profile) {
    throw new NotFoundError("Profile not found.");
  }
  return profile;
}

export async function updateProfileForUser(
  userId: string,
  input: {
    displayName: string;
    goals?: string;
    goalKey?: string;
    goalNote?: string;
    experienceLevel: string;
    primaryFocus?: string;
    equipment: string[];
    weeklyAvailability: string[];
    hoursPerWeek: number | null;
    sessionsPerWeek?: number | null;
    preferredUnits: string;
    timeZone?: string;
    claimsGymMembership: boolean;
    foodPreferences: string;
    allergies: string;
    trainingLimitations?: string;
    currentWeight?: number | null;
    goalWeight?: number | null;
    sessionLengthMin?: number | null;
    trainingLocation?: string;
    competitionStatus?: string;
    nextFightDate?: Date | null;
    coachingTone?: string;
    obstacles?: string[];
    calorieTarget?: number;
    proteinTargetG?: number;
    carbsTargetG?: number;
    fatTargetG?: number;
  },
): Promise<ProfileRecord> {
  const displayName = input.displayName.trim().slice(0, 80);
  if (!["beginner", "intermediate", "advanced"].includes(input.experienceLevel)) {
    throw new AppError("PROFILE", "Pick a valid experience level.");
  }
  if (!isLoadUnit(input.preferredUnits)) {
    throw new AppError("PROFILE", "Units must be lb or kg.");
  }

  const equipment = input.equipment.filter((item) =>
    (EQUIPMENT_OPTIONS as readonly string[]).includes(item),
  );
  const weeklyAvailability = input.weeklyAvailability.filter((item) =>
    (WEEKDAYS as readonly string[]).includes(item),
  );

  let hoursPerWeek = input.hoursPerWeek;
  if (hoursPerWeek != null) {
    if (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 0 || hoursPerWeek > 40) {
      throw new AppError("PROFILE", "Hours per week should be between 0 and 40.");
    }
    hoursPerWeek = Math.round(hoursPerWeek);
  }

  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) {
    throw new NotFoundError("Profile not found.");
  }

  const goalKey = GOAL_OPTIONS.some((goal) => goal.value === input.goalKey)
    ? (input.goalKey as string)
    : existing.goalKey;
  const goalNote = (input.goalNote ?? "").trim().slice(0, 400);
  const goalLabel = GOAL_OPTIONS.find((goal) => goal.value === goalKey)?.label ?? "";
  const goals = input.goals?.trim()
    ? input.goals.trim().slice(0, 500)
    : goalNote
      ? `${goalLabel || "Goal"} — ${goalNote}`
      : goalLabel || existing.goals;
  const primaryFocus = FOCUS_OPTIONS.some((item) => item.value === input.primaryFocus)
    ? (input.primaryFocus as string)
    : existing.primaryFocus;
  let sessionsPerWeek = input.sessionsPerWeek === undefined
    ? existing.sessionsPerWeek
    : input.sessionsPerWeek;
  if (sessionsPerWeek != null) {
    if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 14) {
      throw new AppError("PROFILE", "Sessions per week should be between 1 and 14.");
    }
    sessionsPerWeek = Math.round(sessionsPerWeek);
  }

  function parseTarget(value: number | undefined, fallback: number, min: number, max: number, label: string) {
    if (value == null || Number.isNaN(value)) {
      return fallback;
    }
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new AppError("PROFILE", `${label} should be between ${min} and ${max}.`);
    }
    return Math.round(value);
  }

  function parseOptionalWeight(value: number | null | undefined, fallback: number | null, label: string) {
    if (value === undefined) {
      return fallback;
    }
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    const min = input.preferredUnits === "kg" ? 20 : 50;
    const max = input.preferredUnits === "kg" ? 250 : 500;
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new AppError("PROFILE", `${label} should be between ${min} and ${max} ${input.preferredUnits}.`);
    }
    return Math.round(value * 10) / 10;
  }

  const currentWeight = parseOptionalWeight(input.currentWeight, existing.currentWeight, "Current body weight");
  const goalWeight = parseOptionalWeight(input.goalWeight, existing.goalWeight, "Goal weight");
  const competitionStatus =
    input.competitionStatus === undefined
      ? existing.competitionStatus
      : COMPETITION_STATUS_OPTIONS.some((item) => item.value === input.competitionStatus)
        ? input.competitionStatus
        : existing.competitionStatus;
  const nextFightDate =
    input.nextFightDate === undefined
      ? existing.nextFightDate
      : competitionStatus === "none" || competitionStatus === ""
        ? null
        : input.nextFightDate;

  const calorieTarget = parseTarget(
    input.calorieTarget,
    existing.calorieTarget,
    800,
    5000,
    "Calories",
  );
  const proteinTargetG = parseTarget(
    input.proteinTargetG,
    existing.proteinTargetG,
    40,
    400,
    "Protein",
  );
  const carbsTargetG = parseTarget(
    input.carbsTargetG,
    existing.carbsTargetG,
    40,
    600,
    "Carbs",
  );
  const fatTargetG = parseTarget(
    input.fatTargetG,
    existing.fatTargetG,
    20,
    250,
    "Fat",
  );

  const row = await prisma.profile.update({
    where: { userId },
    data: {
      displayName,
      goals,
      goalKey,
      experienceLevel: input.experienceLevel,
      primaryFocus,
      equipmentJson: JSON.stringify(equipment),
      weeklyAvailabilityJson: JSON.stringify(weeklyAvailability),
      hoursPerWeek,
      sessionsPerWeek,
      preferredUnits: input.preferredUnits,
      timeZone:
        input.timeZone === undefined
          ? existing.timeZone
          : input.timeZone.trim() === ""
            ? ""
            : isValidTimeZone(input.timeZone)
              ? input.timeZone
              : existing.timeZone,
      claimsGymMembership: Boolean(input.claimsGymMembership),
      foodPreferences: input.foodPreferences.trim().slice(0, 400),
      allergies: input.allergies.trim().slice(0, 400),
      trainingLimitations:
        input.trainingLimitations === undefined
          ? existing.trainingLimitations
          : input.trainingLimitations.trim().slice(0, 500),
      currentWeight,
      goalWeight,
      sessionLengthMin:
        input.sessionLengthMin === undefined
          ? existing.sessionLengthMin
          : input.sessionLengthMin == null ||
              SESSION_LENGTH_OPTIONS.some((item) => item.value === input.sessionLengthMin)
            ? input.sessionLengthMin
            : existing.sessionLengthMin,
      trainingLocation:
        input.trainingLocation === undefined
          ? existing.trainingLocation
          : TRAINING_LOCATION_OPTIONS.some((item) => item.value === input.trainingLocation)
            ? input.trainingLocation
            : existing.trainingLocation,
      competitionStatus,
      nextFightDate,
      coachingTone:
        input.coachingTone === undefined
          ? existing.coachingTone
          : COACHING_TONE_OPTIONS.some((item) => item.value === input.coachingTone)
            ? input.coachingTone
            : existing.coachingTone,
      obstaclesJson:
        input.obstacles === undefined
          ? existing.obstaclesJson
          : JSON.stringify(
              input.obstacles.filter((item) =>
                OBSTACLE_OPTIONS.some((option) => option.value === item),
              ),
            ),
      onboardingDeepCompletedAt:
        existing.onboardingDeepCompletedAt ??
        (input.currentWeight != null ||
        input.goalWeight != null ||
        input.sessionLengthMin != null ||
        input.trainingLocation ||
        input.competitionStatus ||
        input.coachingTone ||
        (input.obstacles && input.obstacles.length > 0)
          ? new Date()
          : existing.onboardingDeepCompletedAt),
      calorieTarget,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
      // Never allow a member to self-verify gym membership.
    },
  });

  return toProfileRecord(row);
}

export function profileIsComplete(profile: ProfileRecord): boolean {
  return Boolean(
    profile.onboardingCompletedAt &&
      profile.displayName &&
      profile.goals &&
      profile.experienceLevel &&
      profile.primaryFocus &&
      profile.equipment.length > 0 &&
      profile.weeklyAvailability.length > 0,
  );
}
