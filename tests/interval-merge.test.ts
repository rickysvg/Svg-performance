import { describe, expect, it } from "vitest";
import { canMergeIntervalLog } from "@/lib/interval-merge";

const clock = {
  workSeconds: 180,
  restSeconds: 60,
  sets: 1,
  setRestSeconds: 0,
  roundsCompleted: 3,
};

function bagSet(duration = 180, key = "round:bag:60:1:0:3") {
  return {
    exerciseName: "Heavy bag rounds",
    logMode: "timed_round",
    prescriptionKey: key,
    durationSeconds: duration,
    completed: true,
  };
}

describe("canMergeIntervalLog", () => {
  it("extends the same plan, type, and clock when the new count is at least the stored count", () => {
    expect(
      canMergeIntervalLog(
        { status: "partial", programDayId: "day", timerStartedAt: null, sets: [bagSet()] },
        { type: "bag", programDayId: "day", clock },
      ),
    ).toBe(true);
  });

  it("refuses a different duration, a shorter log, a mixed draft, and a running draft", () => {
    const session = { status: "partial", programDayId: "day", timerStartedAt: null, sets: [bagSet()] };
    expect(
      canMergeIntervalLog(session, {
        type: "bag",
        programDayId: "day",
        clock: { ...clock, workSeconds: 120 },
      }),
    ).toBe(false);
    expect(
      canMergeIntervalLog(
        { ...session, sets: [bagSet(), bagSet(), bagSet()] },
        { type: "bag", programDayId: "day", clock: { ...clock, roundsCompleted: 2 } },
      ),
    ).toBe(false);
    expect(
      canMergeIntervalLog(
        {
          status: "draft",
          programDayId: "day",
          timerStartedAt: new Date("2026-10-21T18:10:00.000Z"),
          sets: [
            bagSet(),
            {
              exerciseName: "Back squat",
              logMode: "load_reps",
              prescriptionKey: "squat",
              reps: 5,
              loadValue: 135,
              completed: true,
            },
          ],
        },
        { type: "bag", programDayId: "day", clock },
      ),
    ).toBe(false);
    expect(
      canMergeIntervalLog(
        {
          status: "draft",
          programDayId: "day",
          timerStartedAt: new Date("2026-10-21T18:10:00.000Z"),
          sets: [bagSet()],
        },
        { type: "bag", programDayId: "day", clock },
      ),
    ).toBe(false);
    expect(
      canMergeIntervalLog(
        { status: "draft", programDayId: "day", timerStartedAt: null, sets: [bagSet()] },
        { type: "bag", programDayId: "day", clock },
        false,
      ),
    ).toBe(false);
    expect(
      canMergeIntervalLog(
        { status: "draft", programDayId: "day", timerStartedAt: null, sets: [bagSet()] },
        { type: "bag", programDayId: "day", clock },
      ),
    ).toBe(false);
  });

  it("refuses 20/10 into 15/15 and a 2-set block into a single Tabata", () => {
    const bike = (key: string, duration: number) => ({
      exerciseName: "Assault bike intervals",
      logMode: "timed_round",
      prescriptionKey: key,
      durationSeconds: duration,
      completed: true,
    });
    const fifteen = "timer#bw:c.15.15.8.0.0.1.0";
    expect(
      canMergeIntervalLog(
        { status: "complete", programDayId: null, sets: [bike(fifteen, 15)] },
        {
          type: "bike",
          programDayId: null,
          clock: { workSeconds: 20, restSeconds: 10, sets: 1, setRestSeconds: 0, roundsCompleted: 8 },
        },
      ),
    ).toBe(false);
    const tabata = "timer#bw:tabata";
    expect(
      canMergeIntervalLog(
        { status: "complete", programDayId: null, sets: Array.from({ length: 8 }, () => bike(tabata, 20)) },
        {
          type: "bike",
          programDayId: null,
          clock: { workSeconds: 15, restSeconds: 15, sets: 2, setRestSeconds: 60, roundsCompleted: 16 },
        },
      ),
    ).toBe(false);
  });
});
