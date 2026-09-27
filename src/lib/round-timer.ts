export const TIMER_MODES = ["bag", "pads", "sparring"] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

export const TIMER_PRESETS = ["3x3", "5x5", "custom"] as const;
export type TimerPreset = (typeof TIMER_PRESETS)[number];

export type TimerConfig = {
  rounds: number;
  workSeconds: number;
  restSeconds: number;
};

export type TimerPhase = "idle" | "work" | "rest" | "done";

export type TimelineSlot = {
  phase: "work" | "rest";
  round: number;
  durationSeconds: number;
};

export const TIMER_CUSTOM_STORAGE_KEY = "svg_round_timer_custom";
export const TIMER_PREFS_STORAGE_KEY = "svg_round_timer_prefs";

export const PRESET_CONFIGS: Record<Exclude<TimerPreset, "custom">, TimerConfig> = {
  "3x3": { rounds: 3, workSeconds: 3 * 60, restSeconds: 60 },
  "5x5": { rounds: 5, workSeconds: 5 * 60, restSeconds: 60 },
};

export const DEFAULT_CUSTOM: TimerConfig = {
  rounds: 3,
  workSeconds: 3 * 60,
  restSeconds: 60,
};

export function clampRounds(value: number) {
  return Math.min(20, Math.max(1, Math.round(value)));
}

export function clampDurationSeconds(value: number) {
  return Math.min(60 * 30, Math.max(5, Math.round(value)));
}

export function sanitizeTimerConfig(input: Partial<TimerConfig> | null | undefined): TimerConfig {
  return {
    rounds: clampRounds(Number(input?.rounds) || DEFAULT_CUSTOM.rounds),
    workSeconds: clampDurationSeconds(Number(input?.workSeconds) || DEFAULT_CUSTOM.workSeconds),
    restSeconds: clampDurationSeconds(Number(input?.restSeconds) || DEFAULT_CUSTOM.restSeconds),
  };
}

export function configForPreset(preset: TimerPreset, custom?: Partial<TimerConfig>): TimerConfig {
  if (preset === "custom") return sanitizeTimerConfig(custom);
  return PRESET_CONFIGS[preset];
}

export function buildTimerTimeline(config: TimerConfig): TimelineSlot[] {
  const safe = sanitizeTimerConfig(config);
  const slots: TimelineSlot[] = [];
  for (let round = 1; round <= safe.rounds; round += 1) {
    slots.push({ phase: "work", round, durationSeconds: safe.workSeconds });
    if (round < safe.rounds) {
      slots.push({ phase: "rest", round, durationSeconds: safe.restSeconds });
    }
  }
  return slots;
}

export function formatTimerClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatTimerMinutesLabel(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

export type ResolvedTimer = {
  phase: TimerPhase;
  round: number;
  totalRounds: number;
  remainingSeconds: number;
  phaseDurationSeconds: number;
  phaseElapsedSeconds: number;
  phaseProgress: number;
  sessionProgress: number;
  nextLabel: string;
  slotIndex: number;
};

export function resolveTimer(input: {
  config: TimerConfig;
  startedAtMs: number | null;
  pausedAtMs?: number | null;
  pauseAccumulatedMs?: number;
  nowMs: number;
}): ResolvedTimer {
  const config = sanitizeTimerConfig(input.config);
  const timeline = buildTimerTimeline(config);
  const totalMs = timeline.reduce((sum, slot) => sum + slot.durationSeconds * 1000, 0);
  const idle: ResolvedTimer = {
    phase: "idle",
    round: 1,
    totalRounds: config.rounds,
    remainingSeconds: config.workSeconds,
    phaseDurationSeconds: config.workSeconds,
    phaseElapsedSeconds: 0,
    phaseProgress: 0,
    sessionProgress: 0,
    nextLabel: nextLabelFor(timeline, 0),
    slotIndex: 0,
  };
  if (input.startedAtMs == null) return idle;

  const freezeAt = input.pausedAtMs ?? input.nowMs;
  const elapsedMs = Math.max(
    0,
    freezeAt - input.startedAtMs - Math.max(0, input.pauseAccumulatedMs ?? 0),
  );
  if (elapsedMs >= totalMs) {
    const last = timeline[timeline.length - 1];
    return {
      phase: "done",
      round: config.rounds,
      totalRounds: config.rounds,
      remainingSeconds: 0,
      phaseDurationSeconds: last?.durationSeconds ?? 0,
      phaseElapsedSeconds: last?.durationSeconds ?? 0,
      phaseProgress: 1,
      sessionProgress: 1,
      nextLabel: "Rounds complete",
      slotIndex: Math.max(0, timeline.length - 1),
    };
  }

  let cursor = 0;
  for (let index = 0; index < timeline.length; index += 1) {
    const slot = timeline[index]!;
    const slotMs = slot.durationSeconds * 1000;
    if (elapsedMs < cursor + slotMs) {
      const intoMs = elapsedMs - cursor;
      const remainingMs = slotMs - intoMs;
      return {
        phase: slot.phase,
        round: slot.round,
        totalRounds: config.rounds,
        remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
        phaseDurationSeconds: slot.durationSeconds,
        phaseElapsedSeconds: intoMs / 1000,
        phaseProgress: slotMs === 0 ? 1 : intoMs / slotMs,
        sessionProgress: totalMs === 0 ? 1 : elapsedMs / totalMs,
        nextLabel: nextLabelFor(timeline, index),
        slotIndex: index,
      };
    }
    cursor += slotMs;
  }

  return { ...idle, phase: "done", remainingSeconds: 0, phaseProgress: 1, sessionProgress: 1 };
}

function nextLabelFor(timeline: TimelineSlot[], index: number) {
  const next = timeline[index + 1];
  if (!next) return "Last work block";
  if (next.phase === "rest") {
    const after = timeline[index + 2];
    const rest = formatTimerClock(next.durationSeconds);
    return after ? `Rest ${rest} · then round ${after.round}` : `Rest ${rest}`;
  }
  return `Round ${next.round}`;
}

export function shouldPlayWarningBeep(prevRemaining: number, remaining: number) {
  return prevRemaining > 10 && remaining <= 10 && remaining > 0;
}

export function shouldPlayPhaseBell(prev: TimerPhase, next: TimerPhase) {
  if (prev === next) return false;
  return next === "work" || prev === "work";
}

export type StoredTimerPrefs = {
  mode: TimerMode;
  preset: TimerPreset;
  warningBeep: boolean;
  bell: boolean;
  vibrate: boolean;
  custom: TimerConfig;
};

export const DEFAULT_TIMER_PREFS: StoredTimerPrefs = {
  mode: "bag",
  preset: "3x3",
  warningBeep: true,
  bell: true,
  vibrate: true,
  custom: DEFAULT_CUSTOM,
};

export function parseStoredTimerPrefs(raw: string | null): StoredTimerPrefs {
  if (!raw) return DEFAULT_TIMER_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTimerPrefs>;
    return {
      mode: TIMER_MODES.includes(parsed.mode as TimerMode) ? (parsed.mode as TimerMode) : "bag",
      preset: TIMER_PRESETS.includes(parsed.preset as TimerPreset)
        ? (parsed.preset as TimerPreset)
        : "3x3",
      warningBeep: parsed.warningBeep !== false,
      bell: parsed.bell !== false,
      vibrate: parsed.vibrate !== false,
      custom: sanitizeTimerConfig(parsed.custom),
    };
  } catch {
    return DEFAULT_TIMER_PREFS;
  }
}

export function parseStoredCustom(raw: string | null): TimerConfig {
  if (!raw) return DEFAULT_CUSTOM;
  try {
    return sanitizeTimerConfig(JSON.parse(raw) as Partial<TimerConfig>);
  } catch {
    return DEFAULT_CUSTOM;
  }
}
