import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EQUIPMENT_OPTIONS } from "@/lib/constants";
import { completeOnboardingForUser, demoSuggestionCopy } from "@/lib/onboarding";
import { findSkillProgram, getDemoProgram } from "@/lib/programs";
import { filterSkillDaysForFocus, skillEquipmentNote } from "@/lib/skill-programs";
import { getHomeToday } from "@/lib/home";
import { bagFocusFor, type BagWeekday } from "@/lib/bag-sessions";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { MESO_BLOCKS, mesoBlockForWeekIndex } from "@/lib/mesocycle";
import { APP_TIMEZONE } from "@/lib/timezone";
import { makeUser, resetDatabase } from "./helpers";

const skillDays = [
  { id: "s1", dayNumber: 1, title: "Bag — boxing combos" },
  { id: "s2", dayNumber: 2, title: "Bag — kicks & teeps" },
  { id: "s3", dayNumber: 3, title: "Bag — body shots" },
  { id: "s4", dayNumber: 4, title: "Bag — clinch knees & elbows" },
  { id: "s5", dayNumber: 5, title: "Bag — defense & counters" },
  { id: "s6", dayNumber: 6, title: "Bag — power & speed (optional)" },
];

describe("DEMO combat skill chooser", () => {
  it("filters skill days by intake focus", () => {
    expect(filterSkillDaysForFocus(skillDays, "mma").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "muay-thai").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "boxing").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "wrestling").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "jiu-jitsu").map((day) => day.dayNumber)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(filterSkillDaysForFocus(skillDays, "general-fitness")).toEqual([]);
  });

  it("scales bag notes from intake equipment", () => {
    expect(skillEquipmentNote(["Bodyweight only"])).toMatch(/shadow/i);
    expect(skillEquipmentNote(["Heavy bag"])).toMatch(/heavy bag/i);
    expect(EQUIPMENT_OPTIONS).toContain("Heavy bag");
    expect(EQUIPMENT_OPTIONS).toContain("Thai pads / focus mitts");
  });

  it("describes bag + strength without claiming a custom camp", () => {
    expect(demoSuggestionCopy({ primaryFocus: "mma", goalKey: "stronger-for-class" })).toMatch(
      /DEMO Core week plan \(bag \+ strength\)/,
    );
    expect(demoSuggestionCopy({ primaryFocus: "general-fitness" })).toMatch(
      /DEMO Core week plan \(bag \+ strength\)/,
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

  it("seeds six bag theme days and suggests Mon boxing bag for Muay Thai on Home", async () => {
    const skill = await findSkillProgram();
    const strength = await getDemoProgram();
    expect(skill?.isDemo).toBe(true);
    expect(skill?.title).toMatch(/DEMO/);
    const bagWeekdays: BagWeekday[] = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    expect(skill?.days.map((day) => day.title)).toEqual(
      MESO_BLOCKS.flatMap((block) => bagWeekdays.map((weekday) => bagFocusFor(weekday, block).label)),
    );
    expect(strength.days.map((day) => day.dayNumber).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
    expect(strength.days.find((day) => day.dayNumber === 4)?.title).toMatch(/assault bike/i);
    expect(strength.days.find((day) => day.dayNumber === 10)?.title).toMatch(/GPP/i);
    expect(strength.days.find((day) => day.dayNumber === 11)?.title).toMatch(/Posterior/i);

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
    const when = new Date(2026, 8, 21, 10, 0, 0);
    const today = await getHomeToday(user.id, when);
    expect(today.plannedSessions.filter((session) => session.href)).toHaveLength(2);
    expect(today.suggestedDay?.title).toBe(
      bagFocusFor("Monday", mesoBlockForWeekIndex(bikeWeekIndex(when, APP_TIMEZONE))).label,
    );
    expect(today.suggestionCopy).toMatch(/Muay Thai/);
    expect(today.suggestionCopy).not.toMatch(/custom fight camp|Ricky wrote/i);
  });
});
