/**
 * Neon / Vercel Postgres pooled URLs cannot run Prisma schema-engine DDL.
 * db push on a -pooler host often fails; the same URL with -pooler removed is the direct host.
 */
export function neonDirectUrl(url = "") {
  const raw = url.trim();
  if (!/^(postgres|postgresql):\/\//i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    }
    parsed.searchParams.delete("pgbouncer");
    parsed.searchParams.delete("connection_limit");
    return parsed.toString();
  } catch {
    return raw;
  }
}
