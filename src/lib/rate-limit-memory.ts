const hits = new Map<string, number>();

/** Best-effort per-instance limit. A second instance does not share the clock. */
export function tooSoon(key: string, intervalMs: number, now = Date.now()) {
  const last = hits.get(key) ?? 0;
  if (now - last < intervalMs) return true;
  hits.set(key, now);
  return false;
}

export function clearRateLimits() {
  hits.clear();
}
