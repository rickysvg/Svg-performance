import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EQUIPMENT_OPTIONS } from "@/lib/constants";
import { completeOnboardingForUser, demoSuggestionCopy } from "@/lib/onboarding";
import { findSkillProgram, getDemoProgram } from "@/lib/programs";
import {
  filterSkillDaysForFocus,
  mixCalendarProgramDays,
  skillEquipmentNote,
  suggestTodayWork,
} from "@/lib/skill-programs";
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

const strengthDays = [
  { id: "d1", dayNumber: 1, title: "Day 1 — Lower body + power" },
  { id: "d2", dayNumber: 2, title: "Day 2 — Upper body + grip" },
  { id: "d3", dayNumber: 3, title: "Day 3 — Hinge, pull, and conditioning" },
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

  it("starts martial artists on a skill day and then alternates to strength", () => {
    const first = suggestTodayWork({
      strengthDays,
      skillDays,
      completedDayIds: new Set(),
      prefs: { primaryFocus: "mma", goalKey: "stronger-for-class" },
    });
    expect(first?.id).toBe("s1");

    const afterSkill = suggestTodayWork({
      strengthDays,
      skillDays,
      completedDayIds: new Set(["s1"]),
      prefs: { primaryFocus: "mma" },
    });
    expect(afterSkill?.id).toBe("d1");

    const fitness = suggestTodayWork({
      strengthDays,
      skillDays,
      completedDayIds: new Set(),
      prefs: { primaryFocus: "general-fitness", goalKey: "conditioning" },
    });
    expect(fitness?.id).toBe("d3");
  });

  it("interleaves skill and strength on the calendar and scales bag notes", () => {
    const mixed = mixCalendarProgramDays(strengthDays, filterSkillDaysForFocus(skillDays, "boxing"));
    expect(mixed.map((day) => day.id)).toEqual(["s3", "d1", "d2", "d3"]);
    expect(skillEquipmentNote(["Bodyweight only"])).toMatch(/shadow/i);
    expect(skillEquipmentNote(["Heavy bag"])).toMatch(/heavy bag/i);
    expect(EQUIPMENT_OPTIONS).toContain("Heavy bag");
    expect(EQUIPMENT_OPTIONS).toContain("Thai pads / focus mitts");
  });

  it("describes skill + strength without claiming a custom camp", () => {
    expect(demoSuggestionCopy({ primaryFocus: "mma", goalKey: "stronger-for-class" })).toMatch(
      /DEMO skill \+ strength/,
    );
    expect(demoSuggestionCopy({ primaryFocus: "general-fitness" })).toMatch(/DEMO strength template/);
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
    expect(strength.days).toHaveLength(3);

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
    const today = await getHomeToday(user.id);
    expect(today.suggestedDay?.title).toMatch(/Heavy bag — hands to low kicks/i);
    expect(today.suggestionCopy).toMatch(/Muay Thai/);
    expect(today.suggestionCopy).not.toMatch(/custom fight camp|Ricky wrote/i);
  });
});
