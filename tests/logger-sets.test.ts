import { describe, expect, it } from "vitest";
import { withPrescribedSetRows } from "@/lib/logger-sets";
import { loggerCursor } from "@/lib/logger-progress";

describe("prescribed logger rows", () => {
  it("opens a 4-set prescription with 4 rows and keeps extras", () => {
    const stored = [
      { exerciseName: "Face pull", setNumber: 1 },
      { exerciseName: "Face pull", setNumber: 2 },
      { exerciseName: "Dead bug", setNumber: 1 },
      { exerciseName: "Dead bug", setNumber: 2 },
    ];
    const padded = withPrescribedSetRows(
      stored,
      [
        { name: "Face pull", sets: 4 },
        { name: "Dead bug", sets: 4 },
      ],
      (exerciseName, setNumber) => ({ exerciseName, setNumber }),
    );
    expect(padded.filter((set) => set.exerciseName === "Face pull")).toEqual([
      { exerciseName: "Face pull", setNumber: 1 },
      { exerciseName: "Face pull", setNumber: 2 },
      { exerciseName: "Face pull", setNumber: 3 },
      { exerciseName: "Face pull", setNumber: 4 },
    ]);
    expect(padded.filter((set) => set.exerciseName === "Dead bug")).toHaveLength(4);

    const withExtra = withPrescribedSetRows(
      [...padded, { exerciseName: "Face pull", setNumber: 5 }],
      [{ name: "Face pull", sets: 4 }],
      (exerciseName, setNumber) => ({ exerciseName, setNumber }),
    );
    expect(withExtra.filter((set) => set.exerciseName === "Face pull")).toHaveLength(
      5,
    );

    const cursor = loggerCursor([
      {
        name: "Face pull",
        sets: padded
          .filter((set) => set.exerciseName === "Face pull")
          .map((set) => ({ id: String(set.setNumber), completed: false })),
      },
    ]);
    expect(cursor.setIndex).toBe(1);
    expect(cursor.setCount).toBe(4);
  });
});
