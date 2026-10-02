import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { isSmtpConfigured, reminderEmailHtml, sendMail } from "@/lib/mail";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { startOfLocalDay, endOfLocalDay } from "@/lib/nutrition";
import { canUseFeature } from "@/lib/entitlements";
import { quoteForLocalDate } from "@/lib/quotes";
import { timeZoneForUser } from "@/lib/profile";

export const DEFAULT_REMINDER_HOUR = 18;

export type ReminderKind = "workout" | "food" | "quote" | "booking";

export type ReminderPrefsInput = {
  workoutEnabled: boolean;
  foodEnabled: boolean;
  quoteEnabled?: boolean;
  bookingEnabled?: boolean;
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
    quoteEnabled: input.quoteEnabled !== false,
    bookingEnabled: input.bookingEnabled !== false,
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
      quoteEnabled: true,
      bookingEnabled: true,
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

async function loggedWorkoutToday(userId: string, now: Date, timeZone: string) {
  const count = await prisma.workoutSession.count({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: startOfLocalDay(now, timeZone), lt: endOfLocalDay(now, timeZone) },
    },
  });
  return count > 0;
}

async function loggedFoodToday(userId: string, now: Date, timeZone: string) {
  const count = await prisma.nutritionEntry.count({
    where: {
      userId,
      eatenAt: { gte: startOfLocalDay(now, timeZone), lt: endOfLocalDay(now, timeZone) },
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
  const tz = await timeZoneForUser(userId);
  const local = localParts(now, prefs.timezoneOffsetMinutes);
  if (local.hour < prefs.preferredHour) {
    return [];
  }

  const due: DueReminder[] = [];
  if (
    prefs.workoutEnabled &&
    !sameLocalDay(prefs.lastWorkoutRemindedAt, now, prefs.timezoneOffsetMinutes) &&
    !(await loggedWorkoutToday(userId, now, tz))
  ) {
    due.push({
      kind: "workout",
      message: "Reminder: log a session if you trained today. Easy to skip if you already did.",
    });
  }
  if (
    prefs.foodEnabled &&
    !sameLocalDay(prefs.lastFoodRemindedAt, now, prefs.timezoneOffsetMinutes) &&
    !(await loggedFoodToday(userId, now, tz))
  ) {
    due.push({
      kind: "food",
      message: "Reminder: add a food estimate when you have a minute. Estimates are fine.",
    });
  }
  if (
    prefs.quoteEnabled &&
    (await canUseFeature(userId, "daily_quote")) &&
    !sameLocalDay(prefs.lastQuoteRemindedAt, now, prefs.timezoneOffsetMinutes)
  ) {
    const quote = quoteForLocalDate(now, tz);
    due.push({
      kind: "quote",
      message: `Today’s quote: “${quote.text}”`,
    });
  }
  if (
    prefs.bookingEnabled &&
    !sameLocalDay(prefs.lastBookingRemindedAt, now, prefs.timezoneOffsetMinutes)
  ) {
    const open = await prisma.bookingRequest.count({
      where: { userId, status: { in: ["open", "seen"] } },
    });
    if (open > 0) {
      due.push({
        kind: "booking",
        message:
          "Reminder: you have an open Book with Ricky request. Preferred times are on file. This is not a confirmed slot.",
      });
    }
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
      lastQuoteRemindedAt: kinds.includes("quote") ? now : prefs.lastQuoteRemindedAt,
      lastBookingRemindedAt: kinds.includes("booking") ? now : prefs.lastBookingRemindedAt,
    },
  });
  await recordMetric(METRIC_NAMES.reminderShown, userId);
}

export const PERFORMANCE_APP_ORIGIN = "https://svg-performance.vercel.app";

const REMINDER_FOOTER = "Turn these off any time under Profile → Reminders.";
const REMINDER_HONESTY =
  "Automated reminder from SVG Performance. A coach is not texting you.";

const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  workout: "Workout",
  food: "Fuel",
  quote: "Quote",
  booking: "Book",
};

/** Public app origin for reminder links. Localhost is kept outside production. */
export function performanceAppOrigin() {
  const raw = process.env.APP_URL?.trim() ?? "";
  if (!raw) return PERFORMANCE_APP_ORIGIN;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (process.env.NODE_ENV === "production" && (local || url.protocol !== "https:")) {
      return PERFORMANCE_APP_ORIGIN;
    }
    return url.origin;
  } catch {
    return PERFORMANCE_APP_ORIGIN;
  }
}

function singleKind(kinds: ReminderKind[]): ReminderKind | null {
  if (kinds.length !== 1) return null;
  return kinds[0] ?? null;
}

function reminderSubject(kinds: ReminderKind[]) {
  switch (singleKind(kinds)) {
    case "workout":
      return "Log the session";
    case "food":
      return "Fuel the day";
    case "quote":
      return "Today's line";
    case "booking":
      return "Book with Ricky";
    default:
      return "Today's callouts";
  }
}

function reminderHeadline(kinds: ReminderKind[]) {
  switch (singleKind(kinds)) {
    case "workout":
      return "Show up for it";
    case "food":
      return "Fuel the day";
    case "quote":
      return "Read it. Then work.";
    case "booking":
      return "Your request is open";
    default:
      return "Today's callouts";
  }
}

function reminderIntro(kinds: ReminderKind[]) {
  switch (singleKind(kinds)) {
    case "workout":
      return `${REMINDER_HONESTY} You chose this session. Show up for it, then log the work in the app.`;
    case "food":
      return `${REMINDER_HONESTY} Fuel is part of the day you committed to. Log it in the app.`;
    case "quote":
      return `${REMINDER_HONESTY} Take the line, then open the app and do the work you said you would.`;
    case "booking":
      return `${REMINDER_HONESTY} You asked to book with Ricky. That request is still open. Preferred times are on file. This is not a confirmed slot.`;
    default:
      return `${REMINDER_HONESTY} Show up for the session you chose, log the work, and fuel the day. What is still open is below.`;
  }
}

function reminderPreheader(kinds: ReminderKind[]) {
  switch (singleKind(kinds)) {
    case "workout":
      return "Automated SVG Performance reminder. Show up and log the session.";
    case "food":
      return "Automated SVG Performance reminder. Fuel the day you committed to.";
    case "quote":
      return "Automated SVG Performance reminder. Read the line, then do the work.";
    case "booking":
      return "Automated SVG Performance reminder. Your Book with Ricky request is still open.";
    default:
      return "Automated SVG Performance reminder. Show up, log it, fuel the day.";
  }
}

function reminderCta(kinds: ReminderKind[]) {
  switch (singleKind(kinds)) {
    case "workout":
      return { label: "Open Train", path: "/training" };
    case "food":
      return { label: "Open Fuel", path: "/nutrition" };
    case "booking":
      return { label: "Open Book", path: "/book" };
    default:
      return { label: "Open Home", path: "/home" };
  }
}

export function buildReminderEmail(due: DueReminder[], origin = performanceAppOrigin()) {
  const kinds = due.map((item) => item.kind);
  const subject = reminderSubject(kinds);
  const headline = reminderHeadline(kinds);
  const intro = reminderIntro(kinds);
  const cta = reminderCta(kinds);
  const base = origin.replace(/\/$/, "");
  const href = `${base}${cta.path}`;
  const text = [
    "CONQUER THE DAY",
    "SVG PERFORMANCE",
    headline.toUpperCase(),
    "",
    intro,
    "",
    ...due.flatMap((item) => [
      REMINDER_KIND_LABEL[item.kind].toUpperCase(),
      item.message,
      "",
    ]),
    `${cta.label}:`,
    href,
    "",
    REMINDER_FOOTER,
    `${base}/profile`,
  ].join("\n");
  const html = reminderEmailHtml({
    eyebrow: "Conquer the day",
    headline,
    intro,
    items: due.map((item) => ({
      label: REMINDER_KIND_LABEL[item.kind],
      message: item.message,
    })),
    ctaLabel: cta.label,
    ctaHref: href,
    profileHref: `${base}/profile`,
    footer: REMINDER_FOOTER,
    preheader: reminderPreheader(kinds),
  });
  return { subject, text, html };
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
    const mail = buildReminderEmail(due);
    const result = await sendMail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
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
