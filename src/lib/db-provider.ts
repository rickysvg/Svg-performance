/** Detect which database a DATABASE_URL is for. Prisma's provider is compile-time. */

const ALT_POSTGRES_ENV_NAMES = [
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
] as const;

export function usesPostgresUrl(url = process.env.DATABASE_URL ?? ""): boolean {
  return /^(postgres|postgresql):\/\//i.test(url.trim());
}

type EnvLike = Record<string, string | undefined>;

/** Vercel Postgres / Neon often put the preview URL in a name other than DATABASE_URL. */
export function resolveHostedPostgresUrl(env: EnvLike = process.env) {
  const primary = (env.DATABASE_URL ?? "").trim();
  if (usesPostgresUrl(primary)) return { name: "DATABASE_URL", url: primary };
  for (const name of ALT_POSTGRES_ENV_NAMES) {
    const value = (env[name] ?? "").trim();
    if (usesPostgresUrl(value)) return { name, url: value };
  }
  return null;
}

export function ensureDatabaseUrl(env: EnvLike = process.env) {
  const resolved = resolveHostedPostgresUrl(env);
  if (!resolved) return null;
  if ((env.DATABASE_URL ?? "").trim() !== resolved.url) {
    env.DATABASE_URL = resolved.url;
  }
  return resolved;
}

export function isSqliteFileUrl(url = process.env.DATABASE_URL ?? ""): boolean {
  return url.trim().toLowerCase().startsWith("file:");
}
