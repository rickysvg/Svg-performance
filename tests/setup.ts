import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeEach } from "vitest";
import { clearCalendarScaleCache } from "@/lib/plan-doses";

process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET = "test-auth-secret-at-least-16";
process.env.APP_URL = "http://localhost:3000";

function isolateGymdeskEnv() {
  // Local .env may have Gymdesk secrets for the preview app. Keep them off
  // unless a Gymdesk test turns them on, so trial/verify tests stay isolated.
  delete process.env.GYMDESK_WEBHOOK_SECRET;
  delete process.env.GYMDESK_MATCH_PEPPER;
  delete process.env.GYMDESK_SYNC_ENABLED;
}

function isolateCoachKey() {
  // Offline coach tests assert the canned reply. An ambient API key calls the
  // model instead, and that reply misses the "missed class" wording. A test
  // that needs the key sets it after this hook. Live eval opts in explicitly.
  if (process.env.COACH_LIVE_EVAL === "1") return;
  delete process.env.OPENAI_API_KEY;
}

isolateGymdeskEnv();
isolateCoachKey();
beforeEach(() => {
  isolateGymdeskEnv();
  isolateCoachKey();
  clearCalendarScaleCache();
});

const dbPath = path.resolve(process.cwd(), "prisma/test.db");
// Prisma SQLite URLs are relative to the prisma/ folder, so file:./test.db
// is prisma/test.db. Clean that file before migrate.
if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
}
if (fs.existsSync(`${dbPath}-journal`)) {
  fs.rmSync(`${dbPath}-journal`);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: process.env,
});
execSync("npx prisma db seed", {
  stdio: "inherit",
  env: process.env,
});
