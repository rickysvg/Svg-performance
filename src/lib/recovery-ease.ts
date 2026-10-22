import { easyBikeProgramDayNumber } from "@/lib/bike-sessions";
import { canUseFeature } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { resolveAiCoach, type AiCoachId } from "@/lib/coaches";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { sparringNeedsEase, type SparringLog } from "@/lib/outside-log";
import { addZonedDays, dayKey, zonedCivilToUtc } from "@/lib/timezone";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import {
  easyCardioSlot,
  planForDate,
  type DayPlan,
  type PlanSessionSlot,
  type PlannerPrefs,
} from "@/lib/week-plan";

export type EaseKind = "mobility" | "lighter" | "already-light" | "sparring-light";

export type RecoveryCheckIn = {
  name: string;
  image: string;
  message: string;
};

const LIGHT_MOBILITY: PlanSessionSlot = {
  kind: "mobility",
  label: "Mobility — light",
  title: "Mobility — light",
  detail: "Easy range for whatever is sore. No hard effort.",
  href: "/mobility/cooldown",
  heavy: false,
};

export function recoveryEaseReason(log: {
  bodyRating: number | null;
  soreSpots: readonly string[];
}) {
  const parts: string[] = [];
  if (log.bodyRating != null && log.bodyRating <= 2) {
    parts.push(`body rating ${log.bodyRating} out of 5`);
  }
  if (log.soreSpots.includes("head")) {
    parts.push("head marked sore");
  }
  return `Eased from yesterday's sparring (${parts.join(", ")}).`;
}

function isHeavy(session: PlanSessionSlot) {
  return Boolean(session.heavy) || session.kind === "strength";
}

/** Half the printed set count. One set stays one set. */
export function halvedSetCount(sets: number) {
  const safe = Number.isFinite(sets) ? Math.max(0, Math.round(sets)) : 0;
  if (safe <= 1) return safe;
  return Math.max(1, Math.round(safe / 2));
}

function lighten(session: PlanSessionSlot): PlanSessionSlot {
  if (session.kind === "rest" || session.kind === "mobility") return session;
  const title = session.title ?? session.label;
  const keepsDay = Boolean(session.programSlug && session.dayNumber != null);
  return {
    kind: session.kind,
    label: `Light · ${session.label}`,
    title: title.startsWith("Light") ? title : `Light · ${title}`,
    detail: "Cut the work in half. Easy pace. No max efforts.",
    ...(keepsDay
      ? { programSlug: session.programSlug, dayNumber: session.dayNumber, halved: true }
      : { href: "/timer" }),
    heavy: false,
    optional: true,
  };
}

/** Easy cardiac and a plain timer row are already light. A programmed bike day stays a logger. */
function isAlreadyLight(session: PlanSessionSlot) {
  if (session.kind === "mobility" || session.kind === "rest") return true;
  if (
    !session.heavy &&
    session.programSlug &&
    session.dayNumber === easyBikeProgramDayNumber()
  ) {
    return true;
  }
  return session.href === "/timer" && !session.programSlug;
}

/**
 * Swap a heavy day to mobility and easy cardio.
 * A lighter day keeps the idea of the session and cuts the work.
 */
export function easeDayPlan(plan: DayPlan, reason: string): { plan: DayPlan; easedTo: EaseKind } {
  const noted = (next: Omit<DayPlan, "easeNote">, easedTo: EaseKind) => ({
    plan: { ...next, easeNote: reason } as DayPlan,
    easedTo,
  });

  if (plan.outside?.kind === "sparring") {
    return noted(
      {
        ...plan,
        dayNote: [plan.dayNote, `${reason} Keep the rounds light if you still spar.`]
          .filter(Boolean)
          .join(" "),
      },
      "sparring-light",
    );
  }

  const trainable = plan.sessions.filter((session) => session.kind !== "rest");
  if (!plan.active || trainable.length === 0) {
    return noted(plan, "already-light");
  }

  if (trainable.some(isHeavy)) {
    return noted(
      {
        ...plan,
        active: true,
        summary: "Mobility+Cardio",
        sessions: [LIGHT_MOBILITY, easyCardioSlot()],
        skipReason: undefined,
      },
      "mobility",
    );
  }

  const alreadyEasy = trainable.every(isAlreadyLight);
  if (alreadyEasy && trainable.every((session) => !session.heavy)) {
    return noted(plan, "already-light");
  }

  return noted(
    {
      ...plan,
      active: true,
      summary: plan.summary.startsWith("Light") ? plan.summary : `Light ${plan.summary}`,
      sessions: plan.sessions.map(lighten),
    },
    "lighter",
  );
}

export function recoveryCheckInCopy(input: {
  coachId: string;
  bodyRating: number | null;
  head: boolean;
  nextWeekday: string;
  easedTo: EaseKind;
}) {
  const coach = resolveAiCoach(input.coachId);
  const why =
    input.bodyRating != null && input.bodyRating <= 2 && input.head
      ? `your body is at ${input.bodyRating} out of 5 and you marked your head`
      : input.head
        ? "you marked your head"
        : `your body is at ${input.bodyRating ?? 1} out of 5`;
  const change =
    input.easedTo === "mobility"
      ? `I swapped ${input.nextWeekday} to mobility and easy cardio.`
      : input.easedTo === "lighter"
        ? `I cut the work on ${input.nextWeekday} in half and kept the pace easy.`
        : input.easedTo === "sparring-light"
          ? `${input.nextWeekday} is sparring. Keep the rounds light.`
          : `${input.nextWeekday} was already light. Leave it there.`;
  const care = input.head
    ? " If you have a headache, dizziness, or nausea, stop training and talk to a coach or a doctor."
    : "";
  const sign: Record<AiCoachId, string> = {
    skye: " Keep the pace honest.",
    maya: " Stay on that detail.",
    mateo: " Do it clean.",
    cole: " I'm with you.",
    ricky: " No fluff.",
  };
  return `${coach.name}: You logged sparring and ${why}. ${change}${care}${sign[coach.id]}`;
}

function instantForDateKey(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return zonedCivilToUtc(year, month, day, timeZone);
}

async function plannerForUser(userId: string) {
  const [profile, swaps, account] = await Promise.all([
    getProfileForUser(userId),
    getWeekPlanSwapsForUser(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const prefs: PlannerPrefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
  };
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  return { profile, prefs, swaps, tz };
}

export async function writeRecoveryCheckIn(userId: string, log: SparringLog) {
  // RIR auto-adjust and the coach's recovery check-in are Pro.
  if (!(await canUseFeature(userId, "rir_auto"))) return null;
  const { profile, prefs, swaps, tz } = await plannerForUser(userId);
  const coach = resolveAiCoach(profile?.aiCoachId);
  if (!sparringNeedsEase(log)) {
    if (log.coachCheckIn) {
      await prisma.outsideSessionLog.update({
        where: { userId_dateKey: { userId, dateKey: log.dateKey } },
        data: { coachCheckIn: "" },
      });
    }
    return null;
  }
  const nextDate = addZonedDays(instantForDateKey(log.dateKey, tz), 1, tz);
  const nextPlan = planForDate(prefs, nextDate, tz, swaps);
  const eased = easeDayPlan(nextPlan, recoveryEaseReason(log));
  const message = recoveryCheckInCopy({
    coachId: coach.id,
    bodyRating: log.bodyRating,
    head: log.soreSpots.includes("head"),
    nextWeekday: eased.plan.weekday,
    easedTo: eased.easedTo,
  });
  await prisma.outsideSessionLog.update({
    where: { userId_dateKey: { userId, dateKey: log.dateKey } },
    data: { coachCheckIn: message },
  });
  return {
    message,
    coachName: coach.name,
    coachImage: coach.circle,
    easeNote: eased.plan.easeNote ?? recoveryEaseReason(log),
    nextWeekday: eased.plan.weekday,
  };
}

export async function easePlanForUser(
  userId: string,
  date: Date,
  timeZone: string,
  plan: DayPlan,
): Promise<{ plan: DayPlan; checkIn: RecoveryCheckIn | null }> {
  if (!(await canUseFeature(userId, "rir_auto"))) {
    return { plan, checkIn: null };
  }
  const previousKey = dayKey(addZonedDays(date, -1, timeZone), timeZone);
  const row = await prisma.outsideSessionLog.findUnique({
    where: { userId_dateKey: { userId, dateKey: previousKey } },
  });
  if (
    !row ||
    !sparringNeedsEase({
      bodyRating: row.bodyRating,
      sessionRating: row.sessionRating,
      soreSpots: parseStoredSpots(row.soreSpots),
    })
  ) {
    return { plan, checkIn: null };
  }
  const spots = parseStoredSpots(row.soreSpots);
  const reason = recoveryEaseReason({ bodyRating: row.bodyRating, soreSpots: spots });
  const eased = easeDayPlan(plan, reason);
  const profile = await getProfileForUser(userId);
  const coach = resolveAiCoach(profile?.aiCoachId);
  const message =
    row.coachCheckIn ||
    recoveryCheckInCopy({
      coachId: coach.id,
      bodyRating: row.bodyRating,
      head: spots.includes("head"),
      nextWeekday: eased.plan.weekday,
      easedTo: eased.easedTo,
    });
  return {
    plan: eased.plan,
    checkIn: { name: coach.name, image: coach.circle, message },
  };
}

/**
 * Week chips read `summary`, which the sync planner builds before recovery ease.
 * Patch each day from the previous day's sparring log so an eased Tuesday shows
 * Mobility + Cardio instead of the original Bag + Lift icons.
 */
export async function easeWeekStripDays<
  T extends { date: Date; summary: string; active: boolean; sessionCount: number },
>(
  userId: string,
  prefs: PlannerPrefs,
  days: T[],
  timeZone: string,
  swaps: Parameters<typeof planForDate>[3] = [],
): Promise<T[]> {
  if (days.length === 0) return days;
  if (!(await canUseFeature(userId, "rir_auto"))) return days;
  const previousKeys = [
    ...new Set(days.map((day) => dayKey(addZonedDays(day.date, -1, timeZone), timeZone))),
  ];
  const rows = await prisma.outsideSessionLog.findMany({
    where: { userId, dateKey: { in: previousKeys } },
  });
  const byKey = new Map(rows.map((row) => [row.dateKey, row]));
  return days.map((day) => {
    const previous = byKey.get(dayKey(addZonedDays(day.date, -1, timeZone), timeZone));
    if (!previous) return day;
    const spots = parseStoredSpots(previous.soreSpots);
    if (
      !sparringNeedsEase({
        bodyRating: previous.bodyRating,
        sessionRating: previous.sessionRating,
        soreSpots: spots,
      })
    ) {
      return day;
    }
    const eased = easeDayPlan(
      planForDate(prefs, day.date, timeZone, swaps),
      recoveryEaseReason({ bodyRating: previous.bodyRating, soreSpots: spots }),
    );
    if (eased.easedTo === "already-light") return day;
    const trainable = eased.plan.sessions.filter((session) => session.kind !== "rest");
    return {
      ...day,
      summary: eased.plan.summary,
      active: eased.plan.active,
      sessionCount: eased.plan.active ? trainable.length : 0,
    };
  });
}

function parseStoredSpots(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function recentRecoveryCheckIn(userId: string, now = new Date(), timeZone?: string) {
  const profile = await getProfileForUser(userId);
  const tz = timeZone ?? (await timeZoneForUser(userId, profile?.timeZone ?? null));
  const keys = [0, -1].map((offset) => dayKey(addZonedDays(now, offset, tz), tz));
  const rows = await prisma.outsideSessionLog.findMany({
    where: { userId, dateKey: { in: keys }, NOT: { coachCheckIn: "" } },
    orderBy: { dateKey: "desc" },
  });
  const row = rows.find((item) => item.coachCheckIn.trim());
  if (!row) return null;
  const coach = resolveAiCoach(profile?.aiCoachId);
  return { name: coach.name, image: coach.circle, message: row.coachCheckIn };
}
