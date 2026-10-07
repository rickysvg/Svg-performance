export type RestTimerState = {
  exerciseName: string;
  durationSeconds: number;
  endsAtMs: number;
};

export function startRestTimer(
  exerciseName: string,
  durationSeconds: number,
  nowMs = Date.now(),
): RestTimerState {
  const duration = Math.max(0, Math.round(durationSeconds));
  return {
    exerciseName,
    durationSeconds: duration,
    endsAtMs: nowMs + duration * 1000,
  };
}

/** Wall clock for a rest display. Kept out of the component so render stays pure. */
export function readRestNow() {
  return Date.now();
}

export function remainingRestSeconds(
  timer: RestTimerState | null,
  nowMs = Date.now(),
): number {
  if (!timer) return 0;
  return Math.max(0, Math.ceil((timer.endsAtMs - nowMs) / 1000));
}

export function isRestActive(timer: RestTimerState | null, nowMs = Date.now()): boolean {
  return remainingRestSeconds(timer, nowMs) > 0;
}

export function formatRestClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatRestPill(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

export function addRestSeconds(timer: RestTimerState, seconds: number): RestTimerState {
  const extra = Math.round(seconds);
  return {
    ...timer,
    durationSeconds: Math.max(0, timer.durationSeconds + extra),
    endsAtMs: timer.endsAtMs + extra * 1000,
  };
}

/**
 * End-of-rest alarm. Square tones at a gym-floor level, plus a pulse pattern
 * long enough to feel in a pocket. Louder than a UI click so it cuts through
 * music from a phone speaker.
 */
export const REST_ALARM = {
  gain: 0.32,
  vibrate: [220, 90, 220, 90, 380],
  tones: [
    { frequency: 523.25, seconds: 0.16, at: 0 },
    { frequency: 659.25, seconds: 0.16, at: 0.18 },
    { frequency: 783.99, seconds: 0.18, at: 0.36 },
    { frequency: 1046.5, seconds: 0.36, at: 0.56 },
  ],
} as const;

let restAudio: AudioContext | null = null;

/** Call from the set-complete tap so the later alarm is allowed to play. */
export function primeRestAudio() {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!restAudio) restAudio = new Ctor();
  if (restAudio.state === "suspended") {
    void restAudio.resume();
  }
}

export function signalRestComplete() {
  if (typeof navigator !== "undefined") {
    try {
      navigator.vibrate?.(REST_ALARM.vibrate);
    } catch {
      /* web vibration is optional */
    }
  }
  if (typeof window === "undefined") return;
  try {
    primeRestAudio();
    const context = restAudio;
    if (!context) return;
    const now = context.currentTime;
    for (const tone of REST_ALARM.tones) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "square";
      osc.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(REST_ALARM.gain, now + tone.at);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.at + tone.seconds);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now + tone.at);
      osc.stop(now + tone.at + tone.seconds + 0.02);
    }
  } catch {
    /* alarm is best-effort on web */
  }
}
