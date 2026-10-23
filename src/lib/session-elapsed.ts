import { SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";

export { SESSION_DURATION_CAP_SECONDS };

/**
 * A draft left open longer than this is not a live clock. The header shows
 * Paused instead of a multi-day count such as 1397:25.
 */
export const STALE_DRAFT_SECONDS = 12 * 60 * 60;

export type SessionClock = {
  status?: string | null;
  createdAt: Date | string | number;
  updatedAt?: Date | string | number | null;
  finishedAt?: Date | string | number | null;
  elapsedSeconds?: number | null;
  timerStartedAt?: Date | string | number | null;
};

export type SessionElapsedView = {
  seconds: number;
  /** In-progress session still inside the cap. Completed sessions never tick. */
  ticking: boolean;
  /** Anchor is older than the stale window, so the gap is not training time. */
  stale: boolean;
  /** Hit the 4-hour cap. The number is frozen. */
  capped: boolean;
  label: string;
};

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function finiteSeconds(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

/** MM:SS under an hour, H:MM:SS at an hour and beyond. */
export function formatSessionElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Seconds that are safe to keep on a draft. The 4 hour cap and anything
 * longer are a created-to-edit gap, not a clock the member ran.
 */
export function usableStoredElapsed(
  value: number | null | undefined,
  cap = SESSION_DURATION_CAP_SECONDS,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const seconds = Math.floor(value);
  if (seconds <= 0 || seconds >= cap) return null;
  return seconds;
}

/**
 * Wall-clock gap worth storing. Null when the gap is the cap or a stale draft
 * left open, so finalize and resume do not write 4:00:00.
 */
export function plausibleElapsed(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
  cap = SESSION_DURATION_CAP_SECONDS,
): number | null {
  const from = toMs(start);
  const to = toMs(end);
  if (from == null || to == null) return null;
  const gap = Math.max(0, Math.round((to - from) / 1000));
  if (gap <= 0 || gap >= cap || gap > STALE_DRAFT_SECONDS) return null;
  return gap;
}

export function cappedElapsedSeconds(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
  cap = SESSION_DURATION_CAP_SECONDS,
): number {
  const from = toMs(start);
  const to = toMs(end);
  if (from == null || to == null) return 0;
  return Math.min(cap, Math.max(0, Math.round((to - from) / 1000)));
}

/** Completed sessions saved before the freeze columns existed. */
export function legacyFrozenSeconds(session: SessionClock, cap = SESSION_DURATION_CAP_SECONDS): number {
  const end = session.finishedAt ?? session.updatedAt ?? session.createdAt;
  return cappedElapsedSeconds(session.createdAt, end, cap);
}

export function resolveSessionElapsed(
  session: SessionClock,
  now: Date | number = Date.now(),
  cap = SESSION_DURATION_CAP_SECONDS,
): SessionElapsedView {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const created = toMs(session.createdAt) ?? nowMs;
  const stored = finiteSeconds(session.elapsedSeconds);

  if (session.status === "complete") {
    const seconds = stored != null ? Math.min(stored, cap) : legacyFrozenSeconds(session, cap);
    return {
      seconds,
      ticking: false,
      stale: false,
      capped: false,
      label: formatSessionElapsed(seconds),
    };
  }

  // A stored base at the cap is a wall-clock gap, not time the member trained.
  const base = stored != null && stored < cap ? stored : 0;
  const anchor = toMs(session.timerStartedAt) ?? created;
  const segment = Math.max(0, Math.floor((nowMs - anchor) / 1000));

  if (segment >= STALE_DRAFT_SECONDS) {
    return {
      seconds: Math.min(base, cap),
      ticking: false,
      stale: true,
      capped: false,
      label: "Paused",
    };
  }

  if (segment > cap || base + segment >= cap) {
    return {
      seconds: cap,
      ticking: false,
      stale: false,
      capped: true,
      label: formatSessionElapsed(cap),
    };
  }

  const total = base + segment;
  return {
    seconds: total,
    ticking: true,
    stale: false,
    capped: false,
    label: formatSessionElapsed(total),
  };
}

export function sessionElapsedState(
  view: SessionElapsedView,
  status: string | null | undefined,
): "live" | "paused" | "frozen" | "capped" {
  if (view.ticking) return "live";
  if (view.stale) return "paused";
  if (status === "complete") return "frozen";
  return "capped";
}

function reportedElapsed(value: number | null | undefined, cap: number): number | null {
  const parsed = finiteSeconds(value);
  if (parsed == null) return null;
  return Math.min(cap, parsed);
}

/**
 * Seconds to persist when Save freezes the clock. Never the raw multi-day gap.
 * A resumed draft already has timerStartedAt. A short reported number must not
 * drop the seconds since that anchor.
 */
export function elapsedSecondsToFreeze(
  session: SessionClock,
  now: Date | number,
  reportedSeconds?: number | null,
  cap = SESSION_DURATION_CAP_SECONDS,
): number {
  const reported = reportedElapsed(reportedSeconds, cap);
  const live = resolveSessionElapsed({ ...session, status: "draft" }, now, cap);
  const resumed =
    session.timerStartedAt != null && !live.stale && !live.capped ? live.seconds : null;
  if (reported == null) return Math.min(live.seconds, cap);
  if (resumed != null && resumed > reported) return Math.min(resumed, cap);
  return reported;
}

export function freezeElapsedOnSave(
  session: SessionClock,
  now: Date,
  reportedSeconds?: number | null,
): { finishedAt: Date; elapsedSeconds: number; timerStartedAt: null } {
  if (
    session.status === "complete" &&
    session.finishedAt != null &&
    session.elapsedSeconds != null &&
    Number.isFinite(session.elapsedSeconds)
  ) {
    const stored = Math.min(
      SESSION_DURATION_CAP_SECONDS,
      Math.max(0, Math.floor(session.elapsedSeconds)),
    );
    const reported = reportedElapsed(reportedSeconds, SESSION_DURATION_CAP_SECONDS);
    // A longer round save replaces the frozen total. A shorter one must not.
    const elapsedSeconds = reported != null && reported > stored ? reported : stored;
    return {
      finishedAt: new Date(session.finishedAt),
      elapsedSeconds,
      timerStartedAt: null,
    };
  }
  return {
    finishedAt: now,
    elapsedSeconds: elapsedSecondsToFreeze(session, now, reportedSeconds),
    timerStartedAt: null,
  };
}
