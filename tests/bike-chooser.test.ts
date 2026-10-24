import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { bikeSessionForLogger, DEFAULT_BIKE_SESSION } from "@/lib/bike-sessions";
import { roundHistoryLine } from "@/lib/round-session";
import { bikeSetDurationSeconds } from "@/lib/bike-interval-timer";
import { exercisesFromLoggerGroups } from "@/lib/my-workout-plan";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { viewAtElapsed } from "@/lib/bike-interval-timer";
import {
  BIKE_CHOICES,
  bikeChoiceById,
  bikeChoiceFromKey,
  bikeChoiceMinutes,
  bikeChoiceWithRounds,
  bikeHistoryFromSessions,
  bikeHistoryLine,
  compactBikeReps,
  choiceFromToken,
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
    expect(customBikeChoice({ workSeconds: 4, restSeconds: 10, rounds: 4 })).toBeNull();
    expect(customBikeChoice({ workSeconds: 15, restSeconds: 0, rounds: 4 })?.spec.restSeconds).toBe(0);
    expect(customBikeChoice({ workSeconds: 300, restSeconds: 0, rounds: 8 })?.spec.workSeconds).toBe(300);
    expect(customBikeChoice({ workSeconds: 4 * 60 * 60, restSeconds: 0, rounds: 1 })?.spec.workSeconds).toBe(4 * 60 * 60);
    expect(customBikeChoice({ workSeconds: 15, restSeconds: 10, rounds: 31 })?.spec.roundsPerSet).toBe(31);
    expect(customBikeChoice({ workSeconds: 15 * 60, restSeconds: 60, rounds: 40 })).toBeNull();
    expect(customBikeChoice({ workSeconds: 20, restSeconds: 10, rounds: 8, warmupSeconds: 660 })).toBeNull();
    expect(customBikeChoice({ workSeconds: 16 * 60, restSeconds: 15, rounds: 4 })).toBeNull();
    expect(choiceFromToken("c.14400.0.1.0.0")?.spec).toMatchObject({
      workSeconds: 4 * 60 * 60,
      restSeconds: 0,
      roundsPerSet: 1,
    });
    expect(choiceFromToken("c.1320.0.1.0.0")?.spec.workSeconds).toBe(22 * 60);
    expect(choiceFromToken("c.3540.0.1.0.0")?.spec.workSeconds).toBe(59 * 60);
    expect(choiceFromToken("c.3601.0.1.0.0")?.spec.workSeconds).toBe(3601);
    expect(bikeChoiceFromKey("timer#bw:c.14400.0.1.0.0")?.spec.workSeconds).toBe(4 * 60 * 60);
    expect(choiceFromToken("c.15.0.8.0.0")?.spec).toMatchObject({
      workSeconds: 15,
      restSeconds: 0,
      roundsPerSet: 8,
    });
    expect(choiceFromToken("c.14401.0.1.0.0")).toBeNull();
    expect(choiceFromToken("c.15.15.8.0.0")?.spec).toMatchObject({ workSeconds: 15, restSeconds: 15, roundsPerSet: 8 });
  });

  it("repeats any workout for N rounds and keeps that on the prescription key", () => {
    const triple = bikeChoiceWithRounds(bikeChoiceById("tabata")!, 3, 60);
    expect(triple?.name).toContain("3 × 8 rounds");
    expect(triple?.spec.repeatRounds).toBe(3);
    expect(triple?.spec.restBetweenRoundsSeconds).toBe(60);
    expect(bikeSetDurationSeconds(triple!.spec)).toBe(240 * 3 + 60 * 2);
    expect(viewAtElapsed(triple!.spec, 0)).toMatchObject({
      phase: "work",
      repeatRound: 1,
      repeatTotal: 3,
      sprint: 1,
      sprintTotal: 8,
    });
    expect(viewAtElapsed(triple!.spec, 240)).toMatchObject({
      phase: "rest",
      repeatRound: 1,
      sprint: 0,
    });
    expect(viewAtElapsed(triple!.spec, 300)).toMatchObject({
      phase: "work",
      repeatRound: 2,
      sprint: 1,
      sprintTotal: 8,
    });
    const key = prescriptionWithBikeChoice("demo|assault bike intervals::15swork/15srest×8", "Assault bike intervals", triple!);
    expect(key.length).toBeLessThanOrEqual(160);
    expect(bikeChoiceFromKey(key)?.spec).toMatchObject({ repeatRounds: 3, restBetweenRoundsSeconds: 60 });
    expect(parseBikeRecipe(formatBikeRecipe(triple!))?.spec.repeatRounds).toBe(3);

    const custom = customBikeChoice({
      workSeconds: 20,
      restSeconds: 10,
      rounds: 8,
      warmupSeconds: 60,
      cooldownSeconds: 120,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 45,
    });
    expect(bikeSetDurationSeconds(custom!.spec)).toBe(60 + 8 * 30 * 2 + 45 + 120);
    const added = prescriptionWithBikeChoice("added|old", "Assault bike intervals", custom!).slice(0, 160);
    expect(bikeChoiceFromKey(added)?.spec).toMatchObject({
      repeatRounds: 2,
      restBetweenRoundsSeconds: 45,
      warmupSeconds: 60,
      cooldownSeconds: 120,
    });
    expect(
      customBikeChoice({
        workSeconds: 120,
        restSeconds: 180,
        rounds: 30,
        repeatRounds: 10,
        restBetweenRoundsSeconds: 300,
      }),
    ).toBeNull();
    const longest = customBikeChoice({
      workSeconds: 120,
      restSeconds: 60,
      rounds: 8,
      warmupSeconds: 600,
      cooldownSeconds: 600,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
    })!;
    const packed = prescriptionWithBikeChoice("added|old", "Assault bike intervals", longest).slice(0, 160);
    expect(bikeChoiceFromKey(packed)?.spec.repeatRounds).toBe(2);
    expect(compactBikeReps(formatBikeRecipe(longest)).startsWith("bw c.")).toBe(true);
  });

  it("reads past bike sessions from logged sets", () => {
    const triple = bikeChoiceWithRounds(bikeChoiceById("tabata")!, 3, 60)!;
    const rows = bikeHistoryFromSessions([
      {
        id: "chosen",
        title: "Day 4 — Assault bike",
        performedAt: "2026-10-20T15:00:00.000Z",
        sets: [
          {
            exerciseName: "Assault bike intervals",
            completed: true,
            durationSeconds: 840,
            prescriptionKey: prescriptionWithBikeChoice("day|assault bike intervals::15swork/15srest×8", "Assault bike intervals", triple),
          },
          {
            exerciseName: "Squat",
            completed: true,
            prescriptionKey: "squat",
          },
        ],
      },
      {
        id: "programmed",
        title: "Day 4 — Assault bike",
        performedAt: "2026-10-18T15:00:00.000Z",
        sets: [
          {
            exerciseName: "Assault bike intervals",
            completed: true,
            prescriptionKey: "demo:4|assault bike intervals::15swork/15srest×8",
          },
          {
            exerciseName: "Assault bike intervals",
            completed: false,
            prescriptionKey: "demo:4|assault bike intervals::15swork/15srest×8",
          },
        ],
      },
    ]);
    expect(rows.map((row) => row.sessionId)).toEqual(["chosen", "programmed"]);
    expect(rows[0]).toMatchObject({
      workoutName: triple.name,
      workSeconds: 20,
      restSeconds: 10,
      sprints: 8,
      rounds: 3,
      restBetweenRoundsSeconds: 60,
      completed: true,
    });
    expect(rows[1]).toMatchObject({
      workSeconds: 15,
      restSeconds: 15,
      sprints: 8,
      rounds: 2,
      completed: false,
      doneSets: 1,
      totalSets: 2,
    });
    const chosen = bikeHistoryLine({
      id: "chosen",
      title: "Day 4 — Assault bike",
      performedAt: "2026-10-20T15:00:00.000Z",
      sets: [
        {
          exerciseName: "Assault bike intervals",
          completed: true,
          durationSeconds: 840,
          prescriptionKey: prescriptionWithBikeChoice(
            "day|assault bike intervals::15swork/15srest×8",
            "Assault bike intervals",
            triple,
          ),
        },
      ],
    });
    expect(triple.plain).toBe("3 × 8 rounds · 20/10 · 60s between sets");
    expect(chosen).toBe(`${triple.name} · 24 rounds`);
    expect(chosen).not.toMatch(/completed|open/);
    expect(chosen?.match(/rounds/g)).toHaveLength(2);
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

  it("stores the new work on each kept set so history matches the structure", () => {
    const choice = customBikeChoice({ workSeconds: 105 * 60, restSeconds: 0, rounds: 1 });
    expect(choice).not.toBeNull();
    const sets = retainBikeChoiceSets(
      [
        {
          exerciseName: "Assault bike intervals",
          completed: true,
          setNumber: 1,
          prescriptionKey: "day|assault bike intervals::30:00",
          durationSeconds: 1800,
        },
      ],
      "Assault bike intervals",
      choice!,
    );
    expect(sets[0]?.durationSeconds).toBe(105 * 60);
    const line = roundHistoryLine({
      elapsedSeconds: 1800,
      sets: sets.map((set) => ({ ...set, logMode: "timed_round" })),
    });
    expect(line).toContain("1:45:00 round");
    expect(line).toContain("1:45:00 total");
    expect(line).not.toContain("30:00 round");
    const sheet = fs.readFileSync("src/components/training/BikeWorkoutSheet.tsx", "utf8");
    const apply = sheet.slice(sheet.indexOf("function applyCustom"), sheet.indexOf("function selectPicker"));
    expect(apply).toContain("commitShorthand");
    expect(apply).toContain("if (committed.error)");
    expect(apply.indexOf("commitShorthand")).toBeLessThan(apply.indexOf("customBikeChoice"));
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
