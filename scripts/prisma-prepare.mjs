#!/usr/bin/env node
/**
 * Pick the Prisma schema from DATABASE_URL.
 * Laptop: file:./dev.db → SQLite (prisma/schema.prisma + migrate deploy).
 * Hosted: postgresql://… → Postgres (prisma/schema.postgres.prisma + db push).
 *
 * Never put secrets in this file. It only reads DATABASE_URL from the environment.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sqliteSchema = path.join(root, "prisma", "schema.prisma");
const postgresSchema = path.join(root, "prisma", "schema.postgres.prisma");

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function usesPostgresUrl(url = process.env.DATABASE_URL ?? "") {
  return /^(postgres|postgresql):\/\//i.test(url.trim());
}

function isSqliteFileUrl(url = process.env.DATABASE_URL ?? "") {
  return url.trim().toLowerCase().startsWith("file:");
}

export function writePostgresSchema() {
  const src = fs.readFileSync(sqliteSchema, "utf8");
  if (!src.includes('provider = "sqlite"')) {
    throw new Error('prisma/schema.prisma must keep provider = "sqlite" for laptop setup.');
  }
  const body = src.replace('provider = "sqlite"', 'provider = "postgresql"');
  const header =
    "// Generated from prisma/schema.prisma by scripts/prisma-prepare.mjs.\n" +
    "// Hosted preview uses this file when DATABASE_URL starts with postgresql://.\n" +
    "// Do not edit by hand — change schema.prisma and re-run the script.\n\n";
  fs.writeFileSync(postgresSchema, header + body);
  return postgresSchema;
}

function run(command) {
  execSync(command, { stdio: "inherit", env: process.env, cwd: root });
}

function hostedNeedsPostgresMessage() {
  return `
Hosted preview needs a Postgres DATABASE_URL.

On a laptop, DATABASE_URL is file:./dev.db (SQLite). That file does not work on Vercel.

Do this:
1. Create a free Neon project (neon.tech) or Vercel Postgres.
2. Copy the connection string. It starts with postgresql://
3. In Vercel → Settings → Environment Variables, set:
   AUTH_SECRET  — long random string
   DATABASE_URL — the postgres string (not file:./dev.db)
   APP_URL      — your real Vercel URL after the first deploy
4. Redeploy.

Keep Stripe as TEST keys only (sk_test_…). Never sk_live_.
This script does not invent a public URL for you.
`.trim();
}

loadDotEnv();

const writeOnly = process.argv.includes("--write-postgres-schema-only");
const deployFlag = process.argv.includes("--deploy");
const onVercel = process.env.VERCEL === "1";
const url = process.env.DATABASE_URL ?? "";
const postgres = usesPostgresUrl(url);
const deploy = deployFlag || onVercel;

writePostgresSchema();

if (writeOnly) {
  process.stdout.write(`Wrote ${path.relative(root, postgresSchema)}\n`);
  process.exit(0);
}

if (onVercel && !postgres) {
  console.error(hostedNeedsPostgresMessage());
  process.exit(1);
}

if (onVercel && isSqliteFileUrl(url)) {
  console.error(hostedNeedsPostgresMessage());
  process.exit(1);
}

if (postgres) {
  console.log("Prisma: PostgreSQL (hosted / DATABASE_URL).");
  run("npx prisma generate --schema=prisma/schema.postgres.prisma");
  if (deploy) {
    console.log("Prisma: db push (empty Neon/Vercel Postgres is OK; no data-loss flag).");
    run("npx prisma db push --schema=prisma/schema.postgres.prisma");
  }
} else {
  console.log("Prisma: SQLite (laptop).");
  run("npx prisma generate --schema=prisma/schema.prisma");
  if (deploy) {
    run("npx prisma migrate deploy --schema=prisma/schema.prisma");
  }
}
