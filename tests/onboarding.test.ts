import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getProfileForUser, updateProfileForUser } from "@/lib/profile";
import {
  completeOnboardingForUser,
  getOnboardingStatus,
  memberEntryPath,
  needsDeepOnboardingPrompt,
  preferredDemoDayNumber,
  saveDeepOnboardingForUser,
  shouldBlockMemberRoute,
  suggestDemoProgramDay,
} from "@/lib/onboarding";
import { getHomeToday } from "@/lib/home";
import { DEMO_NUTRITION_TARGETS } from "@/lib/constants";
import { sendCoachMessage } from "@/lib/coach/chat";
import { makeUser, resetDatabase } from "./helpers";

const requiredIntake = {
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
};

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

    const saved = await completeOnboardingForUser(user.id, { ...requiredIntake });

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
      weeklyAvailability: ["Monday", "Wednesday", "Friday"],
      sessionsPerWeek: null,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });
    const today = await getHomeToday(user.id, new Date(2026, 8, 21, 10, 0, 0));
    expect(today.suggestedDay?.title).toMatch(/jab-cross-hook bag rounds/i);
    expect(today.plannedSessions.map((session) => session.kind)).toEqual(["skill", "strength"]);
    expect(today.suggestionCopy).toMatch(/DEMO Core week plan \(skill \+ strength\)/i);
    expect(today.suggestionCopy).toMatch(/Not a custom Elite/i);
    expect(today.incompleteLesson?.topic).toBe("boxing");
    expect(today.incompleteLesson?.skillLevel).toBe("intermediate");
  });

  it("lets a member skip step 2 and still reach Home with a soft prompt", async () => {
    const user = await makeUser("skip-deep@example.com");
    await completeOnboardingForUser(user.id, { ...requiredIntake, displayName: "Skip" });

    const afterRequired = await getOnboardingStatus(user.id);
    expect(afterRequired.completed).toBe(true);
    expect(afterRequired.deepCompleted).toBe(false);
    expect(shouldBlockMemberRoute(afterRequired.completedAt)).toBe(false);
    expect(memberEntryPath(afterRequired.completedAt)).toBe("/home");
    expect(needsDeepOnboardingPrompt(afterRequired.profile)).toBe(true);

    const today = await getHomeToday(user.id);
    expect(today.needsDeepPrompt).toBe(true);
    expect(today.sessionHint).toBe("");
    expect(today.targets.calories).toBe(DEMO_NUTRITION_TARGETS.calories);
  });

  it("persists step 2 answers and uses them without inventing a meal plan", async () => {
    const user = await makeUser("deep@example.com");
    await completeOnboardingForUser(user.id, { ...requiredIntake, displayName: "Deep" });

    await expect(
      saveDeepOnboardingForUser(user.id, {
        currentWeight: 4,
        goalWeight: null,
        sessionLengthMin: 45,
        trainingLocation: "gym",
        competitionStatus: "amateur",
        nextFightDate: new Date(2026, 10, 8),
        coachingTone: "tough",
        obstacles: ["consistency"],
      }),
    ).rejects.toBeInstanceOf(AppError);

    const fightDate = new Date(2026, 10, 8);
    const saved = await saveDeepOnboardingForUser(user.id, {
      currentWeight: 82.4,
      goalWeight: 79,
      sessionLengthMin: 45,
      trainingLocation: "gym",
      competitionStatus: "amateur",
      nextFightDate: fightDate,
      coachingTone: "tough",
      obstacles: ["consistency", "time"],
    });

    expect(saved.onboardingDeepCompletedAt).toBeTruthy();
    expect(saved.currentWeight).toBe(82.4);
    expect(saved.goalWeight).toBe(79);
    expect(saved.sessionLengthMin).toBe(45);
    expect(saved.trainingLocation).toBe("gym");
    expect(saved.competitionStatus).toBe("amateur");
    expect(saved.nextFightDate?.toDateString()).toBe(fightDate.toDateString());
    expect(saved.coachingTone).toBe("tough");
    expect(saved.obstacles).toEqual(["consistency", "time"]);
    expect(saved.calorieTarget).toBe(DEMO_NUTRITION_TARGETS.calories);
    expect(saved.proteinTargetG).toBe(DEMO_NUTRITION_TARGETS.proteinG);

    const after = await getOnboardingStatus(user.id);
    expect(after.deepCompleted).toBe(true);
    expect(needsDeepOnboardingPrompt(after.profile)).toBe(false);

    const today = await getHomeToday(user.id);
    expect(today.needsDeepPrompt).toBe(false);
    expect(today.sessionHint).toMatch(/45 minutes/);
    expect(today.locationHint).toMatch(/gym/i);
    expect(today.competitionNote).toMatch(/Amateur/);
    expect(today.competitionNote).toMatch(/does not run a fight camp/i);
    expect(today.targets.calories).toBe(DEMO_NUTRITION_TARGETS.calories);

    const edited = await updateProfileForUser(user.id, {
      displayName: "Deep",
      experienceLevel: "intermediate",
      equipment: ["Dumbbells"],
      weeklyAvailability: ["Monday", "Wednesday"],
      hoursPerWeek: null,
      preferredUnits: "kg",
      claimsGymMembership: false,
      foodPreferences: "I eat meat",
      allergies: "peanuts",
      sessionLengthMin: 60,
      trainingLocation: "both",
      competitionStatus: "none",
      nextFightDate: fightDate,
      coachingTone: "encouraging",
      obstacles: ["recovery"],
    });
    expect(edited.sessionLengthMin).toBe(60);
    expect(edited.trainingLocation).toBe("both");
    expect(edited.competitionStatus).toBe("none");
    expect(edited.nextFightDate).toBeNull();
    expect(edited.coachingTone).toBe("encouraging");
    expect(edited.obstacles).toEqual(["recovery"]);
    expect(edited.currentWeight).toBe(82.4);
    expect(edited.onboardingDeepCompletedAt).toBeTruthy();
  });

  it("does not allow deeper answers before the required intake", async () => {
    const user = await makeUser("too-soon@example.com");
    await expect(
      saveDeepOnboardingForUser(user.id, {
        currentWeight: 180,
        goalWeight: null,
        sessionLengthMin: 30,
        trainingLocation: "home",
        competitionStatus: "none",
        nextFightDate: null,
        coachingTone: "balanced",
        obstacles: ["nutrition"],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("deeper onboarding personalization", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses the preferred SVG Coach tone in offline replies", async () => {
    const user = await makeUser("tone@example.com");
    await completeOnboardingForUser(user.id, { ...requiredIntake, displayName: "Tone" });
    await saveDeepOnboardingForUser(user.id, {
      currentWeight: null,
      goalWeight: null,
      sessionLengthMin: 30,
      trainingLocation: "home",
      competitionStatus: "none",
      nextFightDate: null,
      coachingTone: "encouraging",
      obstacles: ["technique"],
    });

    const result = await sendCoachMessage({
      userId: user.id,
      message: "I skipped class yesterday.",
      experienceLevel: "intermediate",
      coachingTone: "encouraging",
    });
    expect(result.refused).toBe(false);
    expect(result.assistant.content).toMatch(/missed class|punishment session/i);
    expect(result.assistant.content).not.toMatch(/Preferred tone|DEMO|offline mode|COACHING_GUIDE/i);
    expect(result.assistant.content).not.toMatch(/calorie target|2200/i);
  });
});
