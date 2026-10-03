/**
 * Neon / Vercel Postgres pooled URLs cannot run Prisma schema-engine DDL.
 * db push on a -pooler host often fails; the same URL with -pooler removed is the direct host.
 *
 * Vercel Postgres and Neon inject the connection string under several names.
 * Production in this project sets DATABASE_URL. Preview often only has one of the others.
 */

export function isPostgresUrl(url = "") {
  return /^(postgres|postgresql):\/\//i.test(String(url).trim());
}

export const HOSTED_POSTGRES_ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
];

export function resolveHostedPostgresUrl(env = {}) {
  const primary = String(env.DATABASE_URL ?? "").trim();
  if (isPostgresUrl(primary)) return { name: "DATABASE_URL", url: primary };
  for (const name of HOSTED_POSTGRES_ENV_NAMES) {
    if (name === "DATABASE_URL") continue;
    const value = String(env[name] ?? "").trim();
    if (isPostgresUrl(value)) return { name, url: value };
  }
  return null;
}

/**
 * What `prisma-prepare` should do.
 * Preview builds with no Postgres URL used to exit 1 before `next build`.
 * Production still fails closed so a live deploy cannot skip the database.
 */
export function hostedPreparePlan({ onVercel = false, vercelEnv = "", env = {} } = {}) {
  const resolved = resolveHostedPostgresUrl(env);
  if (resolved) return { action: "postgres", name: resolved.name, url: resolved.url };
  if (!onVercel) return { action: "sqlite" };
  if (vercelEnv === "preview") return { action: "preview-without-database" };
  return { action: "fail" };
}

export function hostedDdlUrl(env = {}, resolvedUrl = "") {
  const directEnv = String(env.DIRECT_URL ?? "").trim();
  if (isPostgresUrl(directEnv)) return neonDirectUrl(directEnv);
  return neonDirectUrl(resolvedUrl);
}

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
