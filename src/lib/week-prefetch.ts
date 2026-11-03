/**
 * Neighbor-week prefetch through the public router API.
 * The first request waits 1.5s. The next week is requested only after that
 * gap, so two full renders are not issued together. A cancelled prefetch
 * is forgotten. The request itself is left alone so a rejected response
 * cannot be reused by the next navigation.
 */

export const WEEK_PREFETCH_DELAY_MS = 1500;
/** Wait this long after one prefetch call before issuing the next week. */
export const WEEK_PREFETCH_GAP_MS = 1500;
/** Same window as a full prefetch in the client cache. After this, fetch again. */
export const WEEK_PREFETCH_STALE_MS = 5 * 60 * 1000;

export type WeekPrefetchRouter = {
  prefetch: (href: string, options?: { kind: "full" }) => void;
};

export type PrefetchTask = {
  /** True when the attempt should be remembered. False drops it. */
  done: Promise<boolean>;
  /** Stop waiting for the next week. Does not cancel the request already sent. */
  cancel: () => void;
};

export type TimerHost = {
  schedule: (ms: number, callback: () => void) => () => void;
};

const freshAt = new Map<string, number>();
const inflight = new Set<string>();

export function resetWeekPrefetchState() {
  freshAt.clear();
  inflight.clear();
}

export function hrefStillFresh(href: string, now: number, staleMs = WEEK_PREFETCH_STALE_MS) {
  if (inflight.has(href)) return true;
  const at = freshAt.get(href);
  return at != null && now - at < staleMs;
}

/** Drop blanks, duplicates, and weeks that were fetched recently. */
export function freshPrefetchHrefs(hrefs: readonly string[], now: number, staleMs = WEEK_PREFETCH_STALE_MS) {
  const unique: string[] = [];
  for (const href of hrefs) {
    if (!href || unique.includes(href) || hrefStillFresh(href, now, staleMs)) continue;
    unique.push(href);
  }
  return unique;
}

function browserTimers(): TimerHost {
  return {
    schedule(ms, callback) {
      const id = window.setTimeout(callback, ms);
      return () => window.clearTimeout(id);
    },
  };
}

/**
 * Full prefetch of one week. A throw is a rejection and is not remembered.
 * `done` stays pending across the gap so the scheduler does not start the
 * next week in the same turn.
 */
export function prefetchWeekRoute(
  router: WeekPrefetchRouter,
  href: string,
  options?: { gapMs?: number; timers?: TimerHost },
): PrefetchTask {
  const gapMs = options?.gapMs ?? WEEK_PREFETCH_GAP_MS;
  const timers = options?.timers ?? browserTimers();
  let settled = false;
  let resolveDone: (completed: boolean) => void = () => undefined;
  const done = new Promise<boolean>((resolve) => {
    resolveDone = (completed) => {
      if (settled) return;
      settled = true;
      resolve(completed);
    };
  });
  let cancelGap: () => void = () => undefined;
  const cancel = () => {
    cancelGap();
    resolveDone(false);
  };
  try {
    router.prefetch(href, { kind: "full" });
  } catch {
    resolveDone(false);
    return { done, cancel };
  }
  cancelGap = timers.schedule(gapMs, () => resolveDone(true));
  return { done, cancel };
}

/**
 * Wait, then prefetch one href at a time. Cancel stops the chain.
 * A failed attempt is forgotten so a later visit fetches it again.
 */
export function scheduleWeekPrefetch(
  hrefs: readonly string[],
  prefetch: (href: string) => PrefetchTask,
  options?: {
    delayMs?: number;
    now?: () => number;
    timers?: TimerHost;
  },
) {
  const now = options?.now ?? (() => Date.now());
  const delayMs = options?.delayMs ?? WEEK_PREFETCH_DELAY_MS;
  const timers = options?.timers ?? browserTimers();
  const queue = freshPrefetchHrefs(hrefs, now());
  for (const href of queue) inflight.add(href);
  if (queue.length === 0) return () => undefined;

  let index = 0;
  let cancelled = false;
  let cancelCurrent: (() => void) | null = null;
  const finished = new Set<string>();

  const cancelDelay = timers.schedule(delayMs, () => {
    void run();
  });

  async function run() {
    while (index < queue.length) {
      if (cancelled) return;
      const href = queue[index];
      index += 1;
      if (!href) continue;
      const task = prefetch(href);
      cancelCurrent = task.cancel;
      const completed = await task.done;
      cancelCurrent = null;
      inflight.delete(href);
      if (!cancelled && completed) {
        freshAt.set(href, now());
        finished.add(href);
      } else {
        freshAt.delete(href);
      }
      if (cancelled) return;
    }
  }

  return () => {
    cancelled = true;
    cancelDelay();
    cancelCurrent?.();
    cancelCurrent = null;
    for (const href of queue) {
      inflight.delete(href);
      if (!finished.has(href)) freshAt.delete(href);
    }
  };
}
