import { describe, expect, it } from "vitest";
import { bikeSessionForLogger, DEFAULT_BIKE_SESSION } from "@/lib/bike-sessions";
import { bikeSetDurationSeconds } from "@/lib/bike-interval-timer";
import { exercisesFromLoggerGroups } from "@/lib/my-workout-plan";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import {
  BIKE_CHOICES,
  bikeChoiceById,
  bikeChoiceFromKey,
  bikeChoiceMinutes,
  customBikeChoice,
  formatBikeRecipe,
  parseBikeRecipe,
  prescriptionWithBikeChoice,
  retainBikeChoiceSets,
  sessionWithChoice,
} from "@/lib/bike-chooser";

describe("bike workout chooser", () => {
  it("lists the proven sessions with a goal, level, and a clock that matches the minutes", () => {
    expect(BIKE_CHOICES.length).toBeGreaterThanOrEqual(10);
    expect(BIKE_CHOICES.length).toBeLessThanOrEqual(12);
    const ids = new Set(BIKE_CHOICES.map((row) => row.id));
    expect(ids.size).toBe(BIKE_CHOICES.length);
    for (const row of BIKE_CHOICES) {
      expect(row.name.length).toBeGreaterThan(3);
      expect(row.description.length).toBeGreaterThan(20);
      expect(["power", "anaerobic", "aerobic", "fight-sim"]).toContain(row.goal);
      expect(["beginner", "intermediate", "advanced"]).toContain(row.level);
      expect(bikeChoiceMinutes(row)).toBe(Math.round(bikeSetDurationSeconds(row.spec) / 60));
      expect(parseBikeRecipe(formatBikeRecipe(row))?.id).toBe(row.id);
    }
    expect(bikeChoiceById("tabata")?.spec).toMatchObject({ workSeconds: 20, restSeconds: 10, roundsPerSet: 8 });
    expect(bikeChoiceMinutes(bikeChoiceById("tabata")!)).toBe(4);
    expect(bikeChoiceMinutes(bikeChoiceById("norwegian-4x4")!)).toBe(25);
    expect(bikeChoiceMinutes(bikeChoiceById("ten-twenty-thirty")!)).toBe(19);
    expect(bikeChoiceMinutes(bikeChoiceById("fight-rounds")!)).toBe(19);
    expect(bikeChoiceMinutes(bikeChoiceById("sprint-ladder")!)).toBe(9);
  });

  it("builds a custom interval and rejects numbers outside the form", () => {
    const custom = customBikeChoice({
      workSeconds: 20,
      restSeconds: 40,
      rounds: 10,
      warmupSeconds: 60,
      cooldownSeconds: 90,
    });
    expect(custom?.spec).toMatchObject({
      workSeconds: 20,
      restSeconds: 40,
      roundsPerSet: 10,
      warmupSeconds: 60,
      cooldownSeconds: 90,
    });
    expect(bikeSetDurationSeconds(custom!.spec)).toBe(60 + 10 * 60 + 90);
    expect(parseBikeRecipe(formatBikeRecipe(custom!))?.spec.warmupSeconds).toBe(60);
    expect(customBikeChoice({ workSeconds: 0, restSeconds: 10, rounds: 4 })).toBeNull();
    expect(customBikeChoice({ workSeconds: 15, restSeconds: -1, rounds: 4 })).toBeNull();
    expect(customBikeChoice({ workSeconds: 15, restSeconds: 10, rounds: 41 })).toBeNull();
  });

  it("stores the choice on the prescription key and collapses today's open bike sets to one", () => {
    const choice = bikeChoiceById("tabata")!;
    const key = prescriptionWithBikeChoice(
      "demo-strength-base:4|assault bike intervals::15swork/15srest×8",
      "Assault bike intervals",
      choice,
    );
    expect(key.length).toBeLessThanOrEqual(160);
    expect(bikeChoiceFromKey(key)?.id).toBe("tabata");
    const sets = retainBikeChoiceSets(
      [
        { exerciseName: "Squat", completed: false, setNumber: 1, prescriptionKey: "squat" },
        { exerciseName: "Assault bike intervals", completed: false, setNumber: 1, prescriptionKey: "bike" },
        { exerciseName: "Assault bike intervals", completed: false, setNumber: 2, prescriptionKey: "bike" },
        { exerciseName: "Assault bike intervals", completed: true, setNumber: 3, prescriptionKey: "bike" },
        { exerciseName: "Row", completed: false, setNumber: 1, prescriptionKey: "row" },
      ],
      "Assault bike intervals",
      choice,
    );
    const bike = sets.filter((set) => set.exerciseName === "Assault bike intervals");
    expect(bike).toHaveLength(2);
    expect(bike.filter((set) => !set.completed)).toHaveLength(1);
    expect(sets.map((set) => set.exerciseName)).toEqual([
      "Squat",
      "Assault bike intervals",
      "Assault bike intervals",
      "Row",
    ]);
    expect(bikeChoiceFromKey(bike[0]!.prescriptionKey)?.id).toBe("tabata");
  });

  it("keeps a saved workout recipe inside the added prescription key", () => {
    const custom = customBikeChoice({ workSeconds: 15, restSeconds: 45, rounds: 8, warmupSeconds: 30, cooldownSeconds: 45 })!;
    const key = prescriptionWithBikeChoice("added|old", "Assault bike intervals", custom).slice(0, 160);
    expect(bikeChoiceFromKey(key)?.spec).toMatchObject({
      workSeconds: 15,
      restSeconds: 45,
      roundsPerSet: 8,
      warmupSeconds: 30,
      cooldownSeconds: 45,
    });
    const fresh = addedPrescriptionKey({
      exerciseName: "Assault bike intervals",
      reps: formatBikeRecipe(bikeChoiceById("norwegian-4x4")!),
      restSeconds: 0,
    });
    expect(bikeChoiceFromKey(fresh.slice(0, 160))?.id).toBe("norwegian-4x4");
  });

  it("drives the interval timer from the choice and saves that recipe with My Workouts", () => {
    const choice = bikeChoiceById("emom-15-45")!;
    const session = sessionWithChoice(DEFAULT_BIKE_SESSION, choice);
    expect(session.workSeconds).toBe(15);
    expect(session.restSeconds).toBe(45);
    expect(session.roundsPerSet).toBe(10);
    expect(session.restBetweenSetsSeconds).toBe(0);
    const plain = bikeSessionForLogger("Assault bike intervals", {
      reps: "15s work / 15s rest × 8",
      restSeconds: 60,
    });
    expect(plain?.restBetweenSetsSeconds).toBe(60);
    expect(plain?.workSeconds).toBe(15);

    const saved = exercisesFromLoggerGroups([
      {
        name: "Assault bike intervals",
        restSeconds: 0,
        planned: {
          reps: formatBikeRecipe(choice),
          loadText: "All-out sprint / easy — no lbs",
          notes: choice.description,
          logMode: "timed_round",
        },
        sets: [{ logMode: "timed_round", durationSeconds: 600 }],
      },
    ]);
    expect(saved[0]?.reps).toContain("bw emom-15-45");
    expect(saved[0]?.sets).toBe(1);
    expect(parseBikeRecipe(saved[0]!.reps)?.id).toBe("emom-15-45");
  });
});
