import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { EQUIPMENT_OPTIONS, WEEKDAYS } from "@/lib/constants";
import { isLoadUnit, type LoadUnit } from "@/lib/units";

export type ProfileRecord = {
  userId: string;
  displayName: string;
  isAdultConfirmed: boolean;
  claimsGymMembership: boolean;
  gymMembershipVerified: boolean;
  goals: string;
  experienceLevel: string;
  equipment: string[];
  weeklyAvailability: string[];
  hoursPerWeek: number | null;
  preferredUnits: LoadUnit;
  foodPreferences: string;
  allergies: string;
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
  experienceLevel: string;
  equipmentJson: string;
  weeklyAvailabilityJson: string;
  hoursPerWeek: number | null;
  preferredUnits: string;
  foodPreferences: string;
  allergies: string;
}): ProfileRecord {
  return {
    userId: row.userId,
    displayName: row.displayName,
    isAdultConfirmed: row.isAdultConfirmed,
    claimsGymMembership: row.claimsGymMembership,
    gymMembershipVerified: row.gymMembershipVerified,
    goals: row.goals,
    experienceLevel: row.experienceLevel,
    equipment: parseJsonArray(row.equipmentJson),
    weeklyAvailability: parseJsonArray(row.weeklyAvailabilityJson),
    hoursPerWeek: row.hoursPerWeek,
    preferredUnits: isLoadUnit(row.preferredUnits) ? row.preferredUnits : "lb",
    foodPreferences: row.foodPreferences,
    allergies: row.allergies,
  };
}

export async function getProfileForUser(
  userId: string,
): Promise<ProfileRecord | null> {
  const row = await prisma.profile.findUnique({ where: { userId } });
  return row ? toProfileRecord(row) : null;
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
    goals: string;
    experienceLevel: string;
    equipment: string[];
    weeklyAvailability: string[];
    hoursPerWeek: number | null;
    preferredUnits: string;
    claimsGymMembership: boolean;
    foodPreferences: string;
    allergies: string;
  },
): Promise<ProfileRecord> {
  const displayName = input.displayName.trim().slice(0, 80);
  const goals = input.goals.trim().slice(0, 500);
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

  const row = await prisma.profile.update({
    where: { userId },
    data: {
      displayName,
      goals,
      experienceLevel: input.experienceLevel,
      equipmentJson: JSON.stringify(equipment),
      weeklyAvailabilityJson: JSON.stringify(weeklyAvailability),
      hoursPerWeek,
      preferredUnits: input.preferredUnits,
      claimsGymMembership: Boolean(input.claimsGymMembership),
      foodPreferences: input.foodPreferences.trim().slice(0, 400),
      allergies: input.allergies.trim().slice(0, 400),
      // Never allow a member to self-verify gym membership.
    },
  });

  return toProfileRecord(row);
}

export function profileIsComplete(profile: ProfileRecord): boolean {
  return Boolean(
    profile.displayName &&
      profile.goals &&
      profile.experienceLevel &&
      profile.weeklyAvailability.length > 0,
  );
}
