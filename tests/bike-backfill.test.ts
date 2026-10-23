import { describe, expect, it } from "vitest";
import {
  bikeBackfillChoice,
  bikeBackfillFormFromSpec,
  bikeBackfillMinutes,
  bikeBackfillSpecFromExercises,
  bikeBackfillTotalRounds,
  syncBikeBackfillForm,
} from "@/lib/bike-backfill";
import { bikeChoiceFromKey } from "@/lib/bike-chooser";
import { bikeSetDurationSeconds } from "@/lib/bike-interval-timer";
import { bikeTimerLogSets } from "@/lib/bike-timer-log";

describe("past bike interval fields", () => {
  it("prefills work, rest, rounds, and sets from the day's bike row", () => {
    const spec = bikeBackfillSpecFromExercises([
      { name: "Back squat", sets: 5, reps: "5", restSeconds: 120 },
      {
        name: "Assault bike intervals",
        sets: 2,
        reps: "15s work / 15s rest × 8",
        restSeconds: 60,
      },
    ]);
    expect(spec).toEqual({
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      sets: 2,
      restBetweenSetsSeconds: 60,
    });
    expect(bikeBackfillSpecFromExercises([{ name: "Bench press", sets: 3, reps: "8" }])).toBeNull();
  });

  it("calculates minutes and total rounds, and keeps a typed minute until the interval changes", () => {
    const spec = {
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      sets: 2,
      restBetweenSetsSeconds: 0,
    };
    expect(bikeBackfillTotalRounds(spec)).toBe(16);
    const choice = bikeBackfillChoice(spec);
    expect(choice).not.toBeNull();
    expect(bikeBackfillMinutes(spec)).toBe(Math.max(1, Math.round(bikeSetDurationSeconds(choice!.spec) / 60)));
    expect(bikeSetDurationSeconds(choice!.spec)).toBe(8 * 30 * 2);
    const form = bikeBackfillFormFromSpec(spec);
    expect(form.doneRounds).toBe(16);
    expect(form.minutes).toBe(8);
    const typed = syncBikeBackfillForm(form, { source: "minutes", minutes: 12 });
    expect(typed.minutes).toBe(12);
    expect(typed.minutesEdited).toBe(true);
    const changed = syncBikeBackfillForm(typed, { source: "interval", sets: 1 });
    expect(changed.minutesEdited).toBe(false);
    expect(changed.doneRounds).toBe(8);
    expect(changed.minutes).toBe(4);
    const finished = syncBikeBackfillForm(form, { source: "finished", doneRounds: 10 });
    expect(finished.doneRounds).toBe(10);
    expect(finished.finishedEdited).toBe(true);
    const key = bikeTimerLogSets(choice!, "lb", 16)[0]?.prescriptionKey ?? "";
    expect(bikeChoiceFromKey(key)?.spec).toMatchObject({
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      repeatRounds: 2,
    });
  });
});
