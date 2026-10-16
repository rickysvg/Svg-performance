/** Wall-clock window while a rest beep owns the speakers. DOM-free. */

let until = 0;
const listeners = new Set<() => void>();

export function noteCoachBeep(ms: number, now = Date.now()) {
  until = Math.max(until, now + Math.max(0, ms));
  for (const listener of listeners) listener();
}

export function coachBeepUntilMs() {
  return until;
}

export function subscribeCoachBeeps(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetCoachBeeps() {
  until = 0;
  listeners.clear();
}
