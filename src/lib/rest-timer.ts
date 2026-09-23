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

export function signalRestComplete() {
  try {
    navigator.vibrate?.(160);
  } catch {
    /* web vibration is optional */
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* beep is optional on web */
  }
}
