import { describe, expect, it } from "vitest";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { restoreLoggerSets } from "@/lib/logger-sets";
import { prepareSetsForPersist } from "@/lib/logged-work";

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
});

describe("save payload", () => {
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
