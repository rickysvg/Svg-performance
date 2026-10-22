import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SESSION_DURATION_CAP_SECONDS, resolveSessionElapsed } from "@/lib/session-elapsed";
import {
  isMissingTimerColumnError,
  readWorkoutTimerFields,
} from "@/lib/workout-timer-columns";

const hasSqlite3 = spawnSync("sqlite3", ["-version"]).status === 0;

describe("missing workout timer columns", () => {
  it("recognizes a database that has not been altered yet", () => {
    expect(
      isMissingTimerColumnError(
        new Error("The column `elapsedSeconds` does not exist in the current database."),
      ),
    ).toBe(true);
    expect(isMissingTimerColumnError(new Error("no such column: finishedAt"))).toBe(true);
    expect(isMissingTimerColumnError({ code: "P2022", message: "timerStartedAt" })).toBe(true);
    expect(isMissingTimerColumnError(new Error("The column `notes` does not exist"))).toBe(false);
    expect(isMissingTimerColumnError(new Error("elapsedSeconds must be a number"))).toBe(false);
  });

  // The copy step shells out to the sqlite3 CLI. CI installs it. Skip when the image does not have it.
  it.skipIf(!hasSqlite3)("loads and saves a workout when the three columns are absent and falls back to a capped duration", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "timer-columns-"));
    const dbPath = path.join(dir, "missing.db");
    execSync(`sqlite3 ${JSON.stringify(path.resolve("prisma/test.db"))} ".backup ${dbPath}"`, {
      stdio: "inherit",
    });
    const client = new PrismaClient({
      datasourceUrl: `file:${dbPath}`,
      omit: {
        workoutSession: {
          finishedAt: true,
          elapsedSeconds: true,
          timerStartedAt: true,
        },
      },
    });
    try {
      const user = await client.user.create({
        data: { email: `timer-columns-${Date.now()}@example.com`, passwordHash: "x" },
      });
      const createdAt = new Date("2026-10-20T16:00:00.000Z");
      const updatedAt = new Date("2026-10-20T21:00:00.000Z");
      const session = await client.workoutSession.create({
        data: {
          userId: user.id,
          title: "Lift 2 — Full body",
          performedAt: createdAt,
          status: "complete",
          createdAt,
          updatedAt,
          elapsedSeconds: 4360,
        },
      });
      await client.$executeRawUnsafe(`ALTER TABLE "WorkoutSession" DROP COLUMN "finishedAt"`);
      await client.$executeRawUnsafe(`ALTER TABLE "WorkoutSession" DROP COLUMN "elapsedSeconds"`);
      await client.$executeRawUnsafe(`ALTER TABLE "WorkoutSession" DROP COLUMN "timerStartedAt"`);

      const listed = await client.workoutSession.findMany({ where: { id: session.id } });
      expect(listed).toHaveLength(1);
      const saved = await client.workoutSession.update({
        where: { id: session.id },
        data: { notes: "still saves", updatedAt },
      });
      expect(saved.notes).toBe("still saves");
      const started = await client.workoutSession.create({
        data: {
          userId: user.id,
          title: "Started without timer columns",
          performedAt: createdAt,
          status: "draft",
        },
      });
      expect(started.status).toBe("draft");

      const timer = await readWorkoutTimerFields(session.id, client);
      expect(timer).toEqual({ finishedAt: null, elapsedSeconds: null, timerStartedAt: null });
      const row = await client.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
      const view = resolveSessionElapsed(
        { status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, ...timer },
        new Date("2026-10-21T18:00:00.000Z"),
      );
      expect(view.ticking).toBe(false);
      expect(view.seconds).toBe(SESSION_DURATION_CAP_SECONDS);
      expect(view.label).toBe("4:00:00");

      await expect(
        client.workoutSession.update({
          where: { id: session.id },
          data: { elapsedSeconds: 1 },
        }),
      ).rejects.toSatisfy(isMissingTimerColumnError);
    } finally {
      await client.$disconnect();
    }
  });
});
