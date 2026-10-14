import { bagFocusFor, type BagWeekday } from "@/lib/bag-sessions";
import { bikeWeekIndex, pickBikeSessionForPlan } from "@/lib/bike-sessions";
import {
  isGppStrengthDay,
  mesoBlockForWeekIndex,
  mesoBlockLabel,
  strengthDaysForWeek,
  type MesoBlock,
} from "@/lib/mesocycle";
import { WEEKDAYS } from "@/lib/constants";
import { formatDayParam } from "@/lib/home";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { isDeloadWeekIndex, isTestingWeekIndex } from "@/lib/training-cycle";
import {
  APP_TIMEZONE,
  addZonedDays,
  mondayOfZoned,
  weekdayInZone,
  zonedParts,
} from "@/lib/timezone";
import {
  calendarDayForSource,
  weekStartKey,
  type WeekPlanSwap,
} from "@/lib/week-plan-swaps";

export type { WeekPlanSwap } from "@/lib/week-plan-swaps";

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
  /** Skeleton weekday this workout was written for. */
  sourceWeekday?: PlanWeekday;
  /** Stable id for moving this workout within one week. */
  sessionKey?: string;
};

export type DayPlan = {
  weekday: PlanWeekday;
  active: boolean;
  optionalDay: boolean;
  summary: string;
  sessions: PlanSessionSlot[];
  skipReason?: string;
  deload: boolean;
  testingWeek: boolean;
  mesoBlock: MesoBlock;
  mesoLabel: string;
  /** Skeleton weekday whose sessions are showing, when the member moved this day. */
  movedFrom?: PlanWeekday;
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
  slot: "A" | "B" | "C";
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
  sessionKey?: string;
  sourceWeekday?: PlanWeekday;
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

function bikeSlot(weekday: "Tuesday" | "Thursday", weekIndex = 0): PlanSessionSlot {
  const session = pickBikeSessionForPlan(weekday, weekIndex);
  return {
    kind: "conditioning",
    label: "Assault Bike",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: session.programDayNumber,
  };
}

function bagSlot(weekday: BagWeekday, weekIndex = 0): PlanSessionSlot {
  const bag = bagFocusFor(weekday, mesoBlockForWeekIndex(weekIndex));
  return {
    kind: "skill",
    label: bag.label,
    programSlug: DEMO_SKILL_PROGRAM_SLUG,
    dayNumber: bag.dayNumber,
    optional: weekday === "Saturday",
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

/**
 * Core skeleton before availability / session-count compression.
 *
 * Every Mon–Fri training day includes a bag session with a distinct focus.
 * Lifts rotate so consecutive days do not hammer the same muscle group
 * (Jamieson / Daru-style public S&C practice). Tue/Thu keep the assault-bike
 * rotation. Elite / fight-camp overrides are out of scope.
 */
export function coreSkeletonSessions(
  weekday: PlanWeekday,
  _focus?: string | null,
  weekIndex = 0,
): PlanSessionSlot[] {
  const lifts = strengthDaysForWeek(weekIndex);

  if (weekday === "Monday") {
    return [
      bagSlot("Monday", weekIndex),
      strengthSlot(lifts.monday, "Strength — lower (squat / hinge)"),
    ];
  }

  if (weekday === "Tuesday") {
    return [
      bagSlot("Tuesday", weekIndex),
      strengthSlot(lifts.tuesday, "Strength — upper pull + core"),
      bikeSlot("Tuesday", weekIndex),
    ];
  }

  if (weekday === "Wednesday") {
    return [
      bagSlot("Wednesday", weekIndex),
      strengthSlot(lifts.wednesday, "Strength — upper push + rotational"),
    ];
  }

  if (weekday === "Thursday") {
    return [
      bagSlot("Thursday", weekIndex),
      strengthSlot(lifts.thursday, "Strength — posterior / unilateral"),
      bikeSlot("Thursday", weekIndex),
    ];
  }

  if (weekday === "Friday") {
    return [
      bagSlot("Friday", weekIndex),
      strengthSlot(lifts.friday, "Conditioning — full-body GPP", "conditioning"),
    ];
  }

  if (weekday === "Saturday") {
    return [
      {
        kind: "mobility",
        label: "Optional — light mobility / active recovery",
        optional: true,
      },
    ];
  }

  return [{ kind: "mobility", label: "Rest or mobility" }];
}

function summaryForSessions(sessions: PlanSessionSlot[], weekday: PlanWeekday, active: boolean) {
  if (!active) return "Off";
  if (weekday === "Sunday") return "Rest";
  if (weekday === "Saturday") return "Recover";
  const kinds = sessions.map((session) => session.kind);
  const hasBag = kinds.includes("skill");
  const hasLift = kinds.includes("strength");
  const hasBike = sessions.some((session) => /bike/i.test(session.label));
  const hasGpp = sessions.some(
    (session) => session.kind === "conditioning" && isGppStrengthDay(session.dayNumber ?? -1),
  );
  if (hasBag && hasLift && hasBike) return "Bag+Lift+Bike";
  if (hasBag && hasBike) return "Bag+Bike";
  if (hasBag && hasGpp) return "Bag+GPP";
  if (hasBag && hasLift) return "Bag+Lift";
  if (hasBag) return "Bag";
  if (hasGpp) return "GPP";
  if (hasBike) return "Bike";
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
  const mesoBlock = mesoBlockForWeekIndex(weekIndex);
  const mesoLabel = mesoBlockLabel(mesoBlock);
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
      deload: isDeloadWeekIndex(weekIndex),
      testingWeek: isTestingWeekIndex(weekIndex),
      mesoBlock,
      mesoLabel,
    };
  }
  return plan;
}

/** Identity for one skeleton workout. Same key every week; stored per weekStart. */
export function planSessionKey(source: PlanWeekday, slot: PlanSessionSlot, index: number) {
  if (slot.programSlug && slot.dayNumber != null) {
    return `${source}:${slot.programSlug}:${slot.dayNumber}`;
  }
  return `${source}:${slot.kind}:${index}`;
}

function stampSessions(sessions: PlanSessionSlot[], source: PlanWeekday): PlanSessionSlot[] {
  return sessions.map((slot, index) => ({
    ...slot,
    sourceWeekday: slot.sourceWeekday ?? source,
    sessionKey: slot.sessionKey ?? planSessionKey(source, slot, index),
  }));
}

function planOnCalendarDay(skeleton: DayPlan, calendarWeekday: PlanWeekday, source: PlanWeekday): DayPlan {
  const stamped = {
    ...skeleton,
    weekday: calendarWeekday,
    sessions: stampSessions(skeleton.sessions, source),
  };
  if (source === calendarWeekday) return stamped;
  return { ...stamped, movedFrom: source };
}

function placedTrainingSessions(
  built: Record<PlanWeekday, DayPlan>,
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>,
  sessionDays: Partial<Record<string, PlanWeekday>>,
  calendarDay: PlanWeekday,
) {
  const placed: PlanSessionSlot[] = [];
  for (const source of WEEKDAYS) {
    built[source].sessions.forEach((slot, index) => {
      if (slot.kind === "rest") return;
      const key = planSessionKey(source, slot, index);
      const target = sessionDays[key] ?? calendarDayForSource(sourceByDay, source);
      if (target !== calendarDay) return;
      placed.push({ ...slot, sourceWeekday: source, sessionKey: key });
    });
  }
  return placed;
}

function arrangeCalendarDay(
  built: Record<PlanWeekday, DayPlan>,
  calendarWeekday: PlanWeekday,
  weekStart: string,
  swaps: WeekPlanSwap[],
): DayPlan {
  const row = swaps.find((item) => item.weekStart === weekStart);
  const sessionDays = row?.sessionDays;
  const sourceByDay = row?.sourceByDay ?? {};
  const hasMoves = Boolean(sessionDays && Object.keys(sessionDays).length > 0);
  if (!hasMoves) {
    const source = sourceByDay[calendarWeekday] ?? calendarWeekday;
    return planOnCalendarDay(built[source], calendarWeekday, source);
  }
  const training = placedTrainingSessions(built, sourceByDay, sessionDays ?? {}, calendarWeekday);
  const template = built[calendarWeekday];
  const templateTraining = template.sessions.filter((slot) => slot.kind !== "rest");
  if (training.length === 0) {
    if (templateTraining.length === 0) {
      return planOnCalendarDay(template, calendarWeekday, calendarWeekday);
    }
    return planOnCalendarDay(
      {
        ...template,
        active: false,
        summary: "Off",
        sessions: [{ kind: "rest", label: "Rest / skip" }],
        skipReason: "Workouts from this day are on another day this week.",
        movedFrom: undefined,
      },
      calendarWeekday,
      calendarWeekday,
    );
  }
  const sources = new Set(
    training.map((slot) => slot.sourceWeekday).filter((day): day is PlanWeekday => Boolean(day)),
  );
  const only = sources.size === 1 ? [...sources][0] : undefined;
  return {
    ...template,
    weekday: calendarWeekday,
    active: true,
    optionalDay: training.every((slot) => slot.optional),
    summary: summaryForSessions(training, calendarWeekday, true),
    sessions: training,
    skipReason: undefined,
    movedFrom: only && only !== calendarWeekday ? only : undefined,
  };
}

export function planForDate(
  prefs: PlannerPrefs,
  date: Date,
  timeZone = APP_TIMEZONE,
  swaps: WeekPlanSwap[] = [],
): DayPlan {
  const calendarWeekday = weekdayInAppZone(date, timeZone);
  const built = buildCoreWeekPlan(prefs, bikeWeekIndex(date, timeZone));
  return arrangeCalendarDay(built, calendarWeekday, weekStartKey(date, timeZone), swaps);
}

export function nextActiveDate(
  prefs: PlannerPrefs,
  from: Date,
  timeZone = APP_TIMEZONE,
  swaps: WeekPlanSwap[] = [],
): Date | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const cursor = addZonedDays(from, offset, timeZone);
    if (planForDate(prefs, cursor, timeZone, swaps).active) return cursor;
  }
  return null;
}

export function nextActiveWeekday(
  prefs: PlannerPrefs,
  from: Date,
  timeZone = APP_TIMEZONE,
  swaps: WeekPlanSwap[] = [],
): PlanWeekday | null {
  const next = nextActiveDate(prefs, from, timeZone, swaps);
  return next ? weekdayInAppZone(next, timeZone) : null;
}

export function weekStrip(
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
  selected?: Date,
  swaps: WeekPlanSwap[] = [],
  /** When set, the strip is that date’s Monday–Sunday, not the week of `now`. */
  weekAnchor?: Date,
) {
  const today = weekdayInAppZone(now, timeZone);
  const todayKey = formatDayParam(now, timeZone);
  const selectedWeekday = selected ? weekdayInAppZone(selected, timeZone) : today;
  const selectedKey = selected ? formatDayParam(selected, timeZone) : todayKey;
  const anchor = weekAnchor ?? now;
  const monday = mondayOfZoned(anchor, timeZone);
  const weekStart = weekStartKey(anchor, timeZone);
  const built = buildCoreWeekPlan(prefs, bikeWeekIndex(anchor, timeZone));
  return WEEKDAYS.map((weekday, index) => {
    const date = addZonedDays(monday, index, timeZone);
    const plan = arrangeCalendarDay(built, weekday, weekStart, swaps);
    const dayParam = formatDayParam(date, timeZone);
    return {
      weekday,
      short: weekday.slice(0, 3),
      date,
      dayParam,
      dateLabel: String(zonedParts(date, timeZone).day),
      isToday: dayParam === todayKey,
      isSelected: weekAnchor ? dayParam === selectedKey : weekday === selectedWeekday,
      isPast: dayParam < todayKey,
      active: plan.active,
      summary: plan.summary,
      sessionCount: plan.active ? plan.sessions.length : 0,
      deload: plan.deload,
      testingWeek: plan.testingWeek,
      movedFrom: plan.movedFrom,
    };
  });
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
    const slotLetter = (["A", "B", "C"] as const)[Math.min(resolved.length, 2)];
    resolved.push({
      slot: slotLetter,
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
      sessionKey: session.sessionKey,
      sourceWeekday: session.sourceWeekday,
    });
  }
  return resolved;
}

export type MoveDayChoice = {
  weekday: PlanWeekday;
  label: string;
  detail: string;
  isToday: boolean;
  isPast: boolean;
};

/** Days in the viewed week, with the workouts already sitting on each one. */
export function moveDayChoices(
  prefs: PlannerPrefs,
  now: Date,
  timeZone: string,
  weekAnchor: Date,
  swaps: WeekPlanSwap[],
  titles?: Partial<Record<PlanWeekday, string[]>>,
): MoveDayChoice[] {
  return weekStrip(prefs, now, timeZone, undefined, swaps, weekAnchor).map((day) => {
    const named = (titles?.[day.weekday] ?? []).map((title) => title.trim()).filter(Boolean);
    const plan = planForDate(prefs, day.date, timeZone, swaps);
    const fallback = plan.sessions
      .filter((session) => session.kind !== "rest")
      .map((session) => session.label);
    const lines = named.length > 0 ? named : fallback;
    return {
      weekday: day.weekday,
      label: day.isToday ? `Today · ${day.weekday}` : `${day.weekday} ${day.dateLabel}`,
      detail: lines.length > 0 ? lines.join(" · ") : "Open",
      isToday: day.isToday,
      isPast: day.isPast,
    };
  });
}

export function corePlanCopy(prefs: { goalKey?: string; primaryFocus?: string }) {
  const focus = prefs.primaryFocus;
  if (focus && focus !== "general-fitness") {
    return "Core week plan (DEMO) from your intake — bag + strength on set weekdays. Not Elite or fight-camp coaching.";
  }
  return "Core week plan (DEMO) — bag, strength, and conditioning on set weekdays. Not Elite or fight-camp coaching.";
}
