import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  disconnectPolarForUser,
  fetchPolarExercises,
  fetchPolarNightlyRecharge,
  isPolarConfigured,
  type PolarFetch,
} from "@/lib/polar";

export const HR_SOURCES = [
  "manual",
  "polar",
  "import",
  "demo",
  "apple_health",
  "apple_watch_import",
] as const;
export type HrSource = (typeof HR_SOURCES)[number];

export const HR_NOT_MEDICAL_ADVICE =
  "This is training data, not medical advice. It is not a diagnosis.";

export const DEFAULT_HR_MAX = 190;

export function isHrSource(value: string): value is HrSource {
  return (HR_SOURCES as readonly string[]).includes(value);
}

export function hrSourceLabel(source: string) {
  switch (source) {
    case "polar":
      return "From Polar";
    case "apple_health":
      return "Imported from Apple Health";
    case "apple_watch_import":
      return "Imported watch workout (Health export)";
    case "import":
      return "Imported (Apple Health export / watch workout)";
    case "demo":
      return "DEMO sample";
    case "manual":
    default:
      return "Typed by you";
  }
}

export function validateBpm(value: number, label = "Heart rate") {
  if (!Number.isFinite(value) || value < 30 || value > 230) {
    throw new AppError("HEART", `${label} must be between 30 and 230 bpm.`);
  }
  return Math.round(value);
}

function assertOwn<T extends { userId: string }>(
  row: T | null,
  userId: string,
  notFound = "Heart-rate record not found.",
): T {
  if (!row) {
    throw new NotFoundError(notFound);
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's heart-rate data.");
  }
  return row;
}

export async function getHeartDeviceStatus(userId: string) {
  const polarConfigured = isPolarConfigured();
  const connection = await prisma.polarConnection.findUnique({
    where: { userId },
    select: {
      polarUserId: true,
      accessToken: true,
      lastSyncedAt: true,
      lastError: true,
    },
  });
  const polarConnected = Boolean(polarConfigured && connection?.accessToken);
  return {
    polarConfigured,
    polarConnected,
    polarUserId: polarConnected ? connection?.polarUserId || null : null,
    lastSyncedAt: polarConnected ? connection?.lastSyncedAt ?? null : null,
    lastError: polarConnected ? connection?.lastError ?? "" : "",
    appleWatchConnected: false as const,
    appleHealthKitBridge: false as const,
  };
}

export async function createRestingSampleForUser(
  userId: string,
  input: { bpm: number; recordedAt: Date; source: string },
) {
  if (!isHrSource(input.source)) {
    throw new AppError("HEART", "Pick a valid heart-rate source.");
  }
  if (Number.isNaN(input.recordedAt.getTime())) {
    throw new AppError("HEART", "Enter a valid date.");
  }
  return prisma.hrRestingSample.create({
    data: {
      userId,
      bpm: validateBpm(input.bpm, "Resting heart rate"),
      recordedAt: input.recordedAt,
      source: input.source,
    },
  });
}

export async function listRestingSamplesForUser(userId: string) {
  return prisma.hrRestingSample.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });
}

export async function getRestingSampleForUser(sampleId: string, userId: string) {
  const row = await prisma.hrRestingSample.findUnique({ where: { id: sampleId } });
  return assertOwn(row, userId);
}

export async function deleteRestingSampleForUser(sampleId: string, userId: string) {
  await getRestingSampleForUser(sampleId, userId);
  await prisma.hrRestingSample.delete({ where: { id: sampleId } });
}

export type WorkoutHrInput = {
  workoutSessionId?: string | null;
  startedAt: Date;
  endedAt: Date;
  avgBpm: number;
  maxBpm: number;
  source: string;
  externalId?: string;
  zone1Seconds?: number;
  zone2Seconds?: number;
  zone3Seconds?: number;
  zone4Seconds?: number;
  zone5Seconds?: number;
};

function normalizeWorkoutInput(input: WorkoutHrInput) {
  if (!isHrSource(input.source)) {
    throw new AppError("HEART", "Pick a valid heart-rate source.");
  }
  if (Number.isNaN(input.startedAt.getTime()) || Number.isNaN(input.endedAt.getTime())) {
    throw new AppError("HEART", "Enter a valid start and end time.");
  }
  if (input.endedAt < input.startedAt) {
    throw new AppError("HEART", "End time must be after the start time.");
  }
  const avgBpm = validateBpm(input.avgBpm, "Average heart rate");
  const maxBpm = validateBpm(input.maxBpm, "Max heart rate");
  if (maxBpm < avgBpm) {
    throw new AppError("HEART", "Max heart rate cannot be lower than average.");
  }
  const zone = (value: number | undefined) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > 24 * 3600) {
      throw new AppError("HEART", "Zone seconds must be between 0 and 24 hours.");
    }
    return Math.round(n);
  };
  return {
    workoutSessionId: input.workoutSessionId || null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    avgBpm,
    maxBpm,
    source: input.source,
    externalId: (input.externalId ?? "").trim(),
    zone1Seconds: zone(input.zone1Seconds),
    zone2Seconds: zone(input.zone2Seconds),
    zone3Seconds: zone(input.zone3Seconds),
    zone4Seconds: zone(input.zone4Seconds),
    zone5Seconds: zone(input.zone5Seconds),
  };
}

export async function createWorkoutHrForUser(userId: string, input: WorkoutHrInput) {
  const data = normalizeWorkoutInput(input);
  if (data.externalId) {
    const existing = await prisma.hrWorkoutSession.findFirst({
      where: { userId, source: data.source, externalId: data.externalId },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ForbiddenError("You cannot access another member's heart-rate data.");
      }
      return prisma.hrWorkoutSession.update({
        where: { id: existing.id },
        data,
      });
    }
  }
  return prisma.hrWorkoutSession.create({
    data: { userId, ...data },
  });
}

export async function listWorkoutHrForUser(userId: string) {
  return prisma.hrWorkoutSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getWorkoutHrForUser(sessionId: string, userId: string) {
  const row = await prisma.hrWorkoutSession.findUnique({ where: { id: sessionId } });
  return assertOwn(row, userId);
}

export async function getWorkoutHrForLoggedSession(workoutSessionId: string, userId: string) {
  const row = await prisma.hrWorkoutSession.findFirst({
    where: { workoutSessionId, userId },
    orderBy: { startedAt: "desc" },
  });
  return row;
}

export async function deleteWorkoutHrForUser(sessionId: string, userId: string) {
  await getWorkoutHrForUser(sessionId, userId);
  await prisma.hrWorkoutSession.delete({ where: { id: sessionId } });
}

export type HrSamplePoint = { at: Date; bpm: number };

export function zoneIndexForBpm(bpm: number, maxHr = DEFAULT_HR_MAX) {
  const pct = bpm / Math.max(maxHr, 1);
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

export function zonesFromSamples(samples: HrSamplePoint[], maxHr = DEFAULT_HR_MAX) {
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (samples.length === 0) {
    return { zone1Seconds: 0, zone2Seconds: 0, zone3Seconds: 0, zone4Seconds: 0, zone5Seconds: 0 };
  }
  const ordered = [...samples].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    let seconds = 1;
    if (next) {
      seconds = Math.round((next.at.getTime() - current.at.getTime()) / 1000);
    } else if (i > 0) {
      seconds = Math.round((current.at.getTime() - ordered[i - 1].at.getTime()) / 1000);
    }
    seconds = Math.min(300, Math.max(1, seconds));
    const zone = zoneIndexForBpm(current.bpm, maxHr);
    zones[zone - 1] += seconds;
  }
  return {
    zone1Seconds: zones[0],
    zone2Seconds: zones[1],
    zone3Seconds: zones[2],
    zone4Seconds: zones[3],
    zone5Seconds: zones[4],
  };
}

export function zonePercents(input: {
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
}) {
  const total =
    input.zone1Seconds +
    input.zone2Seconds +
    input.zone3Seconds +
    input.zone4Seconds +
    input.zone5Seconds;
  const pct = (seconds: number) => (total === 0 ? 0 : Math.round((seconds / total) * 100));
  return {
    totalSeconds: total,
    zone1: pct(input.zone1Seconds),
    zone2: pct(input.zone2Seconds),
    zone3: pct(input.zone3Seconds),
    zone4: pct(input.zone4Seconds),
    zone5: pct(input.zone5Seconds),
  };
}

export type HeartAnalysis = {
  rhr7: number | null;
  rhr30: number | null;
  rhrTrend: "down" | "up" | "steady" | "empty";
  latestRhr: { bpm: number; recordedAt: Date; source: string } | null;
  lastWorkout: {
    startedAt: Date;
    avgBpm: number;
    maxBpm: number;
    source: string;
    zones: ReturnType<typeof zonePercents>;
  } | null;
  weeklyZones: ReturnType<typeof zonePercents> & {
    zone1Seconds: number;
    zone2Seconds: number;
    zone3Seconds: number;
    zone4Seconds: number;
    zone5Seconds: number;
  };
  insights: string[];
  disclaimer: string;
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function analyzeHeartRate(
  input: {
    resting: { bpm: number; recordedAt: Date; source: string }[];
    workouts: {
      startedAt: Date;
      avgBpm: number;
      maxBpm: number;
      source: string;
      zone1Seconds: number;
      zone2Seconds: number;
      zone3Seconds: number;
      zone4Seconds: number;
      zone5Seconds: number;
    }[];
  },
  now = new Date(),
): HeartAnalysis {
  const dayMs = 24 * 60 * 60 * 1000;
  const inWindow = (date: Date, days: number) => now.getTime() - date.getTime() <= days * dayMs && date <= now;
  const rhr7 = average(input.resting.filter((row) => inWindow(row.recordedAt, 7)).map((row) => row.bpm));
  const rhr30 = average(input.resting.filter((row) => inWindow(row.recordedAt, 30)).map((row) => row.bpm));
  let rhrTrend: HeartAnalysis["rhrTrend"] = "empty";
  if (rhr7 !== null && rhr30 !== null) {
    if (rhr7 <= rhr30 - 2) rhrTrend = "down";
    else if (rhr7 >= rhr30 + 2) rhrTrend = "up";
    else rhrTrend = "steady";
  }
  const latestRhr = [...input.resting].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0] ?? null;
  const lastWorkoutRow = [...input.workouts].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
  const weekly = input.workouts.filter((row) => inWindow(row.startedAt, 7));
  const weeklyTotals = weekly.reduce(
    (acc, row) => ({
      zone1Seconds: acc.zone1Seconds + row.zone1Seconds,
      zone2Seconds: acc.zone2Seconds + row.zone2Seconds,
      zone3Seconds: acc.zone3Seconds + row.zone3Seconds,
      zone4Seconds: acc.zone4Seconds + row.zone4Seconds,
      zone5Seconds: acc.zone5Seconds + row.zone5Seconds,
    }),
    { zone1Seconds: 0, zone2Seconds: 0, zone3Seconds: 0, zone4Seconds: 0, zone5Seconds: 0 },
  );
  const weeklyZones = { ...weeklyTotals, ...zonePercents(weeklyTotals) };
  const insights: string[] = [];
  if (rhrTrend === "down") {
    insights.push("Resting heart rate is trending down compared with the last 30 days.");
  } else if (rhrTrend === "up") {
    insights.push("Resting heart rate is trending up compared with the last 30 days.");
  } else if (rhrTrend === "steady") {
    insights.push("Resting heart rate is about steady versus the last 30 days.");
  }
  if (weeklyZones.totalSeconds > 0) {
    if (weeklyZones.zone4 + weeklyZones.zone5 >= 40) {
      insights.push("A lot of this week’s logged time is in higher heart-rate zones.");
    } else if (weeklyZones.zone1 + weeklyZones.zone2 >= 60) {
      insights.push("Most of this week’s logged time is in easier heart-rate zones.");
    } else {
      insights.push("This week’s logged time is mixed across heart-rate zones.");
    }
  }
  if (insights.length === 0) {
    insights.push("No heart-rate pattern yet. Add a resting sample or a workout to see a breakdown.");
  }
  return {
    rhr7,
    rhr30,
    rhrTrend,
    latestRhr,
    lastWorkout: lastWorkoutRow
      ? {
          startedAt: lastWorkoutRow.startedAt,
          avgBpm: lastWorkoutRow.avgBpm,
          maxBpm: lastWorkoutRow.maxBpm,
          source: lastWorkoutRow.source,
          zones: zonePercents(lastWorkoutRow),
        }
      : null,
    weeklyZones,
    insights,
    disclaimer: HR_NOT_MEDICAL_ADVICE,
  };
}

export async function getHeartAnalysisForUser(userId: string, now = new Date()) {
  const [resting, workouts] = await Promise.all([
    listRestingSamplesForUser(userId),
    listWorkoutHrForUser(userId),
  ]);
  return analyzeHeartRate({ resting, workouts }, now);
}

export async function getProgressHeartTiles(userId: string) {
  const [latestRhr, lastWorkout, bodyHr] = await Promise.all([
    prisma.hrRestingSample.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.hrWorkoutSession.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId, kind: "restingHr" },
      orderBy: { recordedAt: "desc" },
    }),
  ]);
  const rhr = latestRhr
    ? {
        value: `${latestRhr.bpm} bpm`,
        hint: hrSourceLabel(latestRhr.source),
        source: latestRhr.source,
      }
    : bodyHr
      ? {
          value: `${bodyHr.value} ${bodyHr.unit}`,
          hint: "Typed by you",
          source: "manual" as const,
        }
      : null;
  const workout = lastWorkout
    ? {
        value: `${lastWorkout.avgBpm} / ${lastWorkout.maxBpm} bpm`,
        hint: `Avg / max · ${hrSourceLabel(lastWorkout.source)}`,
        source: lastWorkout.source,
      }
    : null;
  return { rhr, lastWorkout: workout };
}

export function parseHeartExport(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError("HEART", "The file was empty.");
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseHealthJson(trimmed);
  }
  if (
    trimmed.includes("<HealthData") ||
    trimmed.includes("HKQuantityTypeIdentifier") ||
    trimmed.includes("<Workout")
  ) {
    return parseAppleHealthXml(trimmed);
  }
  return parseHeartCsv(trimmed);
}

export function parseHealthJson(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError("HEART", "That JSON was not valid Apple Health / Health Auto Export data.");
  }
  const resting: { bpm: number; recordedAt: Date; source: HrSource }[] = [];
  const workouts: WorkoutHrInput[] = [];
  const root = asJsonRecord(parsed);
  const data = asJsonRecord(root.data ?? parsed);
  const metrics = asJsonArray(data.metrics ?? root.metrics ?? (Array.isArray(parsed) ? parsed : []));
  const workoutRows = asJsonArray(data.workouts ?? root.workouts ?? data.workout ?? []);

  for (const metric of metrics) {
    const row = asJsonRecord(metric);
    const name = String(row.name ?? row.metric ?? row.type ?? "").toLowerCase();
    const isResting =
      name.includes("resting_heart") ||
      name.includes("resting-heart") ||
      name.includes("resting heart");
    if (!isResting) continue;
    for (const point of asJsonArray(row.data ?? row.values ?? [])) {
      const sample = asJsonRecord(point);
      const bpm = Number(sample.qty ?? sample.value ?? sample.bpm ?? sample.Avg ?? sample.avg);
      const recordedAt = parseFlexibleDate(
        String(sample.date ?? sample.start ?? sample.recordedAt ?? sample.startDate ?? ""),
      );
      if (bpm && recordedAt) {
        resting.push({ bpm, recordedAt, source: "apple_health" });
      }
    }
  }

  for (const item of workoutRows) {
    const workout = parseJsonWorkout(item);
    if (workout) workouts.push(workout);
  }

  if (resting.length === 0 && workouts.length === 0) {
    throw new AppError("HEART", "No resting HR or workout HR found in that Apple Health JSON.");
  }
  return { resting, workouts };
}

function parseJsonWorkout(raw: unknown): WorkoutHrInput | null {
  const row = asJsonRecord(raw);
  const startedAt = parseFlexibleDate(
    String(row.start ?? row.startDate ?? row.startedAt ?? row.start_time ?? ""),
  );
  const endedAt = parseFlexibleDate(
    String(row.end ?? row.endDate ?? row.endedAt ?? row.end_time ?? ""),
  );
  if (!startedAt) return null;
  const hr = asJsonRecord(row.heartRate ?? row.heart_rate ?? {});
  const samples = asJsonArray(row.heartRateData ?? row.heart_rate_data ?? row.samples ?? []);
  const points: HrSamplePoint[] = [];
  for (const sample of samples) {
    const point = asJsonRecord(sample);
    const at = parseFlexibleDate(String(point.date ?? point.start ?? point.timestamp ?? ""));
    const bpm = Number(point.Avg ?? point.avg ?? point.qty ?? point.value ?? point.bpm);
    if (at && bpm) points.push({ at, bpm });
  }
  let avgBpm = Number(
    hr.avg ?? hr.average ?? row.avgHeartRate ?? row.avgBpm ?? row.averageHeartRate ?? 0,
  );
  let maxBpm = Number(
    hr.max ?? hr.maximum ?? row.maxHeartRate ?? row.maxBpm ?? row.maximumHeartRate ?? 0,
  );
  let zones = {
    zone1Seconds: Number(row.zone1Seconds ?? 0),
    zone2Seconds: Number(row.zone2Seconds ?? 0),
    zone3Seconds: Number(row.zone3Seconds ?? 0),
    zone4Seconds: Number(row.zone4Seconds ?? 0),
    zone5Seconds: Number(row.zone5Seconds ?? 0),
  };
  if (points.length > 0) {
    const bpms = points.map((point) => point.bpm);
    if (!avgBpm) avgBpm = Math.round(bpms.reduce((sum, value) => sum + value, 0) / bpms.length);
    if (!maxBpm) maxBpm = Math.max(...bpms);
    zones = zonesFromSamples(points);
  }
  if (!avgBpm && !maxBpm) return null;
  const end = endedAt ?? (points.at(-1)?.at ?? new Date(startedAt.getTime() + 45 * 60 * 1000));
  return {
    startedAt,
    endedAt: end,
    avgBpm: avgBpm || maxBpm,
    maxBpm: maxBpm || avgBpm,
    source: "apple_watch_import",
    externalId: String(row.id ?? row.uuid ?? ""),
    ...zones,
  };
}

export function parseAppleHealthXml(text: string) {
  const resting: { bpm: number; recordedAt: Date; source: HrSource }[] = [];
  const workouts: WorkoutHrInput[] = [];
  const recordRe =
    /<Record\b([^>]*type="HKQuantityTypeIdentifierRestingHeartRate"[^>]*)\/?>/gi;
  let recordMatch: RegExpExecArray | null;
  while ((recordMatch = recordRe.exec(text))) {
    const attrs = recordMatch[1];
    const bpm = Number(xmlAttr(attrs, "value"));
    const recordedAt = parseFlexibleDate(xmlAttr(attrs, "startDate") || xmlAttr(attrs, "endDate"));
    if (bpm && recordedAt) {
      resting.push({ bpm, recordedAt, source: "apple_health" });
    }
  }

  const workoutRe = /<Workout\b([^>]*)>([\s\S]*?)<\/Workout>/gi;
  let workoutMatch: RegExpExecArray | null;
  while ((workoutMatch = workoutRe.exec(text))) {
    const attrs = workoutMatch[1];
    const body = workoutMatch[2];
    const startedAt = parseFlexibleDate(xmlAttr(attrs, "startDate"));
    const endedAt = parseFlexibleDate(xmlAttr(attrs, "endDate"));
    const stats = /<WorkoutStatistics\b([^>]*HeartRate[^>]*)\/?>/i.exec(body);
    const statAttrs = stats?.[1] ?? "";
    const avgBpm = Number(xmlAttr(statAttrs, "average") || xmlAttr(attrs, "average"));
    const maxBpm = Number(xmlAttr(statAttrs, "maximum") || xmlAttr(attrs, "maximum"));
    if (!startedAt || (!avgBpm && !maxBpm)) continue;
    workouts.push({
      startedAt,
      endedAt: endedAt ?? new Date(startedAt.getTime() + 45 * 60 * 1000),
      avgBpm: avgBpm || maxBpm,
      maxBpm: maxBpm || avgBpm,
      source: "apple_watch_import",
    });
  }

  if (resting.length === 0 && workouts.length === 0) {
    throw new AppError("HEART", "No resting HR or workout HR found in that Apple Health XML.");
  }
  return { resting, workouts };
}

function xmlAttr(attrs: string, name: string) {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(attrs);
  return match?.[1] ?? "";
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseHeartCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new AppError("HEART", "The CSV was empty.");
  }
  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const resting: { bpm: number; recordedAt: Date }[] = [];
  const workouts: WorkoutHrInput[] = [];
  const samples: HrSamplePoint[] = [];

  const startIndex = looksLikeHeader(header) ? 1 : 0;

  for (const line of lines.slice(startIndex)) {
    const cells = splitCsvLine(line);
    if (looksLikeHeader(cells.map((cell) => cell.toLowerCase()))) {
      continue;
    }
    const row = looksLikeHeader(header)
      ? Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]))
      : {};
    const type = (row.type || cells[0] || "").toLowerCase();
    const inferred =
      type === "resting" || type === "workout" || type === "sample"
        ? type
        : header.includes("resting heart rate (bpm)") ||
            header.includes("resting heart rate (count/min)") ||
            header.includes("restinghr")
          ? "resting"
          : header.includes("avgbpm") || header.includes("startedat")
            ? "workout"
            : header.includes("bpm")
              ? "sample"
              : "";

    if (inferred === "resting") {
      const bpm = Number(row.bpm || row["resting heart rate (bpm)"] || row.restinghr || cells[2] || cells[1]);
      const recordedAt = parseFlexibleDate(
        row.recordedat || row.date || row.timestamp || cells[1] || cells[0],
      );
      if (bpm && recordedAt) {
        resting.push({ bpm, recordedAt });
      }
      continue;
    }

    if (inferred === "workout") {
      const startedAt = parseFlexibleDate(row.startedat || row.start || cells[1]);
      const endedAt = parseFlexibleDate(row.endedat || row.end || cells[2]);
      if (!startedAt || !endedAt) continue;
      workouts.push({
        startedAt,
        endedAt,
        avgBpm: Number(row.avgbpm || cells[3]),
        maxBpm: Number(row.maxbpm || cells[4]),
        source: "apple_watch_import",
        zone1Seconds: Number(row.zone1seconds || cells[5] || 0),
        zone2Seconds: Number(row.zone2seconds || cells[6] || 0),
        zone3Seconds: Number(row.zone3seconds || cells[7] || 0),
        zone4Seconds: Number(row.zone4seconds || cells[8] || 0),
        zone5Seconds: Number(row.zone5seconds || cells[9] || 0),
      });
      continue;
    }

    if (inferred === "sample") {
      const at = parseFlexibleDate(row.timestamp || row.recordedat || row.date || cells[1] || cells[0]);
      const bpm = Number(row.bpm || cells[2] || cells[1]);
      if (at && bpm) {
        samples.push({ at, bpm });
      }
    }
  }

  if (samples.length > 0) {
    const ordered = [...samples].sort((a, b) => a.at.getTime() - b.at.getTime());
    const bpms = ordered.map((row) => row.bpm);
    const zones = zonesFromSamples(ordered);
    workouts.push({
      startedAt: ordered[0].at,
      endedAt: ordered[ordered.length - 1].at,
      avgBpm: Math.round(bpms.reduce((sum, value) => sum + value, 0) / bpms.length),
      maxBpm: Math.max(...bpms),
      source: "apple_watch_import",
      ...zones,
    });
  }

  if (resting.length === 0 && workouts.length === 0) {
    throw new AppError("HEART", "No resting or workout rows found in that CSV.");
  }

  return { resting, workouts };
}

export async function importHeartCsvForUser(userId: string, csv: string) {
  return importHeartExportForUser(userId, csv);
}

export async function importHeartExportForUser(userId: string, text: string) {
  const parsed = parseHeartExport(text);
  const created = { resting: 0, workouts: 0 };
  for (const row of parsed.resting) {
    await createRestingSampleForUser(userId, {
      bpm: row.bpm,
      recordedAt: row.recordedAt,
      source: "source" in row && typeof row.source === "string" ? row.source : "apple_health",
    });
    created.resting += 1;
  }
  for (const row of parsed.workouts) {
    await createWorkoutHrForUser(userId, {
      ...row,
      source: row.source || "apple_watch_import",
    });
    created.workouts += 1;
  }
  return created;
}

export async function loadDemoHeartDataForUser(userId: string, now = new Date()) {
  const existing = await prisma.hrRestingSample.count({ where: { userId, source: "demo" } });
  if (existing > 0) {
    return { created: false };
  }
  const resting = [62, 61, 60, 59, 58, 58, 57, 56];
  for (let i = 0; i < resting.length; i += 1) {
    const recordedAt = new Date(now.getTime() - (resting.length - 1 - i) * 24 * 60 * 60 * 1000);
    await createRestingSampleForUser(userId, {
      bpm: resting[i],
      recordedAt,
      source: "demo",
    });
  }
  await createWorkoutHrForUser(userId, {
    startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    endedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    avgBpm: 146,
    maxBpm: 176,
    source: "demo",
    zone1Seconds: 180,
    zone2Seconds: 420,
    zone3Seconds: 900,
    zone4Seconds: 720,
    zone5Seconds: 480,
  });
  await createWorkoutHrForUser(userId, {
    startedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    endedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000),
    avgBpm: 128,
    maxBpm: 152,
    source: "demo",
    zone1Seconds: 600,
    zone2Seconds: 900,
    zone3Seconds: 600,
    zone4Seconds: 180,
    zone5Seconds: 60,
  });
  return { created: true };
}

export async function syncPolarForUser(userId: string, fetchImpl?: PolarFetch) {
  if (!isPolarConfigured()) {
    throw new AppError("POLAR", "Polar AccessLink is not configured on this preview.");
  }
  const connection = await prisma.polarConnection.findUnique({ where: { userId } });
  if (!connection?.accessToken) {
    throw new AppError("POLAR", "Polar is not connected.");
  }
  try {
    const [exercises, nightly] = await Promise.all([
      fetchPolarExercises(connection.accessToken, fetchImpl),
      fetchPolarNightlyRecharge(connection.accessToken, fetchImpl),
    ]);
    let workouts = 0;
    let resting = 0;
    for (const exercise of exercises) {
      if (!exercise.avgBpm && !exercise.maxBpm) continue;
      const avg = exercise.avgBpm ?? exercise.maxBpm ?? 0;
      const max = exercise.maxBpm ?? avg;
      await createWorkoutHrForUser(userId, {
        startedAt: exercise.startTime,
        endedAt: exercise.endTime,
        avgBpm: avg,
        maxBpm: max,
        source: "polar",
        externalId: exercise.id,
        zone1Seconds: exercise.zones[0],
        zone2Seconds: exercise.zones[1],
        zone3Seconds: exercise.zones[2],
        zone4Seconds: exercise.zones[3],
        zone5Seconds: exercise.zones[4],
      });
      workouts += 1;
    }
    for (const night of nightly) {
      const already = await prisma.hrRestingSample.findFirst({
        where: {
          userId,
          source: "polar",
          recordedAt: night.date,
        },
      });
      if (already) continue;
      await createRestingSampleForUser(userId, {
        bpm: night.bpm,
        recordedAt: night.date,
        source: "polar",
      });
      resting += 1;
    }
    await prisma.polarConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date(), lastError: "" },
    });
    return { workouts, resting };
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "Polar sync was unavailable. Try again later.";
    await prisma.polarConnection.update({
      where: { userId },
      data: { lastError: message },
    });
    throw error instanceof AppError ? error : new AppError("POLAR", message);
  }
}

export async function disconnectPolarConnectionForUser(userId: string) {
  await disconnectPolarForUser(userId);
}

function looksLikeHeader(header: string[]) {
  return header.some((cell) =>
    [
      "type",
      "bpm",
      "date",
      "timestamp",
      "startedat",
      "resting heart rate (bpm)",
      "resting heart rate (count/min)",
      "avgbpm",
    ].includes(cell),
  );
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseFlexibleDate(raw: string) {
  const value = raw.trim();
  if (!value || value.toLowerCase() === "date" || value.toLowerCase() === "type") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
