import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";

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
  weight: ["lb", "kg"],
  sleepHours: ["hours"],
  restingHr: ["bpm"],
  leanMass: ["lb", "kg"],
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
    value: Math.round(input.value * 10) / 10,
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

export async function listBodyMetricsForUser(userId: string, kind?: BodyMetricKind) {
  return prisma.bodyMetric.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: { recordedAt: "desc" },
  });
}

export async function getLatestBodyMetricsForUser(userId: string) {
  const rows = await prisma.bodyMetric.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.kind)) {
      latest.set(row.kind, row);
    }
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
