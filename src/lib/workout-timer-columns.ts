import type { PrismaClient } from "@prisma/client";

/**
 * Header-timer columns are additive. Production can be serving this code
 * before the ALTER lands, and a SELECT/UPDATE that names a missing column
 * throws. Reads and writes go through here so a missing column becomes a
 * null timer and the logger uses capped updatedAt - createdAt instead.
 */
const TIMER_COLUMNS = ["finishedAt", "elapsedSeconds", "timerStartedAt"] as const;

export type WorkoutTimerFields = {
  finishedAt: Date | null;
  elapsedSeconds: number | null;
  timerStartedAt: Date | null;
};

const EMPTY_TIMER: WorkoutTimerFields = {
  finishedAt: null,
  elapsedSeconds: null,
  timerStartedAt: null,
};

type RawClient = Pick<PrismaClient, "$queryRaw" | "$queryRawUnsafe">;

const availableByClient = new WeakMap<object, true>();
const loggedMissing = new WeakSet<object>();

function databaseIsPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function errorText(error: unknown): string {
  if (typeof error === "object" && error) {
    const record = error as { code?: unknown; message?: unknown };
    const code = record.code == null ? "" : String(record.code);
    const message = error instanceof Error ? error.message : record.message == null ? "" : String(record.message);
    return `${code} ${message}`;
  }
  return String(error);
}

export function isMissingTimerColumnError(error: unknown): boolean {
  const text = errorText(error);
  if (!/finishedAt|elapsedSeconds|timerStartedAt/.test(text)) return false;
  return /does not exist|no such column|P2022/i.test(text);
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "bigint" || typeof value === "number") {
    const ms = Number(value);
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "finishedAt" || trimmed === "timerStartedAt") return null;
    if (/^\d+$/.test(trimmed)) {
      const date = new Date(Number(trimmed));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "bigint" || typeof value === "number") {
    return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "elapsedSeconds") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function field(row: Record<string, unknown>, name: string): unknown {
  if (name in row) return row[name];
  const match = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? row[match] : null;
}

function asTimer(row: Record<string, unknown> | undefined): WorkoutTimerFields {
  if (!row) return { ...EMPTY_TIMER };
  return {
    finishedAt: toDate(field(row, "finishedAt")),
    elapsedSeconds: toInt(field(row, "elapsedSeconds")),
    timerStartedAt: toDate(field(row, "timerStartedAt")),
  };
}

async function columnNames(client: RawClient): Promise<Set<string>> {
  if (databaseIsPostgres()) {
    const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WorkoutSession'`,
    );
    return new Set(rows.map((row) => String(field(row, "column_name") ?? "")));
  }
  const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `PRAGMA table_info("WorkoutSession")`,
  );
  return new Set(rows.map((row) => String(field(row, "name") ?? "")));
}

/** True once the three timer columns are present. A miss is rechecked so SQL can land without a restart. */
export async function workoutTimerColumnsAvailable(client: RawClient): Promise<boolean> {
  if (availableByClient.get(client) === true) return true;
  const names = await columnNames(client);
  const ready = TIMER_COLUMNS.every((name) => names.has(name));
  if (ready) {
    availableByClient.set(client, true);
    return true;
  }
  if (!loggedMissing.has(client)) {
    loggedMissing.add(client);
    console.warn(
      "WorkoutSession timer columns are missing. Completed workouts fall back to capped updatedAt - createdAt until the additive SQL is applied.",
    );
  }
  return false;
}

export async function readWorkoutTimerFields(id: string, client: RawClient): Promise<WorkoutTimerFields> {
  if (!(await workoutTimerColumnsAvailable(client))) return { ...EMPTY_TIMER };
  const rows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "finishedAt", "elapsedSeconds", "timerStartedAt"
    FROM "WorkoutSession"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return asTimer(rows[0]);
}

export async function readDraftTimerFields(
  userId: string,
  client: RawClient,
): Promise<Map<string, WorkoutTimerFields>> {
  const timers = new Map<string, WorkoutTimerFields>();
  if (!(await workoutTimerColumnsAvailable(client))) return timers;
  const rows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "id", "finishedAt", "elapsedSeconds", "timerStartedAt"
    FROM "WorkoutSession"
    WHERE "userId" = ${userId} AND "status" = 'draft'
  `;
  for (const row of rows) {
    const id = field(row, "id");
    if (typeof id === "string" && id) timers.set(id, asTimer(row));
  }
  return timers;
}

export async function attachWorkoutTimer<T extends { id: string }>(
  session: T,
  client: RawClient,
): Promise<T & WorkoutTimerFields> {
  const timer = await readWorkoutTimerFields(session.id, client);
  return { ...session, ...timer };
}
