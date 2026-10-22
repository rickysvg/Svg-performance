/**
 * `/training/:day/start` creates a draft. Next prefetches `<Link>` targets in
 * production, and a cross-site GET would create one too. Those requests are
 * redirected and do not write.
 */
function headerListsPrefetch(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .includes("prefetch");
}

export function startRequestCreatesSession(headers: { get(name: string): string | null }) {
  if ((headers.get("sec-fetch-site") ?? "").toLowerCase() === "cross-site") return false;
  // Next sends these on viewport prefetch. A real click does not.
  if (headers.get("next-router-prefetch") != null) return false;
  if (headers.get("next-router-segment-prefetch") != null) return false;
  if (headerListsPrefetch(headers.get("purpose")) || headerListsPrefetch(headers.get("sec-purpose"))) {
    return false;
  }
  return true;
}
