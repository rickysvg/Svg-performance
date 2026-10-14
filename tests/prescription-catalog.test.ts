import { describe, expect, it } from "vitest";
import { floorSessionForDay } from "@/lib/bodyweight-plan";
import { demoBagSkillDays, demoStrengthDays } from "@/lib/demo-week-seed";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { scaleProgramDay, type ScaleBand } from "@/lib/training-scale";

const bands: ScaleBand[] = ["beginner", "intermediate", "advanced"];
const accesses = ["gym", "none"] as const;

function catalogDays() {
  return [
    ...demoStrengthDays().map((day) => ({
      slug: DEMO_PROGRAM_SLUG,
      day: { ...day, exercises: day.exercises.create },
    })),
    ...demoBagSkillDays().map((day) => ({
      slug: DEMO_SKILL_PROGRAM_SLUG,
      day: { ...day, exercises: day.exercises.create },
    })),
  ];
}

describe("workout prescriptions", () => {
  it("names one exercise, never repeats it, and includes reps or time", () => {
    const problems: string[] = [];
    for (const band of bands) {
      for (const weightAccess of accesses) {
        for (const { slug, day } of catalogDays()) {
          const scaled = scaleProgramDay(day, { band, programSlug: slug, weightAccess });
          const seen = new Set<string>();
          for (const exercise of scaled.exercises) {
            const label = `${band} ${weightAccess} ${slug} day ${day.dayNumber} ${exercise.name}`;
            if (/\bor\b/i.test(exercise.name)) problems.push(`or-title ${label}`);
            if (!/\d/.test(exercise.reps ?? "")) problems.push(`reps ${label} [${exercise.reps}]`);
            const key = gymExerciseKey(exercise.name);
            if (seen.has(key)) problems.push(`duplicate ${label}`);
            seen.add(key);
          }
          if (weightAccess === "none" && slug === DEMO_PROGRAM_SLUG) {
            const floor = floorSessionForDay(day.dayNumber, slug, band);
            if (floor && floor.exercises.length === 0) {
              problems.push(`empty floor ${band} day ${day.dayNumber}`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
