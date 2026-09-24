import { restTimerAfterSetDone } from "@/lib/logger-prefill";
import type { RestTimerState } from "@/lib/rest-timer";

export type BikeIntervalSpec = {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
};

export type BikeIntervalPhase = "idle" | "work" | "rest" | "done";

export type BikeIntervalCue = "none" | "phase" | "work-warning" | "complete";

export type BikeIntervalSnapshot = {
  spec: BikeIntervalSpec;
  phase: BikeIntervalPhase;
  round: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  paused: boolean;
};

export function bikeSetDurationSeconds(spec: BikeIntervalSpec) {
  const work = Math.max(0, spec.workSeconds);
  const rest = Math.max(0, spec.restSeconds);
  const rounds = Math.max(1, spec.roundsPerSet);
  if (rest <= 0) return rounds * work;
  return rounds * (work + rest);
}

export function idleBikeInterval(spec: BikeIntervalSpec): BikeIntervalSnapshot {
  return {
    spec,
    phase: "idle",
    round: 1,
    remainingSeconds: Math.max(0, spec.workSeconds),
    elapsedSeconds: 0,
    paused: false,
  };
}

export function startBikeInterval(spec: BikeIntervalSpec): BikeIntervalSnapshot {
  return viewAtElapsed(spec, 0);
}

export function viewAtElapsed(spec: BikeIntervalSpec, elapsedSeconds: number): BikeIntervalSnapshot {
  const work = Math.max(0, spec.workSeconds);
  const rest = Math.max(0, spec.restSeconds);
  const rounds = Math.max(1, spec.roundsPerSet);
  const total = bikeSetDurationSeconds(spec);
  const elapsed = Math.max(0, elapsedSeconds);

  if (elapsed >= total) {
    return {
      spec,
      phase: "done",
      round: rounds,
      remainingSeconds: 0,
      elapsedSeconds: total,
      paused: false,
    };
  }

  if (rest <= 0) {
    const index = work > 0 ? Math.floor(elapsed / work) : 0;
    const into = work > 0 ? elapsed - index * work : 0;
    return {
      spec,
      phase: "work",
      round: index + 1,
      remainingSeconds: work - into,
      elapsedSeconds: elapsed,
      paused: false,
    };
  }

  const cycle = work + rest;
  const index = cycle > 0 ? Math.floor(elapsed / cycle) : 0;
  const into = cycle > 0 ? elapsed - index * cycle : 0;
  const inWork = into < work;
  return {
    spec,
    phase: inWork ? "work" : "rest",
    round: index + 1,
    remainingSeconds: inWork ? work - into : rest - (into - work),
    elapsedSeconds: elapsed,
    paused: false,
  };
}

function cueBetween(previous: BikeIntervalSnapshot, next: BikeIntervalSnapshot): BikeIntervalCue {
  if (next.phase === "done" && previous.phase !== "done") return "complete";
  if (next.phase === "work" && next.remainingSeconds <= 3 && next.remainingSeconds >= 1) {
    if (previous.phase !== "work" || previous.remainingSeconds > 3 || next.remainingSeconds < previous.remainingSeconds) {
      return "work-warning";
    }
  }
  if (next.phase !== previous.phase || next.round !== previous.round) return "phase";
  return "none";
}

export function tickBikeInterval(snapshot: BikeIntervalSnapshot): {
  snapshot: BikeIntervalSnapshot;
  cue: BikeIntervalCue;
} {
  if (snapshot.phase === "idle" || snapshot.phase === "done" || snapshot.paused) {
    return { snapshot, cue: "none" };
  }
  const next = viewAtElapsed(snapshot.spec, snapshot.elapsedSeconds + 1);
  return { snapshot: next, cue: cueBetween(snapshot, next) };
}

export function pauseBikeInterval(snapshot: BikeIntervalSnapshot): BikeIntervalSnapshot {
  if (snapshot.phase === "idle" || snapshot.phase === "done") return snapshot;
  return { ...snapshot, paused: true };
}

export function resumeBikeInterval(snapshot: BikeIntervalSnapshot): BikeIntervalSnapshot {
  if (!snapshot.paused) return snapshot;
  return { ...snapshot, paused: false };
}

export function stopBikeInterval(snapshot: BikeIntervalSnapshot): BikeIntervalSnapshot {
  return idleBikeInterval(snapshot.spec);
}

/** After the last rest, mark the set done and start the between-set rest timer. */
export function bikeIntervalCompletionEffects(input: {
  exerciseName: string;
  restBetweenSetsSeconds: number;
  nowMs?: number;
}): { completed: true; rest: RestTimerState | null } {
  return {
    completed: true,
    rest: restTimerAfterSetDone({
      completed: true,
      exerciseName: input.exerciseName,
      restSeconds: input.restBetweenSetsSeconds,
      nowMs: input.nowMs,
    }),
  };
}
