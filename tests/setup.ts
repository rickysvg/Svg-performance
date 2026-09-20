import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET = "test-auth-secret-at-least-16";
process.env.APP_URL = "http://localhost:3000";

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
