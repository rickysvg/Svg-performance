import { describe, expect, it } from "vitest";
import { withPrescribedSetRows } from "@/lib/logger-sets";
import { loggerCursor } from "@/lib/logger-progress";

describe("prescribed logger rows", () => {
  it("opens a 4-set prescription with 4 rows and keeps extras", () => {
    const stored = [
      { exerciseName: "Band pull-apart or face pull", setNumber: 1 },
      { exerciseName: "Band pull-apart or face pull", setNumber: 2 },
      { exerciseName: "Dead bug", setNumber: 1 },
      { exerciseName: "Dead bug", setNumber: 2 },
    ];
    const padded = withPrescribedSetRows(
      stored,
      [
        { name: "Band pull-apart or face pull", sets: 4 },
        { name: "Dead bug", sets: 4 },
      ],
      (exerciseName, setNumber) => ({ exerciseName, setNumber }),
    );
    expect(padded.filter((set) => set.exerciseName === "Band pull-apart or face pull")).toEqual([
      { exerciseName: "Band pull-apart or face pull", setNumber: 1 },
      { exerciseName: "Band pull-apart or face pull", setNumber: 2 },
      { exerciseName: "Band pull-apart or face pull", setNumber: 3 },
      { exerciseName: "Band pull-apart or face pull", setNumber: 4 },
    ]);
    expect(padded.filter((set) => set.exerciseName === "Dead bug")).toHaveLength(4);

    const withExtra = withPrescribedSetRows(
      [...padded, { exerciseName: "Band pull-apart or face pull", setNumber: 5 }],
      [{ name: "Band pull-apart or face pull", sets: 4 }],
      (exerciseName, setNumber) => ({ exerciseName, setNumber }),
    );
    expect(withExtra.filter((set) => set.exerciseName === "Band pull-apart or face pull")).toHaveLength(
      5,
    );

    const cursor = loggerCursor([
      {
        name: "Band pull-apart or face pull",
        sets: padded
          .filter((set) => set.exerciseName === "Band pull-apart or face pull")
          .map((set) => ({ id: String(set.setNumber), completed: false })),
      },
    ]);
    expect(cursor.setIndex).toBe(1);
    expect(cursor.setCount).toBe(4);
  });
});
