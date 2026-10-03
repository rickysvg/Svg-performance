#!/usr/bin/env node
/**
 * Pick the Prisma schema from DATABASE_URL.
 * Laptop: file:./dev.db → SQLite (prisma/schema.prisma + migrate deploy).
 * Hosted: postgresql://… → Postgres (prisma/schema.postgres.prisma + db push).
 *
 * Never put secrets in this file. It only reads connection URLs from the environment.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { hostedDdlUrl, hostedPreparePlan } from "./postgres-url.mjs";

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

function run(command, extraEnv = {}) {
  execSync(command, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    cwd: root,
  });
}

function applyHostedAdditiveSql(databaseUrl) {
  const file = path.join(root, "prisma", "hosted-additive.sql");
  if (!fs.existsSync(file)) return;
  console.log("Prisma: apply hosted additive SQL (IF NOT EXISTS, no drops).");
  run(
    `npx prisma db execute --schema=prisma/schema.postgres.prisma --file "${file}"`,
    { DATABASE_URL: databaseUrl },
  );
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
                  Preview may use POSTGRES_URL, POSTGRES_PRISMA_URL,
                  POSTGRES_URL_NON_POOLING, or DATABASE_URL_UNPOOLED instead.
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
const deploy = deployFlag || onVercel;
const plan = hostedPreparePlan({
  onVercel,
  vercelEnv: process.env.VERCEL_ENV ?? "",
  env: process.env,
});

writePostgresSchema();

if (writeOnly) {
  process.stdout.write(`Wrote ${path.relative(root, postgresSchema)}\n`);
  process.exit(0);
}

if (plan.action === "fail") {
  console.error(hostedNeedsPostgresMessage());
  process.exit(1);
}

if (plan.action === "preview-without-database") {
  console.warn(
    [
      "Preview build has no Postgres URL.",
      "Checked DATABASE_URL, POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, DIRECT_URL, POSTGRES_PRISMA_URL, POSTGRES_URL.",
      "Generating the Prisma client and skipping db push so this preview can finish.",
      "The preview app cannot read workouts until one of those is set for the Preview environment.",
      "Production still stops when the URL is missing.",
    ].join("\n"),
  );
  run("npx prisma generate --schema=prisma/schema.postgres.prisma", {
    DATABASE_URL: "postgresql://preview:preview@127.0.0.1:5432/preview",
  });
  process.exit(0);
}

if (plan.action === "postgres") {
  console.log(`Prisma: PostgreSQL (hosted / ${plan.name}).`);
  run("npx prisma generate --schema=prisma/schema.postgres.prisma", {
    DATABASE_URL: plan.url,
  });
  if (deploy) {
    const pushUrl = hostedDdlUrl(process.env, plan.url);
    if (pushUrl !== plan.url) {
      console.log("Prisma: db push / additive SQL use the direct (non-pooler) URL.");
    }
    applyHostedAdditiveSql(pushUrl);
    console.log("Prisma: db push (empty Neon/Vercel Postgres is OK; no data-loss flag).");
    run("npx prisma db push --schema=prisma/schema.postgres.prisma --skip-generate", {
      DATABASE_URL: pushUrl,
    });
    run("npx tsx scripts/invalidate-password-reset-tokens.ts", {
      DATABASE_URL: pushUrl,
    });
  }
} else {
  console.log("Prisma: SQLite (laptop).");
  run("npx prisma generate --schema=prisma/schema.prisma");
  if (deploy) {
    run("npx prisma migrate deploy --schema=prisma/schema.prisma");
    run("npx tsx scripts/invalidate-password-reset-tokens.ts");
  }
}
