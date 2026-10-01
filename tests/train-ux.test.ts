import { describe, expect, it } from "vitest";
import { loggerCursor, nextIncompleteSetId } from "@/lib/logger-progress";
import { nextTrainAction } from "@/lib/train-next";

describe("train next action", () => {
  it("starts the first session and resumes when that session has a draft", () => {
    const sessions = [
      { title: "Monday bag", kind: "skill", dayId: "bag", href: "/training/bag" },
      { title: "Squat day", kind: "strength", dayId: "lift", href: "/training/lift" },
    ];
    expect(nextTrainAction(sessions, () => undefined)).toMatchObject({
      verb: "Start",
      title: "Monday bag",
      dayId: "bag",
    });
    expect(nextTrainAction(sessions, (dayId) => (dayId === "bag" ? "draft-1" : undefined))).toMatchObject({
      verb: "Resume",
      title: "Monday bag",
      draftId: "draft-1",
    });
    expect(nextTrainAction([{ title: "Rest day", kind: "rest" }], () => undefined)).toBeNull();
  });
});

describe("logger next-set cursor", () => {
  const groups = [
    {
      name: "Shadow",
      sets: [{ id: "a", completed: true }],
    },
    {
      name: "Bag",
      sets: [
        { id: "b", completed: true },
        { id: "c", completed: false },
        { id: "d", completed: false },
      ],
    },
  ];

  it("points at the first open set", () => {
    expect(loggerCursor(groups)).toMatchObject({
      exerciseIndex: 2,
      exerciseCount: 2,
      exerciseName: "Bag",
      setIndex: 2,
      setCount: 3,
      done: false,
    });
    expect(nextIncompleteSetId(
      groups.flatMap((group) => group.sets),
      "b",
    )).toBe("c");
  });
});
