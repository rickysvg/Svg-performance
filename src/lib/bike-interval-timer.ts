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
  /** How many times to run the whole workout. 1 leaves the protocol as written. */
  repeatRounds?: number;
  /** Easy spin between those repeats. Ignored when there is only one round. */
  restBetweenRoundsSeconds?: number;
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
  /** Outer repeat of the whole workout. 1 when the member did not add rounds. */
  repeatRound?: number;
  repeatTotal?: number;
  /** Sprint inside the current round. 0 during warm-up, cool-down, and rest between rounds. */
  sprint?: number;
  sprintTotal?: number;
};

type TimelineSegment = {
  phase: Exclude<BikeIntervalPhase, "idle" | "done">;
  label: string;
  seconds: number;
  round: number;
  roundTotal: number;
  repeatRound: number;
  repeatTotal: number;
  sprint: number;
  sprintTotal: number;
};

/** Work efforts inside one round. Ladder steps and protocol blocks count. */
export function sprintCountForSpec(spec: BikeIntervalSpec) {
  const ladder =
    spec.pattern === "ladder"
      ? (spec.ladder ?? []).filter((step) => step.workSeconds > 0 || step.restSeconds > 0)
      : [];
  if (ladder.length > 0) return ladder.length;
  const blocks = Math.max(1, Math.round(spec.blocks ?? 1));
  const rounds = Math.max(1, Math.round(spec.roundsPerSet));
  return blocks * rounds;
}

/** Uniform work/rest stays on the original clock. Warm-up, blocks, patterns, and extra rounds use a timeline. */
export function usesBikeTimeline(spec: BikeIntervalSpec) {
  const pattern = spec.pattern ?? "binary";
  return (
    (spec.warmupSeconds ?? 0) > 0 ||
    (spec.cooldownSeconds ?? 0) > 0 ||
    (spec.blocks ?? 1) > 1 ||
    (spec.repeatRounds ?? 1) > 1 ||
    pattern !== "binary"
  );
}

function buildInner(spec: BikeIntervalSpec): TimelineSegment[] {
  const pattern = spec.pattern ?? "binary";
  const blocks = Math.max(1, Math.round(spec.blocks ?? 1));
  const between = Math.max(0, Math.round(spec.restBetweenBlocksSeconds ?? 0));
  const rounds = Math.max(1, Math.round(spec.roundsPerSet));
  const work = Math.max(0, Math.round(spec.workSeconds));
  const rest = Math.max(0, Math.round(spec.restSeconds));
  const ladder = pattern === "ladder" ? (spec.ladder ?? []).filter((step) => step.workSeconds > 0 || step.restSeconds > 0) : [];
  const roundTotal = ladder.length > 0 ? ladder.length : blocks * rounds;
  const segs: TimelineSegment[] = [];
  const push = (seg: Omit<TimelineSegment, "repeatRound" | "repeatTotal" | "sprint" | "sprintTotal">) => {
    segs.push({
      ...seg,
      repeatRound: 1,
      repeatTotal: 1,
      sprint: seg.round,
      sprintTotal: roundTotal,
    });
  };

  for (let block = 0; block < blocks; block += 1) {
    if (ladder.length > 0) {
      if (block === 0) {
        ladder.forEach((step, index) => {
          const round = index + 1;
          if (step.workSeconds > 0) {
            push({ phase: "work", label: "SPRINT", seconds: Math.round(step.workSeconds), round, roundTotal });
          }
          if (step.restSeconds > 0) {
            push({ phase: "rest", label: "REST", seconds: Math.round(step.restSeconds), round, roundTotal });
          }
        });
      }
    } else if (pattern === "ten-twenty-thirty") {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        push({ phase: "rest", label: "EASY", seconds: 30, round: n, roundTotal });
        push({ phase: "moderate", label: "MODERATE", seconds: 20, round: n, roundTotal });
        push({ phase: "work", label: "SPRINT", seconds: 10, round: n, roundTotal });
      }
    } else if (pattern === "surge") {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        if (work > 0) push({ phase: "work", label: "SURGE", seconds: work, round: n, roundTotal });
        if (rest > 0) push({ phase: "moderate", label: "PACE", seconds: rest, round: n, roundTotal });
      }
    } else {
      for (let round = 1; round <= rounds; round += 1) {
        const n = block * rounds + round;
        if (work > 0) push({ phase: "work", label: "WORK", seconds: work, round: n, roundTotal });
        if (rest > 0) push({ phase: "rest", label: "REST", seconds: rest, round: n, roundTotal });
      }
    }
    if (block < blocks - 1 && between > 0 && ladder.length === 0) {
      push({ phase: "rest", label: "REST", seconds: between, round: 0, roundTotal });
    }
  }
  return segs;
}

function buildTimeline(spec: BikeIntervalSpec): TimelineSegment[] {
  const repeats = Math.max(1, Math.round(spec.repeatRounds ?? 1));
  const betweenRounds = repeats > 1 ? Math.max(0, Math.round(spec.restBetweenRoundsSeconds ?? 0)) : 0;
  const warmup = Math.max(0, Math.round(spec.warmupSeconds ?? 0));
  const cooldown = Math.max(0, Math.round(spec.cooldownSeconds ?? 0));
  const inner = buildInner(spec);
  const sprintTotal = inner.reduce((max, seg) => Math.max(max, seg.round), 0) || sprintCountForSpec(spec);
  const segs: TimelineSegment[] = [];
  const gap = (
    phase: TimelineSegment["phase"],
    label: string,
    seconds: number,
    repeatRound: number,
  ): TimelineSegment => ({
    phase,
    label,
    seconds,
    round: 0,
    roundTotal: sprintTotal,
    repeatRound,
    repeatTotal: repeats,
    sprint: 0,
    sprintTotal,
  });

  if (warmup > 0) segs.push(gap("warmup", "WARM-UP", warmup, 1));
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const seg of inner) {
      segs.push({
        ...seg,
        repeatRound: repeat,
        repeatTotal: repeats,
        sprint: seg.round,
        sprintTotal,
        roundTotal: sprintTotal,
      });
    }
    if (repeat < repeats && betweenRounds > 0) {
      segs.push(gap("rest", "REST", betweenRounds, repeat));
    }
  }
  if (cooldown > 0) segs.push(gap("cooldown", "COOL-DOWN", cooldown, repeats));
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
      repeatRound: last?.repeatRound ?? 1,
      repeatTotal: last?.repeatTotal ?? 1,
      sprint: last?.sprint || last?.round || 1,
      sprintTotal: last?.sprintTotal ?? last?.roundTotal ?? 1,
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
        repeatRound: seg.repeatRound,
        repeatTotal: seg.repeatTotal,
        sprint: seg.sprint,
        sprintTotal: seg.sprintTotal,
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
    repeatRound: last?.repeatRound ?? 1,
    repeatTotal: last?.repeatTotal ?? 1,
    sprint: last?.sprint || last?.round || 1,
    sprintTotal: last?.sprintTotal ?? last?.roundTotal ?? 1,
  };
}

/** Prescribed session length and the hard-work portion of it. */
export function bikeEffortSeconds(spec: BikeIntervalSpec): { totalSeconds: number; workSeconds: number } {
  if (usesBikeTimeline(spec)) {
    const segs = buildTimeline(spec);
    return {
      totalSeconds: segs.reduce((sum, seg) => sum + seg.seconds, 0),
      workSeconds: segs.reduce((sum, seg) => sum + (seg.phase === "work" ? seg.seconds : 0), 0),
    };
  }
  const work = Math.max(0, spec.workSeconds);
  const rest = Math.max(0, spec.restSeconds);
  const rounds = Math.max(1, spec.roundsPerSet);
  const workSeconds = rounds * work;
  const totalSeconds = rest <= 0 ? workSeconds : rounds * (work + rest);
  return { totalSeconds, workSeconds };
}

export function bikeSetDurationSeconds(spec: BikeIntervalSpec) {
  return bikeEffortSeconds(spec).totalSeconds;
}

/** Rounds a bike clock is allowed to log. Fight sims count blocks, not every surge. */
export function bikeLogRoundTotal(spec: BikeIntervalSpec) {
  const blocks = Math.max(1, Math.round(spec.blocks ?? 1));
  if ((spec.pattern ?? "binary") === "surge" && blocks > 1) return blocks;
  const repeats = Math.max(1, Math.round(spec.repeatRounds ?? 1));
  return repeats * Math.max(1, Math.round(spec.roundsPerSet));
}

/**
 * Work rounds whose interval has fully elapsed. Idle, and the first second of
 * a round, count as zero so a log cannot be saved before anyone rides.
 */
export function completedBikeLogRounds(snapshot: BikeIntervalSnapshot) {
  const spec = snapshot.spec;
  const total = bikeLogRoundTotal(spec);
  if (snapshot.phase === "idle") return 0;
  if (snapshot.phase === "done") return total;
  const elapsed = Math.max(0, snapshot.elapsedSeconds);
  if (elapsed <= 0) return 0;

  if (!usesBikeTimeline(spec)) {
    const work = Math.max(0, spec.workSeconds);
    const rest = Math.max(0, spec.restSeconds);
    if (work <= 0) return 0;
    if (rest <= 0) return Math.min(total, Math.floor(elapsed / work));
    const cycle = work + rest;
    const index = Math.floor(elapsed / cycle);
    const into = elapsed - index * cycle;
    const finished = into >= work ? index + 1 : index;
    return Math.min(total, finished);
  }

  const blocks = Math.max(1, Math.round(spec.blocks ?? 1));
  const surge = (spec.pattern ?? "binary") === "surge" && blocks > 1;
  const perBlock = Math.max(1, Math.round(spec.roundsPerSet));
  const segs = buildTimeline(spec);
  let cursor = 0;
  const ends: number[] = [];
  for (const seg of segs) {
    const end = cursor + seg.seconds;
    if (seg.phase === "work" && seg.round > 0) {
      if (!surge || seg.round % perBlock === 0) ends.push(end);
    }
    cursor = end;
  }
  return Math.min(total, ends.filter((end) => elapsed >= end).length);
}

function singleRepeat(round: number, rounds: number) {
  const total = Math.max(1, rounds);
  return {
    repeatRound: 1,
    repeatTotal: 1,
    sprint: round,
    sprintTotal: total,
    roundTotal: total,
  };
}

export function idleBikeInterval(spec: BikeIntervalSpec): BikeIntervalSnapshot {
  const sprints = sprintCountForSpec(spec);
  return {
    spec,
    phase: "idle",
    round: 1,
    remainingSeconds: Math.max(0, spec.workSeconds),
    elapsedSeconds: 0,
    paused: false,
    repeatRound: 1,
    repeatTotal: Math.max(1, Math.round(spec.repeatRounds ?? 1)),
    sprint: 1,
    sprintTotal: sprints,
    roundTotal: sprints,
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
      ...singleRepeat(rounds, rounds),
    };
  }

  if (rest <= 0) {
    const index = work > 0 ? Math.floor(elapsed / work) : 0;
    const into = work > 0 ? elapsed - index * work : 0;
    const round = index + 1;
    return {
      spec,
      phase: "work",
      round,
      remainingSeconds: work - into,
      elapsedSeconds: elapsed,
      paused: false,
      ...singleRepeat(round, rounds),
    };
  }

  const cycle = work + rest;
  const index = cycle > 0 ? Math.floor(elapsed / cycle) : 0;
  const into = cycle > 0 ? elapsed - index * cycle : 0;
  const inWork = into < work;
  const round = index + 1;
  return {
    spec,
    phase: inWork ? "work" : "rest",
    round,
    remainingSeconds: inWork ? work - into : rest - (into - work),
    elapsedSeconds: elapsed,
    paused: false,
    ...singleRepeat(round, rounds),
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
