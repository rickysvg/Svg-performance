import { execSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isSqliteFileUrl, usesPostgresUrl } from "@/lib/db-provider";
import { neonDirectUrl } from "../scripts/postgres-url.mjs";

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

  it("rewrites Neon pooler hosts to the direct host for schema DDL", () => {
    expect(
      neonDirectUrl(
        "postgresql://u:p@ep-foo-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true",
      ),
    ).toBe("postgresql://u:p@ep-foo.us-east-1.aws.neon.tech/neondb?sslmode=require");
    expect(neonDirectUrl("postgresql://u:p@127.0.0.1:5432/svg")).toBe(
      "postgresql://u:p@127.0.0.1:5432/svg",
    );
    expect(neonDirectUrl("file:./dev.db")).toBe("file:./dev.db");
  });

  it("keeps local puppeteer capture scripts out of the Next typecheck tree", () => {
    const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8")) as {
      exclude?: string[];
    };
    expect(tsconfig.exclude?.some((rule) => rule.includes("scripts/capture-"))).toBe(true);
    expect(fs.existsSync("scripts/capture-badge-unlock.ts")).toBe(true);
    expect(fs.existsSync("scripts/capture-companion-screens.ts")).toBe(true);
    expect(fs.readFileSync("package.json", "utf8")).not.toMatch(/"puppeteer"/);
  });

  it("ships idempotent additive SQL for the #46 Profile columns", () => {
    const sql = fs.readFileSync("prisma/hosted-additive.sql", "utf8");
    const prepare = fs.readFileSync("scripts/prisma-prepare.mjs", "utf8");
    expect(sql).toContain("leaderboardOptIn");
    expect(sql).toContain("seenBadgeUnlocksJson");
    expect(sql).toContain("DEFAULT false");
    expect(sql).toContain("DEFAULT '[]'");
    expect(sql).toMatch(/IF NOT EXISTS|to_regclass/);
    expect(sql.toUpperCase()).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT)\b/);
    expect(prepare).toContain("hosted-additive.sql");
    expect(prepare).toContain("neonDirectUrl");
    expect(prepare).not.toContain("--accept-data-loss");
  });
});
