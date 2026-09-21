import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { startOfLocalDay, endOfLocalDay } from "@/lib/nutrition";

export const DEFAULT_REMINDER_HOUR = 18;

export type ReminderKind = "workout" | "food";

export type ReminderPrefsInput = {
  workoutEnabled: boolean;
  foodEnabled: boolean;
  preferredHour: number;
  timezoneOffsetMinutes: number;
};

export function isSmtpReminderDeliveryEnabled() {
  return isSmtpConfigured();
}

export function localParts(now: Date, timezoneOffsetMinutes: number) {
  const local = new Date(now.getTime() - timezoneOffsetMinutes * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    date: local.getUTCDate(),
    hour: local.getUTCHours(),
  };
}

export function sameLocalDay(
  value: Date | null | undefined,
  now: Date,
  timezoneOffsetMinutes: number,
) {
  if (!value) return false;
  const a = localParts(value, timezoneOffsetMinutes);
  const b = localParts(now, timezoneOffsetMinutes);
  return a.year === b.year && a.month === b.month && a.date === b.date;
}

export function validateReminderPrefs(input: ReminderPrefsInput): ReminderPrefsInput {
  const hour = Number(input.preferredHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new AppError("REMINDER", "Pick an hour between 0 and 23.");
  }
  const offset = Number(input.timezoneOffsetMinutes);
  if (!Number.isFinite(offset) || Math.abs(offset) > 14 * 60) {
    throw new AppError("REMINDER", "Time zone offset looks invalid.");
  }
  return {
    workoutEnabled: Boolean(input.workoutEnabled),
    foodEnabled: Boolean(input.foodEnabled),
    preferredHour: hour,
    timezoneOffsetMinutes: Math.round(offset),
  };
}

export async function getOrCreateReminderPrefs(userId: string) {
  const existing = await prisma.reminderPrefs.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  return prisma.reminderPrefs.create({
    data: {
      userId,
      workoutEnabled: true,
      foodEnabled: true,
      preferredHour: DEFAULT_REMINDER_HOUR,
      timezoneOffsetMinutes: 0,
    },
  });
}

export async function saveReminderPrefs(userId: string, input: ReminderPrefsInput) {
  const data = validateReminderPrefs(input);
  return prisma.reminderPrefs.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

async function loggedWorkoutToday(userId: string, now: Date) {
  const count = await prisma.workoutSession.count({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: startOfLocalDay(now), lt: endOfLocalDay(now) },
    },
  });
  return count > 0;
}

async function loggedFoodToday(userId: string, now: Date) {
  const count = await prisma.nutritionEntry.count({
    where: {
      userId,
      eatenAt: { gte: startOfLocalDay(now), lt: endOfLocalDay(now) },
    },
  });
  return count > 0;
}

export type DueReminder = {
  kind: ReminderKind;
  message: string;
};

export async function getDueReminders(
  userId: string,
  now = new Date(),
): Promise<DueReminder[]> {
  const prefs = await getOrCreateReminderPrefs(userId);
  const local = localParts(now, prefs.timezoneOffsetMinutes);
  if (local.hour < prefs.preferredHour) {
    return [];
  }

  const due: DueReminder[] = [];
  if (
    prefs.workoutEnabled &&
    !sameLocalDay(prefs.lastWorkoutRemindedAt, now, prefs.timezoneOffsetMinutes) &&
    !(await loggedWorkoutToday(userId, now))
  ) {
    due.push({
      kind: "workout",
      message: "Reminder: log a session if you trained today. Easy to skip if you already did.",
    });
  }
  if (
    prefs.foodEnabled &&
    !sameLocalDay(prefs.lastFoodRemindedAt, now, prefs.timezoneOffsetMinutes) &&
    !(await loggedFoodToday(userId, now))
  ) {
    due.push({
      kind: "food",
      message: "Reminder: add a food estimate when you have a minute. Estimates are fine.",
    });
  }
  return due;
}

export async function markRemindersShown(
  userId: string,
  kinds: ReminderKind[],
  now = new Date(),
) {
  if (kinds.length === 0) {
    return;
  }
  const prefs = await getOrCreateReminderPrefs(userId);
  await prisma.reminderPrefs.update({
    where: { userId },
    data: {
      lastWorkoutRemindedAt: kinds.includes("workout")
        ? now
        : prefs.lastWorkoutRemindedAt,
      lastFoodRemindedAt: kinds.includes("food") ? now : prefs.lastFoodRemindedAt,
    },
  });
  await recordMetric(METRIC_NAMES.reminderShown, userId);
}

/**
 * Show due reminders on Home. Email only if SMTP is configured.
 * Marks the local day as reminded so we do not spam.
 */
export async function processDueRemindersForUser(
  userId: string,
  email: string,
  now = new Date(),
) {
  const due = await getDueReminders(userId, now);
  if (due.length === 0) {
    return { due, emailed: false, smtpConfigured: isSmtpReminderDeliveryEnabled() };
  }

  let emailed = false;
  if (isSmtpReminderDeliveryEnabled()) {
    const result = await sendMail({
      to: email,
      subject: "SVG Performance reminder",
      text: [
        "A gentle reminder from SVG Performance (not a coach texting you):",
        ...due.map((item) => `- ${item.message}`),
        "",
        "Turn these off any time under Profile → Reminders.",
      ].join("\n"),
    });
    emailed = result.sent;
  }

  await markRemindersShown(
    userId,
    due.map((item) => item.kind),
    now,
  );
  return { due, emailed, smtpConfigured: isSmtpReminderDeliveryEnabled() };
}
