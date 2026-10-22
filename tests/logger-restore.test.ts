import { describe, expect, it } from "vitest";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { restoreLoggerSets } from "@/lib/logger-sets";
import { planWorkFromText, prepareSetsForPersist, withTickedPlanWork } from "@/lib/logged-work";
import { prescriptionSlotKey } from "@/lib/prescription-slot";

type Row = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  completed?: boolean;
};

function row(
  exerciseName: string,
  setNumber: number,
  reps: number | null = null,
  loadValue: number | null = null,
): Row {
  return { exerciseName, setNumber, reps, loadValue, completed: reps != null || loadValue != null };
}

function create(exerciseName: string, setNumber: number): Row {
  return row(exerciseName, setNumber);
}

const woodchop = [{ name: "Cable woodchop", sets: 4 }];

describe("logger restore", () => {
  it("keeps 4 rows when a bloated draft is restored twice", () => {
    const server = [1, 2, 3, 4].map((setNumber) => row("Cable woodchop", setNumber));
    const bloated = [
      ...[1, 2, 3, 4].map((setNumber) =>
        row("Cable or band woodchop", setNumber, setNumber === 1 ? 6 : null, setNumber === 1 ? 25 : null),
      ),
      ...[5, 6, 7, 8].map((setNumber) => row("Cable woodchop", setNumber)),
      ...[9, 10, 11, 12].map((setNumber) => row("Cable woodchop", setNumber)),
    ];
    const once = restoreLoggerSets(server, { sets: bloated }, woodchop, create, gymExerciseKey);
    const twice = restoreLoggerSets(once, { sets: once }, woodchop, create, gymExerciseKey);
    expect(twice.map((set) => set.exerciseName)).toEqual([
      "Cable woodchop",
      "Cable woodchop",
      "Cable woodchop",
      "Cable woodchop",
    ]);
    expect(twice.map((set) => set.setNumber)).toEqual([1, 2, 3, 4]);
    expect(twice[0]).toMatchObject({ reps: 6, loadValue: 25 });
    expect(twice.slice(1).every((set) => set.reps == null && set.loadValue == null)).toBe(true);
  });

  it("keeps one user-added set and does not append the prescription again", () => {
    const withExtra = [1, 2, 3, 4, 5].map((setNumber) =>
      row("Lateral bound", setNumber, setNumber === 5 ? 4 : null),
    );
    const restored = restoreLoggerSets(
      withExtra,
      { sets: withExtra },
      [{ name: "Lateral bound", sets: 4 }],
      create,
      gymExerciseKey,
    );
    expect(restored).toHaveLength(5);
    expect(restored[4]).toMatchObject({ setNumber: 5, reps: 4 });
    const again = restoreLoggerSets(restored, { sets: restored }, [{ name: "Lateral bound", sets: 4 }], create, gymExerciseKey);
    expect(again).toHaveLength(5);
  });

  it("collapses an alias onto the prescription name", () => {
    const restored = restoreLoggerSets(
      [row("Cable or band woodchop", 1, 8, 20), row("Cable woodchop", 1)],
      null,
      woodchop,
      create,
      gymExerciseKey,
    );
    expect(restored.filter((set) => gymExerciseKey(set.exerciseName) === gymExerciseKey("Cable woodchop"))).toHaveLength(4);
    expect(restored[0]).toMatchObject({ exerciseName: "Cable woodchop", reps: 8, loadValue: 20 });
  });

  it("puts a missing planned exercise back when the save only stored one", () => {
    const restored = restoreLoggerSets(
      [row("Goblet squat", 1, 8, 40)],
      null,
      [
        { name: "Goblet squat", sets: 3 },
        { name: "Bench press", sets: 3 },
      ],
      create,
    );
    const goblet = restored.filter((set) => set.exerciseName === "Goblet squat");
    const bench = restored.filter((set) => set.exerciseName === "Bench press");
    expect(goblet).toHaveLength(3);
    expect(bench).toHaveLength(3);
    expect(goblet[0]).toMatchObject({ reps: 8, loadValue: 40 });
    expect(bench.every((set) => set.reps == null)).toBe(true);
  });
});

describe("save payload", () => {
  it("counts a ticked set when the plan already named the reps", () => {
    const key = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "6 / side",
      programSlug: "demo",
      dayNumber: 3,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        completed: true,
        prescriptionKey: key,
      }),
    ).toMatchObject({ reps: 6, loadValue: null, completed: true });
    expect(
      withTickedPlanWork({
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        completed: true,
      }).reps,
    ).toBeNull();
    expect(planWorkFromText("3x5")).toEqual({ reps: 5, seconds: null });
    expect(planWorkFromText("3×5")).toEqual({ reps: 5, seconds: null });
    expect(planWorkFromText("1 min")).toEqual({ reps: null, seconds: 60 });
    expect(planWorkFromText("1min")).toEqual({ reps: null, seconds: 60 });
    expect(planWorkFromText("30–40 sec")).toEqual({ reps: null, seconds: 30 });
    expect(planWorkFromText("30-40sec")).toEqual({ reps: null, seconds: 30 });
    expect(planWorkFromText("5 sec × 4 directions")).toEqual({ reps: null, seconds: 5 });
    expect(planWorkFromText("3:00")).toEqual({ reps: null, seconds: 180 });
    expect(planWorkFromText("1.5 min")).toEqual({ reps: null, seconds: 90 });
    expect(planWorkFromText("1.5min")).toEqual({ reps: null, seconds: 90 });
    expect(planWorkFromText("2 x 30 sec")).toEqual({ reps: null, seconds: 30 });
    expect(planWorkFromText("2x30sec")).toEqual({ reps: null, seconds: 30 });
    const minuteKey = prescriptionSlotKey({
      exerciseName: "Plank",
      reps: "1 min",
      programSlug: "demo",
      dayNumber: 3,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Plank",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed",
        completed: true,
        prescriptionKey: minuteKey,
      }),
    ).toMatchObject({ reps: null, durationSeconds: 60 });
    const setsKey = prescriptionSlotKey({
      exerciseName: "Bench press",
      reps: "3x5",
      programSlug: "demo",
      dayNumber: 1,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Bench press",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "load_reps",
        completed: true,
        prescriptionKey: setsKey,
      }),
    ).toMatchObject({ reps: 5 });
    const clockKey = prescriptionSlotKey({
      exerciseName: "Shadowbox round 1 — empty hands",
      reps: "3:00",
      programSlug: "demo",
      dayNumber: 2,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Shadowbox round 1 — empty hands",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed_round",
        completed: true,
        prescriptionKey: clockKey,
      }),
    ).toMatchObject({ durationSeconds: 180 });
    const decimalKey = prescriptionSlotKey({
      exerciseName: "Plank",
      reps: "1.5 min",
      programSlug: "demo",
      dayNumber: 3,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Plank",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed",
        completed: true,
        prescriptionKey: decimalKey,
      }),
    ).toMatchObject({ durationSeconds: 90 });
    const setsTimeKey = prescriptionSlotKey({
      exerciseName: "Jump rope",
      reps: "2 x 30 sec",
      programSlug: "demo",
      dayNumber: 4,
    });
    expect(
      withTickedPlanWork({
        exerciseName: "Jump rope",
        setNumber: 1,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed",
        completed: true,
        prescriptionKey: setsTimeKey,
      }),
    ).toMatchObject({ durationSeconds: 30 });
  });

  it("saves typed sets from a bloated logger and drops empty copies", () => {
    const bloated = [
      ...[1, 2, 3, 4].flatMap((setNumber) => [
        {
          exerciseName: "Cable woodchop",
          setNumber,
          reps: setNumber <= 2 ? 6 : null,
          loadValue: setNumber <= 2 ? 25 : null,
          loadUnit: "lb",
          completed: setNumber <= 2,
        },
        {
          exerciseName: "Cable or band woodchop",
          setNumber,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          completed: false,
        },
      ]),
      ...[5, 6, 7, 8, 9, 10, 11, 12].map((setNumber) => ({
        exerciseName: "Cable woodchop",
        setNumber,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        completed: false,
      })),
    ];
    const saved = prepareSetsForPersist(bloated, "complete");
    expect(saved).toEqual([
      expect.objectContaining({ exerciseName: "Cable woodchop", setNumber: 1, reps: 6, loadValue: 25 }),
      expect.objectContaining({ exerciseName: "Cable woodchop", setNumber: 2, reps: 6, loadValue: 25 }),
    ]);
  });

  it("keeps an empty planned row on a draft and refuses a finish with nothing logged", () => {
    const draft = prepareSetsForPersist(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
        {
          exerciseName: "Goblet squat",
          setNumber: 2,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          completed: false,
        },
      ],
      "draft",
    );
    expect(draft).toHaveLength(2);
    expect(prepareSetsForPersist(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          completed: true,
        },
      ],
      "complete",
    )).toEqual([]);
  });

  it("keeps one bike row after a chosen workout instead of refilling the program count", () => {
    const server = [
      {
        exerciseName: "Assault bike intervals",
        setNumber: 1,
        reps: null,
        loadValue: null,
        prescriptionKey: "demo:4|assault bike intervals::15s#bw:tabata",
      },
    ];
    const restored = restoreLoggerSets(
      server,
      null,
      [{ name: "Assault bike intervals", sets: 4 }],
      (exerciseName, setNumber) => ({
        exerciseName,
        setNumber,
        reps: null,
        loadValue: null,
        prescriptionKey: "",
      }),
      gymExerciseKey,
    );
    expect(restored).toHaveLength(1);
    expect(restored[0]?.prescriptionKey).toContain("#bw:tabata");
  });
});
