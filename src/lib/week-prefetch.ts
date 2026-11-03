/**
 * Neighbor-week prefetch. Full route data stays cached for a fast week change,
 * but the work waits until the browser is idle, runs one week at a time, and
 * stops when the member leaves the page.
 */

export type IdleId = number;

export type IdleHost = {
  request: (callback: () => void) => IdleId;
  cancel: (id: IdleId) => void;
};

export type WeekPrefetchRouter = {
  prefetch: (href: string, options?: { kind: "full" }) => void;
};

const claimed = new Set<string>();
const started = new Set<string>();

export function resetWeekPrefetchState() {
  claimed.clear();
  started.clear();
}

export function prefetchWeekRoute(router: WeekPrefetchRouter, href: string) {
  router.prefetch(href, { kind: "full" });
}

/** Drop blanks and hrefs that are already queued or fetched. */
export function freshPrefetchHrefs(hrefs: readonly string[], taken: ReadonlySet<string>) {
  const unique: string[] = [];
  for (const href of hrefs) {
    if (!href || taken.has(href) || unique.includes(href)) continue;
    unique.push(href);
  }
  return unique;
}

function browserIdleHost(): IdleHost {
  return {
    request(callback) {
      if (typeof requestIdleCallback === "function") {
        return requestIdleCallback(() => callback());
      }
      return window.setTimeout(callback, 1) as unknown as number;
    },
    cancel(id) {
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
      else window.clearTimeout(id);
    },
  };
}

/**
 * Prefetch hrefs one at a time, after idle. Cancel before the next idle
 * skips anything that has not started. A href that already started is not
 * fetched again.
 */
export function scheduleWeekPrefetch(
  hrefs: readonly string[],
  prefetch: (href: string) => void,
  host: IdleHost = browserIdleHost(),
) {
  const queue = freshPrefetchHrefs(hrefs, claimed);
  for (const href of queue) claimed.add(href);
  if (queue.length === 0) return () => undefined;

  let index = 0;
  let cancelled = false;
  const pending: IdleId[] = [];

  function arm(callback: () => void) {
    const id = host.request(() => {
      const at = pending.indexOf(id);
      if (at >= 0) pending.splice(at, 1);
      callback();
    });
    pending.push(id);
  }

  function step() {
    if (cancelled) return;
    const href = queue[index];
    index += 1;
    if (!href) return;
    if (!started.has(href)) {
      started.add(href);
      prefetch(href);
    }
    if (!cancelled && index < queue.length) arm(step);
  }

  arm(step);

  return () => {
    cancelled = true;
    for (const id of pending) host.cancel(id);
    pending.length = 0;
    for (const href of queue) {
      if (!started.has(href)) claimed.delete(href);
    }
  };
}
