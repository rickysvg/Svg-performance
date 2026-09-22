import { execSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isSqliteFileUrl, usesPostgresUrl } from "@/lib/db-provider";

describe("hosted preview database selection", () => {
  it("treats postgres URLs as hosted and sqlite files as laptop", () => {
    expect(usesPostgresUrl("postgresql://user:pass@host/db?sslmode=require")).toBe(true);
    expect(usesPostgresUrl("postgres://user:pass@host/db")).toBe(true);
    expect(usesPostgresUrl("file:./dev.db")).toBe(false);
    expect(usesPostgresUrl("")).toBe(false);
    expect(isSqliteFileUrl("file:./dev.db")).toBe(true);
    expect(isSqliteFileUrl("file:./test.db")).toBe(true);
    expect(isSqliteFileUrl("postgresql://user:pass@host/db")).toBe(false);
  });

  it("keeps the laptop schema on SQLite", () => {
    const src = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(src).toMatch(/provider\s*=\s*"sqlite"/);
    expect(src).not.toMatch(/provider\s*=\s*"postgresql"/);
  });

  it("writes a Postgres schema that Prisma accepts without a live database", () => {
    execSync("node scripts/prisma-prepare.mjs --write-postgres-schema-only", {
      stdio: "pipe",
    });
    const pg = fs.readFileSync("prisma/schema.postgres.prisma", "utf8");
    expect(pg).toMatch(/provider\s*=\s*"postgresql"/);
    expect(pg).not.toMatch(/provider\s*=\s*"sqlite"/);
    expect(pg).toContain("model User");
    expect(pg).toContain("model WeeklyFocusVideo");

    execSync("npx prisma validate --schema=prisma/schema.postgres.prisma", {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://preview:preview@127.0.0.1:5432/preview",
      },
    });
  });
});
