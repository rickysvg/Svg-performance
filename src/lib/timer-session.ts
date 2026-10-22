import { isBikeIntervalName } from "@/lib/bike-sessions";
import { TIMER_MODES, type TimerMode } from "@/lib/round-timer";

export type TimerEntryMode = TimerMode | "bike";

type NamedExercise = { name?: string | null };

export function isTimerMode(value: string | null | undefined): value is TimerMode {
  return typeof value === "string" && TIMER_MODES.includes(value as TimerMode);
}

/** Easy-bike and jump-rope finishers stay off the assault-bike clock. */
export function textIsBikeWorkout(text: string) {
  const stripped = text.replace(/\beasy bike\b/gi, " ").replace(/\bjump rope\b/gi, " ");
  return /\b(assault bike|air bike|echo bike|bike)\b/i.test(stripped);
}

export function isBikePlanSession(session: {
  title?: string | null;
  label?: string | null;
  day?: {
    title?: string | null;
    focus?: string | null;
    exercises?: ReadonlyArray<NamedExercise | { sets?: number; restSeconds?: number }>;
  } | null;
}) {
  const exercises = session.day?.exercises ?? [];
  if (
    exercises.some((row) => {
      const name = "name" in row ? row.name : null;
      return Boolean(name && isBikeIntervalName(name));
    })
  ) {
    return true;
  }
  const text = [session.title, session.label, session.day?.title, session.day?.focus]
    .filter(Boolean)
    .join(" ");
  return textIsBikeWorkout(text);
}

export function bikeTimerHref(dayId?: string | null) {
  const params = new URLSearchParams({ mode: "bike" });
  if (dayId) params.set("day", dayId);
  return `/timer?${params.toString()}`;
}

export function isBikeTimerHref(href?: string | null) {
  if (!href) return false;
  return /(?:\?|&)mode=bike(?:&|$)/.test(href);
}

/** Opens the workout logger for a program day. Bike tiles use this, not the timer. */
export function bikeLoggerHref(dayId: string) {
  return `/training/${dayId}/start`;
}

export function isBikeLoggerHref(href?: string | null) {
  return typeof href === "string" && /^\/training\/[^/]+\/start(?:\?.*)?$/.test(href);
}

/** A bike tap opens the logger. A finished session stays on its day page. */
export function sessionOpenHref(
  session: { href?: string; logHref?: string },
  done = false,
) {
  if (!done && session.logHref) return session.logHref;
  return session.href;
}

/**
 * Round-timer mode for a session, or bike when the session is an assault-bike workout.
 * Null means the generic timer may keep the member's last mode.
 */
export function timerEntryModeFromText(text: string): TimerEntryMode | null {
  if (textIsBikeWorkout(text)) return "bike";
  const lower = text.toLowerCase();
  if (/\bgrappl/.test(lower)) return "grappling";
  if (/\bpads?\b|\bmitts?\b/.test(lower)) return "pads";
  if (/\bspar/.test(lower)) return "sparring";
  if (/\bbag\b|\bbagwork\b/.test(lower)) return "bag";
  return null;
}
