import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { mondayOfZoned, addZonedDays, dayKey } from "@/lib/timezone";

export type SparringLog = {
  dateKey: string;
  weekday: string;
  rounds: number;
  minutesPerRound: number;
  intensity: string;
  notes: string;
};

const INTENSITIES = new Set(["", "easy", "moderate", "hard"]);

export function sparringMinutes(log: { rounds: number; minutesPerRound: number }) {
  return log.rounds * log.minutesPerRound;
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
  },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) {
    throw new AppError("LOG", "Pick a valid day.");
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
    },
    update: {
      weekday: input.weekday,
      rounds: input.rounds,
      minutesPerRound: input.minutesPerRound,
      intensity,
      notes,
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
  const logs = rows.map(toLog);
  return {
    logs,
    rounds: logs.reduce((sum, log) => sum + log.rounds, 0),
    minutes: logs.reduce((sum, log) => sum + sparringMinutes(log), 0),
  };
}

function toLog(row: {
  dateKey: string;
  weekday: string;
  rounds: number;
  minutesPerRound: number;
  intensity: string;
  notes: string;
}): SparringLog {
  return {
    dateKey: row.dateKey,
    weekday: row.weekday,
    rounds: row.rounds,
    minutesPerRound: row.minutesPerRound,
    intensity: row.intensity,
    notes: row.notes,
  };
}
