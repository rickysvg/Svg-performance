#!/usr/bin/env node
/**
 * Seed DEMO program / lessons.
 * Generates the Prisma client for the current DATABASE_URL, then runs prisma/seed.ts.
 * Does not read a password or invent a host URL.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
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

loadDotEnv();
execSync("node scripts/prisma-prepare.mjs", { stdio: "inherit", env: process.env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
