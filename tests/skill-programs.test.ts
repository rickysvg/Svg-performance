import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EQUIPMENT_OPTIONS } from "@/lib/constants";
import { completeOnboardingForUser, demoSuggestionCopy } from "@/lib/onboarding";
import { findSkillProgram, getDemoProgram } from "@/lib/programs";
import { filterSkillDaysForFocus, skillEquipmentNote } from "@/lib/skill-programs";
import { getHomeToday } from "@/lib/home";
import { makeUser, resetDatabase } from "./helpers";

const skillDays = [
  { id: "s1", dayNumber: 1, title: "Heavy bag — hands to low kicks" },
  { id: "s2", dayNumber: 2, title: "Clinch knees on the bag" },
  { id: "s3", dayNumber: 3, title: "Jab-cross-hook bag rounds" },
  { id: "s4", dayNumber: 4, title: "Ground-and-pound drill" },
  { id: "s5", dayNumber: 5, title: "Shot + sprawl" },
  { id: "s6", dayNumber: 6, title: "Closed guard positional drill" },
];

describe("DEMO combat skill chooser", () => {
  it("filters skill days by intake focus", () => {
    expect(filterSkillDaysForFocus(skillDays, "mma").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "muay-thai").map((day) => day.title)).toEqual([
      "Heavy bag — hands to low kicks",
      "Clinch knees on the bag",
    ]);
    expect(filterSkillDaysForFocus(skillDays, "boxing").map((day) => day.dayNumber)).toEqual([3]);
    expect(filterSkillDaysForFocus(skillDays, "wrestling").map((day) => day.dayNumber)).toEqual([
      4, 5,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "jiu-jitsu").map((day) => day.dayNumber)).toEqual([6]);
    expect(filterSkillDaysForFocus(skillDays, "cagework").map((day) => day.dayNumber)).toEqual([
      4, 5,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "general-fitness")).toEqual([]);
  });

  it("scales bag notes from intake equipment", () => {
    expect(skillEquipmentNote(["Bodyweight only"])).toMatch(/shadow/i);
    expect(skillEquipmentNote(["Heavy bag"])).toMatch(/heavy bag/i);
    expect(EQUIPMENT_OPTIONS).toContain("Heavy bag");
    expect(EQUIPMENT_OPTIONS).toContain("Thai pads / focus mitts");
  });

  it("describes skill + strength without claiming a custom camp", () => {
    expect(demoSuggestionCopy({ primaryFocus: "mma", goalKey: "stronger-for-class" })).toMatch(
      /DEMO Core week plan \(skill \+ strength\)/,
    );
    expect(demoSuggestionCopy({ primaryFocus: "general-fitness" })).toMatch(
      /DEMO Core week plan \(strength\)/,
    );
    expect(demoSuggestionCopy({ primaryFocus: "muay-thai" })).toMatch(/Not a custom Elite/);
  });
});

describe("seeded DEMO combat skills", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds six labeled skill days and suggests bag work for Muay Thai on Home", async () => {
    const skill = await findSkillProgram();
    const strength = await getDemoProgram();
    expect(skill?.isDemo).toBe(true);
    expect(skill?.title).toMatch(/DEMO/);
    expect(skill?.days.map((day) => day.title)).toEqual([
      "Heavy bag — hands to low kicks",
      "Clinch knees on the bag",
      "Jab-cross-hook bag rounds",
      "Ground-and-pound drill",
      "Shot + sprawl",
      "Closed guard positional drill",
    ]);
    expect(strength.days).toHaveLength(4);
    expect(strength.days[3]?.title).toMatch(/assault bike/i);

    const user = await makeUser("muay@example.com");
    await completeOnboardingForUser(user.id, {
      displayName: "Thai",
      goalKey: "stronger-for-class",
      goalNote: "",
      experienceLevel: "beginner",
      primaryFocus: "muay-thai",
      equipment: ["Bodyweight only", "Heavy bag"],
      weeklyAvailability: ["Monday", "Wednesday"],
      sessionsPerWeek: 3,
      preferredUnits: "lb",
      trainingLimitations: "",
      foodPreferences: "",
      allergies: "",
    });
    const today = await getHomeToday(user.id, new Date(2026, 8, 21, 10, 0, 0));
    expect(today.plannedSessions.filter((session) => session.href)).toHaveLength(2);
    expect(today.suggestedDay?.title).toMatch(/Heavy bag — hands to low kicks/i);
    expect(today.suggestionCopy).toMatch(/Muay Thai/);
    expect(today.suggestionCopy).not.toMatch(/custom fight camp|Ricky wrote/i);
  });
});
