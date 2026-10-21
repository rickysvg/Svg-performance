import { restTimerAfterSetDone } from "@/lib/logger-prefill";
import type { RestTimerState } from "@/lib/rest-timer";

export type BikeIntervalPattern = "binary" | "ten-twenty-thirty" | "surge" | "ladder";

export type BikeIntervalStep = {
  workSeconds: number;
  restSeconds: number;
};

export type BikeIntervalSpec = {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
  blocks?: number;
  restBetweenBlocksSeconds?: number;
  pattern?: BikeIntervalPattern;
  ladder?: readonly BikeIntervalStep[];
};

export type BikeIntervalPhase =
  | "idle"
  | "warmup"
  | "work"
  | "moderate"
  | "rest"
  | "cooldown"
  | "done";

export type BikeIntervalCue = "none" | "phase" | "work-warning" | "complete";

export type BikeIntervalSnapshot = {
  spec: BikeIntervalSpec;
  phase: BikeIntervalPhase;
  round: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  paused: boolean;
  phaseLabel?: string;
  roundTotal?: number;
};

type TimelineSegment = {
  phase: Exclude<BikeIntervalPhase, "idle" | "done">;
  label: string;
  seconds: number;
  round: number;
  roundTotal: number;
};

/** Uniform work/rest stays on the original clock. Warm-up, blocks, and patterns use a timeline. */
export function usesBikeTimeline(spec: BikeIntervalSpec) {
  const pattern = spec.pattern ?? "binary";
  return (
    (spec.warmupSeconds ?? 0) > 0 ||
    (spec.cooldownSeconds ?? 0) > 0 ||
    (spec.blocks ?? 1) > 1 ||
    pattern !== "binary"
  );
}

function buildTimeline(spec: BikeIntervalSpec): TimelineSegment[] {
  const pattern = spec.pattern ?? "binary";
  const blocks = Math.max(1, Math.round(spec.blocks ?? 1));
  const between = Math.max(0, Math.round(spec.restBetweenBlocksSeconds ?? 0));
  const warmup = Math.max(0, Math.round(spec.warmupSeconds ?? 0));
  const cooldown = Math.max(0, Math.round(spec.cooldownSeconds ?? 0));
  const rounds = Math.max(1, Math.round(spec.roundsPerSet));
  const work = Math.max(0, Math.round(spec.workSeconds));
  const rest = Math.max(0, Math.round(spec.restSeconds));
  const ladder = pattern === "ladder" ? (spec.ladder ?? []).filter((step) => step.workSeconds > 0 || step.restSeconds > 0) : [];
  const roundTotal = ladder.length > 0 ? ladder.length : blocks * rounds;
  const segs: TimelineSegment[] = [];

  if (warmup > 0) {
    segs.push({ phase: "warmup", label: "WARM-UP", seconds: warmup, round: 0, roundTotal });
  }

  for (let block = 0; block < blocks; block += 1) {
    if (ladder.length > 0) {
      if (block === 0) {
        ladder.forEach((step, index) => {
          const round = index + 1;
          if (step.workSeconds > 0) {
            segs.push({
              phase: "work",
              label: "SPRINT",
              seconds: Math.round(step.workSeconds),
              round,
              roundTotal,
            });
          }
          if (step.restSeconds > 0) {
            segs.push({
              phase: "rest",
              label: "REST",
              seconds: Math.round(step.restSeconds),
              round,
              roundTotal,
            });
          }
        });
      }
    } else if (pattern === "ten-twenty-thirty") {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        segs.push({ phase: "rest", label: "EASY", seconds: 30, round: n, roundTotal });
        segs.push({ phase: "moderate", label: "MODERATE", seconds: 20, round: n, roundTotal });
        segs.push({ phase: "work", label: "SPRINT", seconds: 10, round: n, roundTotal });
      }
    } else if (pattern === "surge") {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        if (work > 0) segs.push({ phase: "work", label: "SURGE", seconds: work, round: n, roundTotal });
        if (rest > 0) segs.push({ phase: "moderate", label: "PACE", seconds: rest, round: n, roundTotal });
      }
    } else {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        if (work > 0) segs.push({ phase: "work", label: "WORK", seconds: work, round: n, roundTotal });
        if (rest > 0) segs.push({ phase: "rest", label: "REST", seconds: rest, round: n, roundTotal });
      }
    }
    if (block < blocks - 1 && between > 0 && ladder.length === 0) {
      segs.push({ phase: "rest", label: "REST", seconds: between, round: 0, roundTotal });
    }
  }

  if (cooldown > 0) {
    segs.push({ phase: "cooldown", label: "COOL-DOWN", seconds: cooldown, round: 0, roundTotal });
  }
  return segs;
}

function viewTimeline(spec: BikeIntervalSpec, elapsedSeconds: number): BikeIntervalSnapshot {
  const segs = buildTimeline(spec);
  const total = segs.reduce((sum, seg) => sum + seg.seconds, 0);
  const elapsed = Math.max(0, elapsedSeconds);
  const last = segs[segs.length - 1];
  if (segs.length === 0 || elapsed >= total) {
    return {
      spec,
      phase: "done",
      round: last?.round || 1,
      remainingSeconds: 0,
      elapsedSeconds: total,
      paused: false,
      phaseLabel: "DONE",
      roundTotal: last?.roundTotal ?? 1,
    };
  }
  let cursor = 0;
  for (const seg of segs) {
    if (elapsed < cursor + seg.seconds) {
      return {
        spec,
        phase: seg.phase,
        round: seg.round,
        remainingSeconds: seg.seconds - (elapsed - cursor),
        elapsedSeconds: elapsed,
        paused: false,
        phaseLabel: seg.label,
        roundTotal: seg.roundTotal,
      };
    }
    cursor += seg.seconds;
  }
  return {
    spec,
    phase: "done",
    round: last?.round || 1,
    remainingSeconds: 0,
    elapsedSeconds: total,
    paused: false,
    phaseLabel: "DONE",
    roundTotal: last?.roundTotal ?? 1,
  };
}

export function bikeSetDurationSeconds(spec: BikeIntervalSpec) {
  if (usesBikeTimeline(spec)) {
    return buildTimeline(spec).reduce((sum, seg) => sum + seg.seconds, 0);
  }
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
  if (usesBikeTimeline(spec)) return viewTimeline(spec, elapsedSeconds);
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
