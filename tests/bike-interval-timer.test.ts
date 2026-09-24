import { describe, expect, it } from "vitest";
import {
  bikeIntervalCompletionEffects,
  bikeSetDurationSeconds,
  idleBikeInterval,
  pauseBikeInterval,
  resumeBikeInterval,
  startBikeInterval,
  stopBikeInterval,
  tickBikeInterval,
  viewAtElapsed,
  type BikeIntervalCue,
} from "@/lib/bike-interval-timer";

const fifteen = { workSeconds: 15, restSeconds: 15, roundsPerSet: 8 };
const tenTwenty = { workSeconds: 10, restSeconds: 20, roundsPerSet: 4 };

function runTicks(spec: typeof fifteen, count: number) {
  let snapshot = startBikeInterval(spec);
  let lastCue: BikeIntervalCue = "none";
  const cues: BikeIntervalCue[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = tickBikeInterval(snapshot);
    snapshot = next.snapshot;
    lastCue = next.cue;
    if (next.cue !== "none") cues.push(next.cue);
  }
  return { snapshot, lastCue, cues };
}

describe("bike interval timer", () => {
  it("starts on WORK round 1 and alternates work then rest for each round", () => {
    const start = startBikeInterval(fifteen);
    expect(start.phase).toBe("work");
    expect(start.round).toBe(1);
    expect(start.remainingSeconds).toBe(15);

    expect(viewAtElapsed(fifteen, 14)).toMatchObject({
      phase: "work",
      round: 1,
      remainingSeconds: 1,
    });
    expect(viewAtElapsed(fifteen, 15)).toMatchObject({
      phase: "rest",
      round: 1,
      remainingSeconds: 15,
    });
    expect(viewAtElapsed(fifteen, 30)).toMatchObject({
      phase: "work",
      round: 2,
      remainingSeconds: 15,
    });
    expect(viewAtElapsed(fifteen, 7 * 30 + 14)).toMatchObject({
      phase: "work",
      round: 8,
      remainingSeconds: 1,
    });
    expect(viewAtElapsed(fifteen, 8 * 30 - 1)).toMatchObject({
      phase: "rest",
      round: 8,
      remainingSeconds: 1,
    });
  });

  it("counts eight 15/15 rounds then completes", () => {
    expect(bikeSetDurationSeconds(fifteen)).toBe(240);
    const { snapshot, lastCue } = runTicks(fifteen, 240);
    expect(snapshot.phase).toBe("done");
    expect(snapshot.round).toBe(8);
    expect(snapshot.remainingSeconds).toBe(0);
    expect(lastCue).toBe("complete");
    expect(tickBikeInterval(snapshot).snapshot.phase).toBe("done");
  });

  it("beeps work-warning on the last 3 seconds of a work interval", () => {
    const { cues } = runTicks(fifteen, 15);
    expect(cues.filter((cue) => cue === "work-warning")).toEqual([
      "work-warning",
      "work-warning",
      "work-warning",
    ]);
    expect(cues.at(-1)).toBe("phase");
  });

  it("reads work/rest/rounds from the session so later rotations reuse it", () => {
    expect(bikeSetDurationSeconds(tenTwenty)).toBe(120);
    expect(viewAtElapsed(tenTwenty, 9)).toMatchObject({
      phase: "work",
      round: 1,
      remainingSeconds: 1,
    });
    expect(viewAtElapsed(tenTwenty, 10)).toMatchObject({
      phase: "rest",
      round: 1,
      remainingSeconds: 20,
    });
    expect(viewAtElapsed(tenTwenty, 30)).toMatchObject({
      phase: "work",
      round: 2,
    });
    const { snapshot, lastCue } = runTicks(tenTwenty, 120);
    expect(snapshot.phase).toBe("done");
    expect(snapshot.round).toBe(4);
    expect(lastCue).toBe("complete");
  });

  it("pauses without advancing and stop returns to idle", () => {
    let snapshot = startBikeInterval(fifteen);
    snapshot = tickBikeInterval(snapshot).snapshot;
    expect(snapshot.remainingSeconds).toBe(14);
    snapshot = pauseBikeInterval(snapshot);
    const held = tickBikeInterval(snapshot).snapshot;
    expect(held.paused).toBe(true);
    expect(held.remainingSeconds).toBe(14);
    snapshot = resumeBikeInterval(held);
    snapshot = tickBikeInterval(snapshot).snapshot;
    expect(snapshot.remainingSeconds).toBe(13);
    expect(stopBikeInterval(snapshot)).toMatchObject(idleBikeInterval(fifteen));
  });

  it("treats rest=0 as work-only rounds with no REST phase", () => {
    const clock = { workSeconds: 13 * 60, restSeconds: 0, roundsPerSet: 1 };
    expect(bikeSetDurationSeconds(clock)).toBe(780);
    expect(viewAtElapsed(clock, 0)).toMatchObject({
      phase: "work",
      round: 1,
      remainingSeconds: 780,
    });
    expect(viewAtElapsed(clock, 779)).toMatchObject({
      phase: "work",
      remainingSeconds: 1,
    });
    expect(viewAtElapsed(clock, 780).phase).toBe("done");

    const alactic = { workSeconds: 10, restSeconds: 50, roundsPerSet: 3 };
    expect(viewAtElapsed(alactic, 10)).toMatchObject({ phase: "rest", round: 1 });
    const workOnly = { workSeconds: 10, restSeconds: 0, roundsPerSet: 3 };
    expect(bikeSetDurationSeconds(workOnly)).toBe(30);
    expect(viewAtElapsed(workOnly, 10)).toMatchObject({
      phase: "work",
      round: 2,
      remainingSeconds: 10,
    });
    expect(viewAtElapsed(workOnly, 29).phase).toBe("work");
    expect(viewAtElapsed(workOnly, 30).phase).toBe("done");
  });

  it("completion marks the set done and starts the 60s between-set rest", () => {
    const { snapshot, lastCue } = runTicks(fifteen, 240);
    expect(snapshot.phase).toBe("done");
    expect(lastCue).toBe("complete");
    const effects = bikeIntervalCompletionEffects({
      exerciseName: "Assault bike intervals",
      restBetweenSetsSeconds: 60,
      nowMs: 5_000,
    });
    expect(effects.completed).toBe(true);
    expect(effects.rest).toMatchObject({
      exerciseName: "Assault bike intervals",
      durationSeconds: 60,
      endsAtMs: 65_000,
    });
  });
});
