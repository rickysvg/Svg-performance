import { describe, expect, it } from "vitest";
import {
  calendarSessionText,
  finishSessionText,
  historySessionText,
} from "@/lib/session-progress";

const liftSet = {
  exerciseName: "Weighted push-up",
  completed: true,
  reps: 8,
  loadValue: 25,
  durationSeconds: null,
};

const bikeSet = {
  exerciseName: "Assault bike intervals",
  completed: true,
  reps: null,
  loadValue: null,
  durationSeconds: 20,
  prescriptionKey: "bike:alactic",
  logMode: "timed_round" as const,
};

describe("History, Calendar, and the finish screen share one progress line", () => {
  it("uses the scaled dose for a one-set lift and the stored round plan for a partial bike", () => {
    const lift = {
      status: "complete",
      plannedSetCount: 1,
      programDayId: "lift-day",
      sets: [liftSet],
      programDay: {
        exercises: [
          { name: "Weighted push-up", sets: 4 },
          { name: "Hip switches", sets: 30 },
        ],
      },
    };
    const liftDose = {
      dose: 26,
      names: ["Weighted push-up", "Hip switches"],
      exercises: [
        { name: "Weighted push-up", sets: 2 },
        { name: "90/90 hip switches", sets: 2 },
      ],
    };
    const liftHistory = historySessionText(lift, liftDose);
    const liftCalendar = calendarSessionText(lift, liftDose);
    const liftFinish = finishSessionText(lift, liftDose);
    expect(liftHistory).toBe(liftCalendar);
    expect(liftCalendar).toBe(liftFinish);
    expect(liftHistory).toBe("1/26 sets · Partial");

    const bike = {
      status: "complete",
      plannedSetCount: 1,
      programDayId: "bike-day",
      sets: [bikeSet],
      programDay: { exercises: [{ name: "Assault bike intervals", sets: 3 }] },
    };
    const bikeDose = { dose: 26, names: ["Assault bike intervals"], exercises: [{ name: "Assault bike intervals", sets: 3 }] };
    const bikeHistory = historySessionText(bike, bikeDose);
    const bikeCalendar = calendarSessionText(bike, bikeDose);
    const bikeFinish = finishSessionText(bike, bikeDose);
    expect(bikeHistory).toBe(bikeCalendar);
    expect(bikeCalendar).toBe(bikeFinish);
    expect(bikeHistory).toBe("1/3 rounds · Partial");

    const doneRounds = {
      status: "complete",
      plannedSetCount: 3,
      sets: [1, 2, 3].map(() => bikeSet),
    };
    expect(historySessionText(doneRounds)).toBe("3/3 rounds · Done");
    expect(calendarSessionText(doneRounds)).toBe(finishSessionText(doneRounds));

    const squat = {
      exerciseName: "Squat",
      completed: true,
      reps: 5,
      loadValue: 135,
      durationSeconds: null,
    };
    const bag = {
      exerciseName: "Heavy bag rounds",
      completed: true,
      reps: null,
      loadValue: null,
      durationSeconds: 180,
      prescriptionKey: "round:bag:60",
      logMode: "timed_round" as const,
    };
    const mixedExercises = [
      { name: "Squat", sets: 5 },
      { name: "Heavy bag rounds", sets: 3 },
    ];
    const mixed = {
      status: "complete",
      plannedSetCount: 8,
      programDayId: "mixed-day",
      sets: [...Array.from({ length: 5 }, () => squat), ...Array.from({ length: 3 }, () => bag)],
      programDay: { exercises: mixedExercises },
    };
    const mixedDose = {
      dose: 8,
      names: ["Squat", "Heavy bag rounds"],
      exercises: mixedExercises,
    };
    const mixedText = "5/5 sets · 3/3 rounds · Done";
    expect(historySessionText(mixed, mixedDose)).toBe(mixedText);
    expect(calendarSessionText(mixed, mixedDose)).toBe(mixedText);
    expect(finishSessionText(mixed, mixedDose)).toBe(mixedText);

    const token = "timer#bw:c.15.15.8.0.0.2.60";
    const interval = {
      exerciseName: "Assault bike intervals",
      completed: true,
      reps: null,
      loadValue: null,
      durationSeconds: 15,
      prescriptionKey: token,
      logMode: "timed_round" as const,
    };
    const sixteen = {
      status: "complete",
      plannedSetCount: 1,
      programDayId: "bike-day",
      sets: Array.from({ length: 16 }, () => interval),
      programDay: { exercises: [{ name: "Assault bike intervals", sets: 1 }] },
    };
    expect(historySessionText(sixteen)).toBe("16/16 rounds · Done");
    expect(calendarSessionText(sixteen)).toBe("16/16 rounds · Done");
    expect(finishSessionText(sixteen)).toBe("16/16 rounds · Done");
    const twelve = { ...sixteen, status: "partial", sets: sixteen.sets.slice(0, 12) };
    expect(calendarSessionText(twelve)).toBe("12/16 rounds · Partial");

    const shadow = {
      status: "complete",
      plannedSetCount: 2,
      sets: [1, 2].map((round) => ({
        exerciseName: `Shadowbox round ${round} — empty hands`,
        completed: true,
        reps: null,
        loadValue: null,
        durationSeconds: 180,
      })),
    };
    expect(historySessionText(shadow)).toBe("2/2 rounds · Done");
    expect(calendarSessionText(shadow)).toBe(finishSessionText(shadow));
  });
});
