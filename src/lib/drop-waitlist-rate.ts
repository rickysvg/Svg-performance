const hits = new Map<string, number[]>();

export function resetWaitlistRateLimit() {
  hits.clear();
}

/** Returns false when the key is already at the limit. */
export function takeWaitlistSlot(key: string, now: number, windowMs: number, max: number) {
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function waitlistClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (forwarded) return `ip:${forwarded.slice(0, 80)}`;
  return "ip:local";
}
