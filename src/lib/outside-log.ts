import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { mondayOfZoned, addZonedDays, dayKey, APP_TIMEZONE } from "@/lib/timezone";

export const SORE_SPOTS = [
  "head",
  "neck",
  "ribs",
  "shins",
  "hands",
  "knees",
  "shoulders",
  "other",
] as const;

export type SoreSpot = (typeof SORE_SPOTS)[number];

export const SORE_SPOT_LABELS: Record<SoreSpot, string> = {
  head: "Head",
  neck: "Neck",
  ribs: "Ribs",
  shins: "Shins",
  hands: "Hands",
  knees: "Knees",
  shoulders: "Shoulders",
  other: "Other",
};

export type SparringLog = {
  dateKey: string;
  weekday: string;
  rounds: number;
  minutesPerRound: number;
  intensity: string;
  notes: string;
  sessionRating: number | null;
  bodyRating: number | null;
  soreSpots: SoreSpot[];
  coachCheckIn: string;
};

const INTENSITIES = new Set(["", "easy", "moderate", "hard"]);

export function sparringMinutes(log: { rounds: number; minutesPerRound: number }) {
  return log.rounds * log.minutesPerRound;
}

export function isSoreSpot(value: string): value is SoreSpot {
  return (SORE_SPOTS as readonly string[]).includes(value);
}

export function parseSoreSpots(value: unknown): SoreSpot[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? safeJsonArray(value)
      : [];
  const spots: SoreSpot[] = [];
  for (const item of raw) {
    const spot = String(item).trim().toLowerCase();
    if (isSoreSpot(spot) && !spots.includes(spot)) spots.push(spot);
  }
  return spots;
}

function safeJsonArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ratingInRange(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Future civil days stay closed. Today and earlier can be logged on any gym-day type. */
export function sparringDateError(dateKey: string, now = new Date(), timeZone = APP_TIMEZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "Pick a valid day.";
  if (dateKey > dayKey(now, timeZone)) {
    return "You can log sparring through today. Future days stay closed.";
  }
  return null;
}

/** Body at 2 or below, or a tapped head, means the next day should be easier. */
export function sparringNeedsEase(log: {
  bodyRating: number | null;
  soreSpots: readonly string[];
}) {
  if (log.bodyRating != null && log.bodyRating <= 2) return true;
  return log.soreSpots.includes("head");
}

export async function getSparringLog(userId: string, dateKey: string) {
  const row = await prisma.outsideSessionLog.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
  });
  return row ? toLog(row) : null;
}

export async function saveSparringLog(
  userId: string,
  input: {
    dateKey: string;
    weekday: string;
    rounds: number;
    minutesPerRound: number;
    intensity?: string;
    notes?: string;
    sessionRating: number;
    bodyRating: number;
    soreSpots?: string[];
    now?: Date;
    timeZone?: string;
  },
) {
  const dateError = sparringDateError(input.dateKey, input.now ?? new Date(), input.timeZone ?? APP_TIMEZONE);
  if (dateError) {
    throw new AppError("LOG", dateError);
  }
  if (!Number.isInteger(input.rounds) || input.rounds < 1 || input.rounds > 30) {
    throw new AppError("LOG", "Rounds should be between 1 and 30.");
  }
  if (
    !Number.isInteger(input.minutesPerRound) ||
    input.minutesPerRound < 1 ||
    input.minutesPerRound > 15
  ) {
    throw new AppError("LOG", "Minutes per round should be between 1 and 15.");
  }
  const intensity = (input.intensity ?? "").trim().toLowerCase();
  if (!INTENSITIES.has(intensity)) {
    throw new AppError("LOG", "Intensity should be easy, moderate, hard, or blank.");
  }
  if (!ratingInRange(input.sessionRating)) {
    throw new AppError("LOG", "Session rating should be from 1 to 5.");
  }
  if (!ratingInRange(input.bodyRating)) {
    throw new AppError("LOG", "Body rating should be from 1 to 5.");
  }
  const soreSpots = parseSoreSpots(input.soreSpots ?? []);
  const notes = (input.notes ?? "").trim().slice(0, 400);
  const row = await prisma.outsideSessionLog.upsert({
    where: { userId_dateKey: { userId, dateKey: input.dateKey } },
    create: {
      userId,
      dateKey: input.dateKey,
      weekday: input.weekday,
      rounds: input.rounds,
      minutesPerRound: input.minutesPerRound,
      intensity,
      notes,
      sessionRating: input.sessionRating,
      bodyRating: input.bodyRating,
      soreSpots: JSON.stringify(soreSpots),
      coachCheckIn: "",
    },
    update: {
      weekday: input.weekday,
      rounds: input.rounds,
      minutesPerRound: input.minutesPerRound,
      intensity,
      notes,
      sessionRating: input.sessionRating,
      bodyRating: input.bodyRating,
      soreSpots: JSON.stringify(soreSpots),
      coachCheckIn: "",
    },
  });
  return toLog(row);
}

export async function sparringLogsForWeek(userId: string, anchor: Date, timeZone: string) {
  const monday = mondayOfZoned(anchor, timeZone);
  const keys = Array.from({ length: 7 }, (_, index) => dayKey(addZonedDays(monday, index, timeZone), timeZone));
  const rows = await prisma.outsideSessionLog.findMany({
    where: { userId, dateKey: { in: keys } },
    orderBy: { dateKey: "asc" },
  });
  const today = dayKey(anchor, timeZone);
  return sparringWeekTotals(rows.map(toLog), today);
}

export function sparringWeekTotals<T extends { dateKey: string; rounds: number; minutesPerRound: number }>(
  logs: T[],
  today: string,
) {
  const counted = logs.filter((log) => log.dateKey <= today);
  return {
    logs: counted,
    rounds: counted.reduce((sum, log) => sum + log.rounds, 0),
    minutes: counted.reduce((sum, log) => sum + sparringMinutes(log), 0),
  };
}

/** Most recent saved ratings, if the member has logged one. */
export async function latestSparringRatings(userId: string) {
  const row = await prisma.outsideSessionLog.findFirst({
    where: {
      userId,
      OR: [{ sessionRating: { not: null } }, { bodyRating: { not: null } }],
    },
    orderBy: { dateKey: "desc" },
    select: { sessionRating: true, bodyRating: true, dateKey: true },
  });
  if (!row) return null;
  return { sessionRating: row.sessionRating, bodyRating: row.bodyRating };
}

/** Most recent saved session rating, if the member has logged one. */
export async function latestSparringSessionRating(userId: string) {
  const ratings = await latestSparringRatings(userId);
  return ratings?.sessionRating ?? null;
}

/** Oldest to newest, so a trend reads left to right. */
export async function sparringTrend(userId: string, take = 8) {
  const rows = await prisma.outsideSessionLog.findMany({
    where: { userId },
    orderBy: { dateKey: "desc" },
    take,
  });
  return rows.map(toLog).reverse();
}

function toLog(row: {
  dateKey: string;
  weekday: string;
  rounds: number;
  minutesPerRound: number;
  intensity: string;
  notes: string;
  sessionRating?: number | null;
  bodyRating?: number | null;
  soreSpots?: string | null;
  coachCheckIn?: string | null;
}): SparringLog {
  return {
    dateKey: row.dateKey,
    weekday: row.weekday,
    rounds: row.rounds,
    minutesPerRound: row.minutesPerRound,
    intensity: row.intensity,
    notes: row.notes,
    sessionRating: row.sessionRating ?? null,
    bodyRating: row.bodyRating ?? null,
    soreSpots: parseSoreSpots(row.soreSpots ?? "[]"),
    coachCheckIn: row.coachCheckIn ?? "",
  };
}
