import { bikeWeekIndex, pickBikeSessionForPlan } from "@/lib/bike-sessions";
import { FRIDAY_GPP_DAY_NUMBER } from "@/lib/daru-exercises";
import { WEEKDAYS } from "@/lib/constants";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { APP_TIMEZONE, addZonedDays, weekdayInZone } from "@/lib/timezone";

export { APP_TIMEZONE } from "@/lib/timezone";

export const CORE_DEFAULT_TRAINING_DAYS = ["Monday", "Wednesday", "Friday"] as const;

export type PlanWeekday = (typeof WEEKDAYS)[number];

export type PlanSessionKind = "skill" | "strength" | "conditioning" | "rest" | "mobility";

export type PlanSessionSlot = {
  kind: PlanSessionKind;
  label: string;
  optional?: boolean;
  programSlug?: typeof DEMO_PROGRAM_SLUG | typeof DEMO_SKILL_PROGRAM_SLUG;
  dayNumber?: number;
};

export type DayPlan = {
  weekday: PlanWeekday;
  active: boolean;
  optionalDay: boolean;
  summary: string;
  sessions: PlanSessionSlot[];
  skipReason?: string;
};

export type PlannerPrefs = {
  primaryFocus?: string | null;
  weeklyAvailability?: string[];
  sessionsPerWeek?: number | null;
};

export type CatalogDayLike = {
  id: string;
  dayNumber: number;
  title: string;
  focus: string;
  exercises: Array<{ sets: number; restSeconds: number }>;
};

export type ResolvedPlanSession = {
  slot: "A" | "B";
  kind: PlanSessionKind;
  label: string;
  title: string;
  subtitle: string;
  optional: boolean;
  programSlug?: string;
  dayNumber?: number;
  dayId?: string;
  href?: string;
  day?: CatalogDayLike | null;
};

const JS_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayInAppZone(
  date: Date,
  timeZone = APP_TIMEZONE,
): PlanWeekday {
  const weekday = weekdayInZone(date, timeZone);
  return (JS_WEEKDAYS.includes(weekday) ? weekday : "Monday") as PlanWeekday;
}

export function isStrikingFocus(focus?: string | null) {
  return focus === "mma" || focus === "muay-thai" || focus === "boxing";
}

export function isGrapplingFocus(focus?: string | null) {
  return (
    focus === "mma" ||
    focus === "wrestling" ||
    focus === "jiu-jitsu" ||
    focus === "cagework"
  );
}

export function isGeneralFitnessFocus(focus?: string | null) {
  return !focus || focus === "general-fitness";
}

function bagDayNumber(focus: string, slot: "power" | "technique") {
  if (focus === "boxing") return 3;
  if (slot === "technique" && (focus === "muay-thai" || focus === "mma")) return 2;
  if (focus === "muay-thai" || focus === "mma") return 1;
  return 3;
}

function bikeSlot(weekday: "Tuesday" | "Thursday", weekIndex = 0): PlanSessionSlot {
  const session = pickBikeSessionForPlan(weekday, weekIndex);
  return {
    kind: "conditioning",
    label: "Assault Bike",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: session.programDayNumber,
  };
}

function saturdaySkillSlot(focus: string): PlanSessionSlot | null {
  if (isGeneralFitnessFocus(focus)) return null;
  const dayNumber =
    focus === "boxing" ? 3 : focus === "muay-thai" ? 2 : focus === "jiu-jitsu" ? 6 : 5;
  return {
    kind: "skill",
    label: "Open skill / sparring prep",
    programSlug: DEMO_SKILL_PROGRAM_SLUG,
    dayNumber,
    optional: true,
  };
}

function strengthSlot(dayNumber: number, label: string, kind: PlanSessionKind = "strength"): PlanSessionSlot {
  return {
    kind,
    label,
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber,
  };
}

function skillSlot(dayNumber: number, label: string): PlanSessionSlot {
  return {
    kind: "skill",
    label,
    programSlug: DEMO_SKILL_PROGRAM_SLUG,
    dayNumber,
  };
}

/**
 * Core skeleton before availability / session-count compression.
 * Elite / fight-camp overrides are out of scope — do not add them here.
 */
export function coreSkeletonSessions(
  weekday: PlanWeekday,
  focus?: string | null,
  weekIndex = 0,
): PlanSessionSlot[] {
  const art = focus ?? "";
  const striking = isStrikingFocus(art);

  if (weekday === "Monday") {
    const sessions: PlanSessionSlot[] = [];
    if (striking) {
      sessions.push(skillSlot(bagDayNumber(art, "power"), "Bag / striking"));
    }
    sessions.push(strengthSlot(2, "Strength — push / upper"));
    return sessions;
  }

  if (weekday === "Tuesday") {
    return [bikeSlot("Tuesday", weekIndex)];
  }

  if (weekday === "Wednesday") {
    const sessions: PlanSessionSlot[] = [];
    if (striking) {
      sessions.push(skillSlot(bagDayNumber(art, "power"), "Bag / pads power"));
    }
    sessions.push(strengthSlot(3, "Strength — pull / posterior"));
    return sessions;
  }

  if (weekday === "Thursday") {
    return [bikeSlot("Thursday", weekIndex)];
  }

  if (weekday === "Friday") {
    return [
      strengthSlot(FRIDAY_GPP_DAY_NUMBER, "Conditioning", "conditioning"),
      strengthSlot(1, "Strength — legs / athletic"),
    ];
  }

  if (weekday === "Saturday") {
    const open = saturdaySkillSlot(art);
    return open ? [open] : [{ kind: "rest", label: "Optional — skip", optional: true }];
  }

  return [{ kind: "mobility", label: "Rest or mobility" }];
}

function summaryForSessions(sessions: PlanSessionSlot[], weekday: PlanWeekday, active: boolean) {
  if (!active) return "Off";
  if (weekday === "Sunday") return "Rest";
  const kinds = sessions.map((session) => session.kind);
  const hasSkill = kinds.includes("skill");
  const hasLift = kinds.includes("strength") || kinds.includes("conditioning");
  if (hasSkill && hasLift) return "Bag+Lift";
  if (hasSkill && sessions[0]?.optional) return "Optional";
  if (hasSkill) return "Skill";
  if (kinds.includes("conditioning") && kinds.includes("strength")) return "GPP";
  if (kinds.includes("conditioning")) return "Bike";
  if (hasLift) return "Lift";
  if (kinds.includes("mobility")) return "Recover";
  return "Rest";
}

export function resolveTrainingDays(prefs: PlannerPrefs): Set<PlanWeekday> {
  const listed = (prefs.weeklyAvailability ?? []).filter((day): day is PlanWeekday =>
    (WEEKDAYS as readonly string[]).includes(day),
  );
  const base: PlanWeekday[] =
    listed.length > 0 ? listed : [...CORE_DEFAULT_TRAINING_DAYS];
  const active = new Set<PlanWeekday>(base.filter((day) => day !== "Sunday"));

  const keepOrder: PlanWeekday[] = [
    "Monday",
    "Wednesday",
    "Friday",
    "Thursday",
    "Tuesday",
    "Saturday",
  ];

  if (prefs.sessionsPerWeek != null && prefs.sessionsPerWeek > 0) {
    const ranked = keepOrder.filter((day) => active.has(day));
    const kept = ranked.slice(0, prefs.sessionsPerWeek);
    return new Set(kept);
  }

  if (listed.length === 0) {
    return new Set(CORE_DEFAULT_TRAINING_DAYS as unknown as PlanWeekday[]);
  }

  return active;
}

export function buildCoreWeekPlan(prefs: PlannerPrefs, weekIndex = 0): Record<PlanWeekday, DayPlan> {
  const activeDays = resolveTrainingDays(prefs);
  const focus = prefs.primaryFocus ?? "";
  const plan = {} as Record<PlanWeekday, DayPlan>;

  for (const weekday of WEEKDAYS) {
    const optionalDay = weekday === "Saturday";
    const alwaysOnBike = weekday === "Tuesday" || weekday === "Thursday";
    const active = weekday === "Sunday" ? false : alwaysOnBike || activeDays.has(weekday);
    const sessions = coreSkeletonSessions(weekday, focus, weekIndex);
    let skipReason: string | undefined;
    if (!active && weekday !== "Sunday") {
      skipReason = "Not on your training days this week. Rest or do easy movement.";
    }
    if (weekday === "Sunday") {
      skipReason = "Rest or light mobility. Core plan — not a fight camp.";
    }
    plan[weekday] = {
      weekday,
      active,
      optionalDay,
      summary: summaryForSessions(sessions, weekday, active),
      sessions: active ? sessions : [{ kind: "rest", label: "Rest / skip" }],
      skipReason: active ? undefined : skipReason,
    };
  }
  return plan;
}

export function planForDate(
  prefs: PlannerPrefs,
  date: Date,
  timeZone = APP_TIMEZONE,
): DayPlan {
  const weekday = weekdayInAppZone(date, timeZone);
  return buildCoreWeekPlan(prefs, bikeWeekIndex(date, timeZone))[weekday];
}

export function nextActiveDate(
  prefs: PlannerPrefs,
  from: Date,
  timeZone = APP_TIMEZONE,
): Date | null {
  const plan = buildCoreWeekPlan(prefs);
  for (let offset = 1; offset <= 7; offset += 1) {
    const cursor = addZonedDays(from, offset, timeZone);
    if (plan[weekdayInAppZone(cursor, timeZone)].active) return cursor;
  }
  return null;
}

export function nextActiveWeekday(
  prefs: PlannerPrefs,
  from: Date,
  timeZone = APP_TIMEZONE,
): PlanWeekday | null {
  const next = nextActiveDate(prefs, from, timeZone);
  return next ? weekdayInAppZone(next, timeZone) : null;
}

export function weekStrip(
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const today = weekdayInAppZone(now, timeZone);
  const plan = buildCoreWeekPlan(prefs, bikeWeekIndex(now, timeZone));
  return WEEKDAYS.map((weekday) => ({
    weekday,
    short: weekday.slice(0, 3),
    isToday: weekday === today,
    active: plan[weekday].active,
    summary: plan[weekday].summary,
    sessionCount: plan[weekday].active ? plan[weekday].sessions.length : 0,
  }));
}

export function resolvePlanSessions(
  dayPlan: DayPlan,
  catalog: {
    strength?: { days: CatalogDayLike[] } | null;
    skill?: { days: CatalogDayLike[] } | null;
  },
): ResolvedPlanSession[] {
  if (!dayPlan.active) {
    return [
      {
        slot: "A",
        kind: "rest",
        label: "Rest / skip",
        title: "Rest day",
        subtitle: dayPlan.skipReason ?? "Off on the Core week plan.",
        optional: false,
      },
    ];
  }

  const resolved: ResolvedPlanSession[] = [];
  for (const session of dayPlan.sessions) {
    const pool =
      session.programSlug === DEMO_SKILL_PROGRAM_SLUG
        ? catalog.skill?.days ?? []
        : session.programSlug === DEMO_PROGRAM_SLUG
          ? catalog.strength?.days ?? []
          : [];
    const day =
      session.dayNumber != null
        ? pool.find((row) => row.dayNumber === session.dayNumber) ?? null
        : null;
    const slot = resolved.length === 0 ? "A" : "B";
    resolved.push({
      slot,
      kind: session.kind,
      label: session.label,
      title: day?.title ?? session.label,
      subtitle: day?.focus ?? session.label,
      optional: Boolean(session.optional),
      programSlug: session.programSlug,
      dayNumber: session.dayNumber,
      dayId: day?.id,
      href: day?.id ? `/training/${day.id}` : undefined,
      day,
    });
  }
  return resolved;
}

export function corePlanCopy(prefs: { goalKey?: string; primaryFocus?: string }) {
  const focus = prefs.primaryFocus;
  if (focus && focus !== "general-fitness") {
    return "Core week plan (DEMO) from your intake — skill + strength on set weekdays. Not Elite or fight-camp coaching.";
  }
  return "Core week plan (DEMO) — strength and conditioning on set weekdays. Not Elite or fight-camp coaching.";
}
