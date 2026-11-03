/**
 * Neighbor-week prefetch. Full route data stays cached for a fast week change.
 * The first request waits, the next week starts only after that request's
 * body closes, and leaving the page aborts anything still on the wire.
 */

export const WEEK_PREFETCH_DELAY_MS = 1500;
/** Same window as a full prefetch in the client cache. After this, fetch again. */
export const WEEK_PREFETCH_STALE_MS = 5 * 60 * 1000;
/**
 * Gap after a route-tree prefetch. The full week render is a second request
 * that starts once that tree is read. Don't treat the tree as the whole job.
 */
export const WEEK_PREFETCH_QUIET_MS = 750;
/** Keep rejecting a cancelled prefetch briefly so its follow-up request never leaves. */
export const WEEK_PREFETCH_ABORT_HOLD_MS = 50;

export type WeekPrefetchRouter = {
  prefetch: (href: string, options?: { kind: "full" }) => void;
};

export type PrefetchTask = {
  /** True when the week response finished. False when it was aborted or failed. */
  done: Promise<boolean>;
  abort: () => void;
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

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function sameWeekRequest(fetched: string, href: string) {
  try {
    const origin = window.location.origin;
    const a = new URL(fetched, origin);
    const b = new URL(href, origin);
    if (a.pathname !== b.pathname) return false;
    const day = b.searchParams.get("day");
    return !day || a.searchParams.get("day") === day;
  } catch {
    return fetched.includes(href);
  }
}

function headerGet(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (!headers) return null;
  if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name);
    return found?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === name) return record[key] ?? null;
  }
  return null;
}

/** Route-tree prefetch. The heavy week render does not send this header. */
function isLightPrefetch(init: RequestInit | undefined) {
  return headerGet(init, "next-router-prefetch") != null;
}

function watchStream(source: ReadableStream<Uint8Array>, onClose: () => void) {
  const reader = source.getReader();
  let closed = false;
  const notify = () => {
    if (closed) return;
    closed = true;
    onClose();
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          notify();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        notify();
        controller.error(error);
      }
    },
    cancel(reason) {
      notify();
      return reader.cancel(reason);
    },
  });
}

/** Observe the body without replacing url or redirected, which the cache keys on. */
function watchResponse(response: Response, onClose: () => void) {
  if (!response.body) {
    onClose();
    return response;
  }
  const source = response.body;
  let watched: ReadableStream<Uint8Array> | null = null;
  return new Proxy(response, {
    get(target, prop) {
      if (prop === "body") {
        if (!watched) watched = watchStream(source, onClose);
        return watched;
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Full prefetch of one week. `done` resolves when the full week body closes,
 * not when the earlier route-tree request does. Abort cancels the request
 * Next already started and drops a follow-up prefetch for that href.
 */
export function prefetchWeekRoute(router: WeekPrefetchRouter, href: string): PrefetchTask {
  const controller = new AbortController();
  let settled = false;
  let resolveDone: (completed: boolean) => void = () => undefined;
  const done = new Promise<boolean>((resolve) => {
    resolveDone = (completed) => {
      if (settled) return;
      settled = true;
      resolve(completed);
    };
  });
  const original = window.fetch.bind(window);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (window.fetch === wrapped) window.fetch = original;
  };

  let lightOpen = 0;
  let heavyOpen = 0;
  let sawHeavy = false;
  let quiet: number | null = null;
  const clearQuiet = () => {
    if (quiet == null) return;
    window.clearTimeout(quiet);
    quiet = null;
  };
  const armQuiet = () => {
    clearQuiet();
    quiet = window.setTimeout(() => {
      quiet = null;
      if (settled || sawHeavy || lightOpen > 0 || heavyOpen > 0) return;
      restore();
      resolveDone(true);
    }, WEEK_PREFETCH_QUIET_MS);
  };

  const onStreamClosed = (heavy: boolean, ok: boolean) => {
    if (heavy) heavyOpen = Math.max(0, heavyOpen - 1);
    else lightOpen = Math.max(0, lightOpen - 1);
    if (controller.signal.aborted || settled) return;
    if (heavy && heavyOpen === 0) {
      clearQuiet();
      restore();
      resolveDone(ok);
      return;
    }
    if (heavyOpen === 0 && lightOpen === 0 && !sawHeavy) armQuiet();
  };

  const wrapped: typeof window.fetch = (input, init) => {
    // Navigation uses priority "auto". Only the prefetch queue uses "low".
    if (init?.priority !== "low" || !sameWeekRequest(requestUrl(input), href)) {
      return original(input, init);
    }
    if (controller.signal.aborted) {
      return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
    }
    const heavy = !isLightPrefetch(init);
    if (heavy) sawHeavy = true;
    else lightOpen += 1;
    if (heavy) heavyOpen += 1;
    clearQuiet();
    return original(input, { ...init, signal: controller.signal }).then(
      (response) => watchResponse(response, () => onStreamClosed(heavy, response.ok)),
      (error: unknown) => {
        onStreamClosed(heavy, false);
        throw error;
      },
    );
  };

  const abort = () => {
    if (controller.signal.aborted || (settled && restored)) return;
    controller.abort();
    clearQuiet();
    resolveDone(false);
    window.setTimeout(() => restore(), WEEK_PREFETCH_ABORT_HOLD_MS);
  };

  window.fetch = wrapped;
  try {
    router.prefetch(href, { kind: "full" });
  } catch {
    abort();
  }
  if (!settled && heavyOpen === 0 && lightOpen === 0) armQuiet();
  return { done, abort };
}

/**
 * Wait, then prefetch one href at a time. The next request starts when the
 * previous one finishes. Cancel aborts the request that is already running.
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
  let abortCurrent: (() => void) | null = null;
  const started = new Set<string>();

  const cancelDelay = timers.schedule(delayMs, () => {
    void run();
  });

  async function run() {
    while (index < queue.length) {
      if (cancelled) return;
      const href = queue[index];
      index += 1;
      if (!href) continue;
      started.add(href);
      const task = prefetch(href);
      abortCurrent = task.abort;
      const completed = await task.done;
      abortCurrent = null;
      inflight.delete(href);
      if (!cancelled && completed) freshAt.set(href, now());
      if (cancelled) return;
    }
  }

  return () => {
    cancelled = true;
    cancelDelay();
    abortCurrent?.();
    abortCurrent = null;
    for (const href of queue) {
      inflight.delete(href);
      if (!started.has(href)) freshAt.delete(href);
    }
  };
}
