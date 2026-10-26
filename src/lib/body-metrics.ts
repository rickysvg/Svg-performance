import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { kgToWholeLb } from "@/lib/units";
import { dayKey } from "@/lib/timezone";
import type { WeightSeriesPoint } from "@/lib/weight-series";

export type { WeightRange, WeightSeriesPoint } from "@/lib/weight-series";
export { filterWeightRange } from "@/lib/weight-series";

export const BODY_METRIC_KINDS = [
  "weight",
  "sleepHours",
  "restingHr",
  "leanMass",
  "bodyFat",
] as const;

export type BodyMetricKind = (typeof BODY_METRIC_KINDS)[number];

export const PHOTO_SLOTS = ["front", "side", "back"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

const KIND_UNITS: Record<BodyMetricKind, readonly string[]> = {
  weight: ["lb"],
  sleepHours: ["hours"],
  restingHr: ["bpm"],
  leanMass: ["lb"],
  bodyFat: ["percent"],
};

const KIND_MAX: Record<BodyMetricKind, number> = {
  weight: 800,
  sleepHours: 24,
  restingHr: 220,
  leanMass: 500,
  bodyFat: 70,
};

export function isBodyMetricKind(value: string): value is BodyMetricKind {
  return (BODY_METRIC_KINDS as readonly string[]).includes(value);
}

/** One decimal place, half-up. 181.2 stays 181.2; 181 stays 181.0 when formatted. */
export function roundOneDecimal(value: number) {
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 10) / 10;
}

/** Display a stored weight with its tenth so 181.2 never renders as 181 or "181.". */
export function formatOneDecimal(value: number) {
  const rounded = roundOneDecimal(value);
  if (!Number.isFinite(rounded)) return "";
  return rounded.toFixed(1);
}

/**
 * Parse a typed weight. Keeps a single tenth from the raw text so "181.2"
 * is not truncated to 181 by an integer cast. A trailing dot ("181.") is 181.0.
 */
export function parseOneDecimal(raw: unknown): number {
  const text = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!text) return Number.NaN;
  const match = /^(\d{1,4})(?:\.(\d*))?$/.exec(text);
  if (!match) return Number.NaN;
  const whole = Number(match[1]);
  const tenth = (match[2] ?? "").slice(0, 1);
  const tenths = whole * 10 + (tenth ? Number(tenth) : 0);
  return tenths / 10;
}

/** Keep at most one decimal while the member is typing a weigh-in. */
export function clampOneDecimalDraft(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned.slice(0, 4);
  const whole = cleaned.slice(0, dot).slice(0, 4);
  const tenth = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 1);
  return `${whole}.${tenth}`;
}

export function isPhotoSlot(value: string): value is PhotoSlot {
  return (PHOTO_SLOTS as readonly string[]).includes(value);
}

function assertOwnMetric<T extends { userId: string }>(row: T | null, userId: string): T {
  if (!row) {
    throw new NotFoundError("Body metric not found.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's body metrics.");
  }
  return row;
}

function assertOwnPhoto<T extends { userId: string }>(row: T | null, userId: string): T {
  if (!row) {
    throw new NotFoundError("Photo placeholder not found.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's photo placeholders.");
  }
  return row;
}

export function validateBodyMetricInput(input: {
  kind: string;
  value: number;
  unit: string;
  notes?: string;
}) {
  if (!isBodyMetricKind(input.kind)) {
    throw new AppError("BODY_METRIC", "Pick a valid metric (weight, sleep, resting HR, lean mass, or body fat).");
  }
  const allowedUnits = KIND_UNITS[input.kind];
  const unit = input.unit.trim();
  if (!allowedUnits.includes(unit)) {
    throw new AppError("BODY_METRIC", `Unit for ${input.kind} must be ${allowedUnits.join(" or ")}.`);
  }
  if (!Number.isFinite(input.value) || input.value <= 0 || input.value > KIND_MAX[input.kind]) {
    throw new AppError(
      "BODY_METRIC",
      `Enter a number greater than 0 and at most ${KIND_MAX[input.kind]}.`,
    );
  }
  return {
    kind: input.kind,
    value: roundOneDecimal(input.value),
    unit,
    notes: (input.notes ?? "").trim().slice(0, 200),
  };
}

export async function createBodyMetricForUser(
  userId: string,
  input: {
    kind: string;
    value: number;
    unit: string;
    recordedAt: Date;
    notes?: string;
  },
) {
  const data = validateBodyMetricInput(input);
  if (Number.isNaN(input.recordedAt.getTime())) {
    throw new AppError("BODY_METRIC", "Enter a valid date.");
  }
  return prisma.bodyMetric.create({
    data: {
      userId,
      ...data,
      recordedAt: input.recordedAt,
    },
  });
}

/** Blank is optional. A typed value uses the body-fat rules (percent, above 0, at most 70). */
export function optionalBodyFatPercent(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  return validateBodyMetricInput({
    kind: "bodyFat",
    value: Number(text),
    unit: "percent",
  }).value;
}

/**
 * Weight row plus an optional body-fat row at the same time.
 * Body fat already lives as kind `bodyFat`, so a weigh-in can store it alongside.
 */
export async function recordWeightEntryForUser(
  userId: string,
  input: {
    value: number;
    unit: string;
    recordedAt: Date;
    notes?: string;
    bodyFatPercent?: number | null;
  },
) {
  const weight = await createBodyMetricForUser(userId, {
    kind: "weight",
    value: input.value,
    unit: input.unit,
    recordedAt: input.recordedAt,
    notes: input.notes,
  });
  if (input.bodyFatPercent == null) return weight;
  try {
    await createBodyMetricForUser(userId, {
      kind: "bodyFat",
      value: input.bodyFatPercent,
      unit: "percent",
      recordedAt: input.recordedAt,
      notes: input.notes,
    });
  } catch (error) {
    await prisma.bodyMetric.delete({ where: { id: weight.id } }).catch(() => undefined);
    throw error;
  }
  return weight;
}

/** Newest rows the progress chart reads. Older weigh-ins stay in the database. */
export const BODY_METRIC_LIST_TAKE = 400;

export async function listBodyMetricsForUser(
  userId: string,
  kind?: BodyMetricKind,
  take = BODY_METRIC_LIST_TAKE,
) {
  return prisma.bodyMetric.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: { recordedAt: "desc" },
    take,
  });
}

/** Oldest first, in display units. Weight already lives on BodyMetric (kind = weight). */
export function weightSeriesPoints(
  rows: Array<{ id: string; recordedAt: Date; value: number; unit: string; kind: string }>,
  timeZone: string,
): WeightSeriesPoint[] {
  return [...rows]
    .map((row) => displayBodyMetric(row))
    .reverse()
    .map((row) => ({
      id: row.id,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone,
      }).format(row.recordedAt),
      value: row.value,
      unit: row.unit,
      recordedAt: row.recordedAt.toISOString(),
    }));
}

/** Convert legacy kg weight / lean-mass rows to whole lbs for display. */
export function displayBodyMetric<T extends { kind: string; value: number; unit: string }>(row: T): T {
  if ((row.kind === "weight" || row.kind === "leanMass") && row.unit === "kg") {
    return { ...row, value: kgToWholeLb(row.value), unit: "lb" };
  }
  if (row.kind === "weight" || row.kind === "leanMass" || row.kind === "bodyFat") {
    return { ...row, value: roundOneDecimal(row.value) };
  }
  return row;
}

export async function getRecentWeightsForUser(userId: string, take = 2) {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId, kind: "weight" },
    orderBy: { recordedAt: "desc" },
    take,
  });
  return rows.map((row) => displayBodyMetric(row));
}

/**
 * Body fat logged from the Home stat. It shares the timestamp of today's
 * weigh-in so the percent sits with that weight entry. A later save the same
 * day is ordered after the previous body-fat row.
 */
export async function recordBodyFatAlongsideTodayWeight(
  userId: string,
  input: { value: number; timeZone: string; now?: Date },
) {
  const value = validateBodyMetricInput({
    kind: "bodyFat",
    value: input.value,
    unit: "percent",
  }).value;
  const now = input.now ?? new Date();
  const today = dayKey(now, input.timeZone);
  const weights = await prisma.bodyMetric.findMany({
    where: { userId, kind: "weight" },
    orderBy: { recordedAt: "desc" },
    take: 40,
  });
  const todayWeight = weights.find((row) => dayKey(row.recordedAt, input.timeZone) === today);
  if (!todayWeight) {
    throw new AppError("BODY_METRIC", "Log today's weight first, then add body fat.");
  }
  const latestFat = await prisma.bodyMetric.findFirst({
    where: { userId, kind: "bodyFat" },
    orderBy: { recordedAt: "desc" },
  });
  let recordedAt = todayWeight.recordedAt;
  if (latestFat && latestFat.recordedAt.getTime() >= recordedAt.getTime()) {
    recordedAt = new Date(latestFat.recordedAt.getTime() + 1000);
  }
  return createBodyMetricForUser(userId, {
    kind: "bodyFat",
    value,
    unit: "percent",
    recordedAt,
    notes: "",
  });
}

/** Newest first. Previous entry is the one before the latest, for the home delta. */
export async function getRecentBodyFatForUser(userId: string, take = 2) {
  return prisma.bodyMetric.findMany({
    where: { userId, kind: "bodyFat" },
    orderBy: { recordedAt: "desc" },
    take,
  });
}

export async function getLatestBodyMetricsForUser(userId: string) {
  const rows = await Promise.all(
    BODY_METRIC_KINDS.map((kind) =>
      prisma.bodyMetric.findFirst({
        where: { userId, kind },
        orderBy: { recordedAt: "desc" },
      }),
    ),
  );
  const latest = new Map<string, NonNullable<(typeof rows)[number]>>();
  for (const row of rows) {
    if (!row || latest.has(row.kind)) continue;
    latest.set(row.kind, displayBodyMetric(row));
  }
  return latest;
}

export async function getBodyMetricForUser(metricId: string, userId: string) {
  const row = await prisma.bodyMetric.findUnique({ where: { id: metricId } });
  return assertOwnMetric(row, userId);
}

export async function deleteBodyMetricForUser(metricId: string, userId: string) {
  await getBodyMetricForUser(metricId, userId);
  await prisma.bodyMetric.delete({ where: { id: metricId } });
}

export async function updateBodyMetricValueForUser(userId: string, metricId: string, value: number) {
  const row = await getBodyMetricForUser(metricId, userId);
  const unit = row.kind === "weight" || row.kind === "leanMass" ? "lb" : row.unit;
  const data = validateBodyMetricInput({ kind: row.kind, value, unit });
  return prisma.bodyMetric.update({
    where: { id: row.id },
    data: { value: data.value, unit: data.unit },
  });
}

export async function listPhotoPlaceholdersForUser(userId: string) {
  return prisma.bodyPhotoPlaceholder.findMany({
    where: { userId },
    orderBy: { slot: "asc" },
  });
}

export async function upsertPhotoPlaceholderForUser(
  userId: string,
  input: { slot: string; caption: string; recordedAt: Date },
) {
  if (!isPhotoSlot(input.slot)) {
    throw new AppError("BODY_PHOTO", "Pick front, side, or back.");
  }
  if (Number.isNaN(input.recordedAt.getTime())) {
    throw new AppError("BODY_PHOTO", "Enter a valid date.");
  }
  return prisma.bodyPhotoPlaceholder.upsert({
    where: { userId_slot: { userId, slot: input.slot } },
    create: {
      userId,
      slot: input.slot,
      caption: input.caption.trim().slice(0, 120),
      recordedAt: input.recordedAt,
    },
    update: {
      caption: input.caption.trim().slice(0, 120),
      recordedAt: input.recordedAt,
    },
  });
}

export async function getPhotoPlaceholderForUser(photoId: string, userId: string) {
  const row = await prisma.bodyPhotoPlaceholder.findUnique({ where: { id: photoId } });
  return assertOwnPhoto(row, userId);
}

export async function deletePhotoPlaceholderForUser(photoId: string, userId: string) {
  await getPhotoPlaceholderForUser(photoId, userId);
  await prisma.bodyPhotoPlaceholder.delete({ where: { id: photoId } });
}
