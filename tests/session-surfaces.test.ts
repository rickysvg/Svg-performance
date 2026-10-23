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
    expect(bikeHistory).toBe("1/3 sets · Partial");
  });
});
