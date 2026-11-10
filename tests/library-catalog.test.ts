import { describe, expect, it } from "vitest";
import { COMBAT_LIBRARY } from "@/lib/combat-library";
import { EXERCISE_LIBRARY, filterExerciseLibrary } from "@/lib/exercise-library";
import { fighterExercises } from "@/lib/fighter-library";

describe("every catalog exercise stays in the library", () => {
  it("is on the All view and comes back when its name is searched", () => {
    const all = filterExerciseLibrary({ equipment: "all", category: "all" });
    const allNames = new Set(all.map((row) => row.name.toLowerCase()));
    expect(all).toHaveLength(EXERCISE_LIBRARY.length);

    for (const exercise of EXERCISE_LIBRARY) {
      expect(allNames.has(exercise.name.toLowerCase()), exercise.name).toBe(true);
      const found = filterExerciseLibrary({
        equipment: "none",
        category: "mobility",
        query: exercise.name,
      });
      expect(found.some((row) => row.name === exercise.name), exercise.name).toBe(true);
    }

    for (const row of COMBAT_LIBRARY) {
      const found = filterExerciseLibrary({
        equipment: "gym",
        category: "lower",
        query: row.name,
      });
      expect(
        found.some((exercise) => exercise.name.toLowerCase() === row.name.toLowerCase()),
        row.id,
      ).toBe(true);
    }

    for (const row of fighterExercises()) {
      expect(allNames.has(row.name.toLowerCase()), row.name).toBe(true);
    }
  });
});
