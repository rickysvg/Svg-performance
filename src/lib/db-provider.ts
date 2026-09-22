/** Detect which database a DATABASE_URL is for. Prisma's provider is compile-time. */

export function usesPostgresUrl(url = process.env.DATABASE_URL ?? ""): boolean {
  return /^(postgres|postgresql):\/\//i.test(url.trim());
}

export function isSqliteFileUrl(url = process.env.DATABASE_URL ?? ""): boolean {
  return url.trim().toLowerCase().startsWith("file:");
}
