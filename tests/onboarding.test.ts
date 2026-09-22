import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getProfileForUser, updateProfileForUser } from "@/lib/profile";
import {
  completeOnboardingForUser,
  getOnboardingStatus,
  memberEntryPath,
  preferredDemoDayNumber,
  shouldBlockMemberRoute,
  suggestDemoProgramDay,
} from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { makeUser, resetDatabase } from "./helpers";

describe("onboarding gate and persistence", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks member routes until the intake is completed", async () => {
    const user = await makeUser("new@example.com");
    const before = await getOnboardingStatus(user.id);
    expect(before.completed).toBe(false);
    expect(shouldBlockMemberRoute(before.completedAt)).toBe(true);
    expect(memberEntryPath(before.completedAt)).toBe("/onboarding");
  });

  it("persists required answers and then allows Home", async () => {
    const user = await makeUser("ready@example.com");
    await expect(
      completeOnboardingForUser(user.id, {
        displayName: "",
        goalKey: "conditioning",
        goalNote: "",
        experienceLevel: "intermediate",
        primaryFocus: "boxing",
        equipment: ["Dumbbells"],
        weeklyAvailability: ["Monday", "Wednesday"],
        sessionsPerWeek: 3,
        preferredUnits: "kg",
        trainingLimitations: "Old knee — no jumping",
        foodPreferences: "I eat meat",
        allergies: "peanuts",
      }),
    ).rejects.toBeInstanceOf(AppError);

    const saved = await completeOnboardingForUser(user.id, {
      displayName: "Ready",
      goalKey: "conditioning",
      goalNote: "Last a full class",
      experienceLevel: "intermediate",
      primaryFocus: "boxing",
      equipment: ["Dumbbells"],
      weeklyAvailability: ["Monday", "Wednesday"],
      sessionsPerWeek: 3,
      preferredUnits: "kg",
      trainingLimitations: "Old knee — no jumping",
      foodPreferences: "I eat meat",
      allergies: "peanuts",
    });

    expect(saved.onboardingCompletedAt).toBeTruthy();
    expect(saved.displayName).toBe("Ready");
    expect(saved.goalKey).toBe("conditioning");
    expect(saved.goals).toContain("Improve conditioning");
    expect(saved.experienceLevel).toBe("intermediate");
    expect(saved.primaryFocus).toBe("boxing");
    expect(saved.equipment).toContain("Dumbbells");
    expect(saved.weeklyAvailability).toEqual(["Monday", "Wednesday"]);
    expect(saved.sessionsPerWeek).toBe(3);
    expect(saved.preferredUnits).toBe("kg");
    expect(saved.trainingLimitations).toContain("knee");
    expect(saved.allergies).toBe("peanuts");

    const after = await getOnboardingStatus(user.id);
    expect(after.completed).toBe(true);
    expect(shouldBlockMemberRoute(after.completedAt)).toBe(false);
    expect(memberEntryPath(after.completedAt)).toBe("/home");
  });

  it("lets Profile edit the same intake fields later", async () => {
    const user = await makeUser("edit@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Edit",
      goalKey: "stronger-for-class",
      goalNote: "",
      experienceLevel: "beginner",
      primaryFocus: "mma",
      equipment: ["Bodyweight only"],
      weeklyAvailability: ["Tuesday"],
      sessionsPerWeek: null,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });

    const updated = await updateProfileForUser(user.id, {
      displayName: "Edited",
      goalKey: "build-muscle",
      goalNote: "Add 5 lb to goblet squat",
      experienceLevel: "intermediate",
      primaryFocus: "wrestling",
      equipment: ["Dumbbells", "Kettlebell"],
      weeklyAvailability: ["Tuesday", "Thursday"],
      hoursPerWeek: 5,
      sessionsPerWeek: 4,
      preferredUnits: "kg",
      claimsGymMembership: false,
      foodPreferences: "high protein",
      allergies: "shellfish",
      trainingLimitations: "Left shoulder",
    });

    expect(updated.displayName).toBe("Edited");
    expect(updated.goalKey).toBe("build-muscle");
    expect(updated.primaryFocus).toBe("wrestling");
    expect(updated.experienceLevel).toBe("intermediate");
    expect(updated.sessionsPerWeek).toBe(4);
    expect(updated.trainingLimitations).toBe("Left shoulder");
    expect(updated.allergies).toBe("shellfish");
    expect(updated.onboardingCompletedAt).toBeTruthy();

    const again = await getProfileForUser(user.id);
    expect(again?.primaryFocus).toBe("wrestling");
    expect(again?.goalKey).toBe("build-muscle");
  });

  it("suggests a DEMO day from intake without claiming custom coaching", async () => {
    expect(preferredDemoDayNumber({ goalKey: "conditioning" })).toBe(3);
    expect(preferredDemoDayNumber({ primaryFocus: "wrestling" })).toBe(1);
    expect(preferredDemoDayNumber({ primaryFocus: "boxing" })).toBe(2);

    const days = [
      { id: "d1", dayNumber: 1 },
      { id: "d2", dayNumber: 2 },
      { id: "d3", dayNumber: 3 },
    ];
    const boxed = suggestDemoProgramDay(days, new Set(), {
      goalKey: "stronger-for-class",
      primaryFocus: "boxing",
    });
    expect(boxed?.dayNumber).toBe(2);

    const user = await makeUser("home-match@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Boxer",
      goalKey: "conditioning",
      goalNote: "",
      experienceLevel: "intermediate",
      primaryFocus: "boxing",
      equipment: ["Bodyweight only"],
      weeklyAvailability: ["Friday"],
      sessionsPerWeek: null,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });
    const today = await getHomeToday(user.id);
    expect(today.suggestedDay?.dayNumber).toBe(3);
    expect(today.suggestionCopy).toMatch(/DEMO template/i);
    expect(today.suggestionCopy).toMatch(/Not a custom Elite/i);
    expect(today.incompleteLesson?.topic).toBe("boxing");
    expect(today.incompleteLesson?.skillLevel).toBe("intermediate");
  });
});
