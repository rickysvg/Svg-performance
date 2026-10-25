import {
  bikeWeekIndex,
  easyBikeProgramDayNumber,
  memberWeekIndex,
  moderateBikeProgramDayNumber,
  pickBikeSessionForPlan,
} from "@/lib/bike-sessions";
import { bikeLoggerHref, isBikePlanSession } from "@/lib/timer-session";
import {
  FRIDAY_CONDITIONING_LABEL,
  isGppStrengthDay,
  mesoBlockForWeekIndex,
  mesoBlockLabel,
  strengthDaysForWeek,
  type MesoBlock,
} from "@/lib/mesocycle";
import { WEEKDAYS } from "@/lib/constants";
import { formatDayParam } from "@/lib/home";
import { memberCopy } from "@/lib/member-copy";
import {
  assignWeek,
  outsideDayLabel,
  type DayRole,
  type LiftKind,
  type OutsideDay,
} from "@/lib/member-plan";
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
  /** Lift, hard bag, or hard conditioning. Easy cardio and mobility are not heavy. */
  heavy?: boolean;
  title?: string;
  detail?: string;
  href?: string;
  /** Recovery ease cut this session in half. The logger opens that shorter prescription. */
  halved?: boolean;
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
  outside?: { kind: "class" | "sparring"; time?: string; label: string; hard?: boolean } | null;
  dayNote?: string;
  /** Set when yesterday's sparring log eased this day. */
  easeNote?: string;
};

export type PlannerPrefs = {
  primaryFocus?: string | null;
  weeklyAvailability?: string[];
  sessionsPerWeek?: number | null;
  trainingFocus?: string | null;
  liftDaysPerWeek?: number | null;
  experienceLevel?: string | null;
  email?: string | null;
  outsideTraining?: OutsideDay[] | null;
  /** Member start. Week 0 is their first week, so a new member is not dropped onto Day 17. */
  planAnchor?: Date | null;
  /** Fight camp week. When set, this picks the 3-week block instead of the join date. */
  forcedWeekIndex?: number | null;
};

export function planWeekIndex(date: Date, timeZone: string, anchor?: Date | null) {
  if (anchor && !Number.isNaN(anchor.getTime())) return memberWeekIndex(date, anchor, timeZone);
  return bikeWeekIndex(date, timeZone);
}

export function weekIndexFor(prefs: PlannerPrefs, date: Date, timeZone: string) {
  if (typeof prefs.forcedWeekIndex === "number" && Number.isFinite(prefs.forcedWeekIndex)) {
    return Math.max(0, Math.floor(prefs.forcedWeekIndex));
  }
  return planWeekIndex(date, timeZone, prefs.planAnchor);
}

export type CatalogDayLike = {
  id: string;
  dayNumber: number;
  title: string;
  focus: string;
  exercises: Array<{ name?: string; sets: number; restSeconds: number }>;
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
  /** Bike sessions: start the logger. Other sessions leave this empty. */
  logHref?: string;
  /** Plain link that opens the logger, including a halved recovery-ease day. */
  startHref?: string;
  halved?: boolean;
  day?: CatalogDayLike | null;
  sessionKey?: string;
  sourceWeekday?: PlanWeekday;
  heavy?: boolean;
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

function bikeSlot(weekday: "Wednesday" | "Sunday", weekIndex = 0): PlanSessionSlot {
  const session = pickBikeSessionForPlan(weekday, weekIndex);
  return {
    kind: "conditioning",
    label: "Cardio — bike",
    title: "Cardio — bike",
    detail: "Bike, sprints, or the other conditioning on this menu.",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: session.programDayNumber,
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

function mobilitySlot(which: "primary" | "secondary"): PlanSessionSlot {
  if (which === "primary") {
    return {
      kind: "mobility",
      label: "Mobility — shoulders and hips",
      title: "Mobility — shoulders and hips",
      detail: "Easy range. No hard effort.",
      href: "/mobility/upper-back",
    };
  }
  return {
    kind: "mobility",
    label: "Mobility — easy hips",
    title: "Mobility — easy hips",
    detail: "Easy range. No hard effort.",
    href: "/mobility/cooldown",
  };
}

export function easyCardioSlot(): PlanSessionSlot {
  return {
    kind: "conditioning",
    label: "Easy cardio",
    title: "Easy cardio",
    detail: "Walk, easy bike, or easy jump rope. No sprints and no hard intervals.",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: easyBikeProgramDayNumber(),
    heavy: false,
  };
}

export function moderateCardioSlot(): PlanSessionSlot {
  return {
    kind: "conditioning",
    label: "Cardio — moderate",
    title: "Cardio — moderate",
    detail: "Steady work. No max-intensity intervals and no heavy legs.",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: moderateBikeProgramDayNumber(),
    heavy: false,
  };
}

function hardClassBikeSlot(weekIndex = 0): PlanSessionSlot {
  const session = pickBikeSessionForPlan("Wednesday", weekIndex);
  return {
    kind: "conditioning",
    label: "Cardio — bike",
    title: "Cardio — bike",
    detail: "Light-to-moderate bike or steady conditioning. No sprints and no heavy lifting.",
    programSlug: DEMO_PROGRAM_SLUG,
    dayNumber: session.programDayNumber,
    heavy: false,
  };
}

function liftSlot(kind: LiftKind, weekIndex: number): PlanSessionSlot {
  const lifts = strengthDaysForWeek(weekIndex);
  if (kind === "lower") return strengthSlot(lifts.monday, "Strength — full body");
  if (kind === "pull" || kind === "push") return strengthSlot(lifts.tuesday, "Strength — full body");
  return {
    ...strengthSlot(lifts.thursday, "Strength — light full body"),
    detail: "Lightest lift of the week. No near-max set.",
  };
}

function sessionsForRole(weekday: PlanWeekday, role: DayRole, weekIndex: number): PlanSessionSlot[] {
  if (role.outside?.kind === "sparring") return [];
  const sessions: PlanSessionSlot[] = [];
  if (role.lift) sessions.push({ ...liftSlot(role.lift, weekIndex), heavy: true });
  if (role.gpp) {
    const circuit = strengthDaysForWeek(weekIndex).friday;
    sessions.push({
      kind: "conditioning",
      label: FRIDAY_CONDITIONING_LABEL,
      title: FRIDAY_CONDITIONING_LABEL,
      detail: "General prep. 2–3 RIR. Nothing to failure.",
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: circuit,
      heavy: false,
    });
  }
  if (role.cardio === "hard-bike" || role.cardio === "hard" || role.cardio === "hard-repeats") {
    const bikeDay = weekday === "Sunday" ? "Sunday" : "Wednesday";
    sessions.push({
      ...bikeSlot(bikeDay, weekIndex),
      heavy: weekday !== "Sunday",
      detail:
        weekday === "Sunday"
          ? "Easier bike of the pair. Zone 2. No sprints."
          : "Sprint bike. The harder session of this week's pair.",
    });
  } else if (role.cardio === "easy") {
    sessions.push({ ...easyCardioSlot(), heavy: false });
  } else if (role.cardio === "moderate") {
    sessions.push(
      role.outside?.hard ? hardClassBikeSlot(weekIndex) : { ...moderateCardioSlot(), heavy: false },
    );
  }
  if (role.mobility) sessions.push({ ...mobilitySlot(role.mobility), heavy: false });
  return sessions;
}

function summaryForRole(role: DayRole, active: boolean) {
  if (role.outside?.kind === "sparring") return "Sparring";
  if (!active) return "Off";
  const parts: string[] = [];
  if (role.lift) parts.push("Lift");
  if (role.gpp) parts.push(FRIDAY_CONDITIONING_LABEL);
  if (role.cardio) parts.push("Cardio");
  if (role.mobility) parts.push("Mobility");
  return parts.join("+") || "Rest";
}

function weekRoles(prefs: PlannerPrefs) {
  return assignWeek({
    trainingFocus: prefs.trainingFocus,
    liftDaysPerWeek: prefs.liftDaysPerWeek,
    experienceLevel: prefs.experienceLevel,
    email: prefs.email,
    outsideTraining: prefs.outsideTraining,
  });
}

/**
 * Sessions for one weekday on the current template.
 * Lift days are capped. Sparring has no workout. Class days stay light.
 */
export function coreSkeletonSessions(
  weekday: PlanWeekday,
  focus?: string | null,
  weekIndex = 0,
  prefs?: PlannerPrefs,
): PlanSessionSlot[] {
  const roles = weekRoles({
    primaryFocus: focus,
    trainingFocus: prefs?.trainingFocus,
    liftDaysPerWeek: prefs?.liftDaysPerWeek,
    experienceLevel: prefs?.experienceLevel ?? "intermediate",
    email: prefs?.email,
    outsideTraining: prefs?.outsideTraining,
  });
  return sessionsForRole(weekday, roles[weekday], weekIndex);
}

function sessionIsFridayConditioning(session: PlanSessionSlot) {
  if (session.kind !== "conditioning") return false;
  if (
    session.label === FRIDAY_CONDITIONING_LABEL ||
    session.title === FRIDAY_CONDITIONING_LABEL ||
    session.label === "Friday circuit" ||
    session.title === "Friday circuit"
  ) {
    return true;
  }
  return session.dayNumber != null && isGppStrengthDay(session.dayNumber);
}

function summaryWithOutside(
  summary: string,
  outside: DayPlan["outside"],
) {
  if (outside?.kind !== "sparring") return summary;
  const parts = summary.split("+").filter((part) => part && part !== "Off" && part !== "Rest");
  if (parts.includes("Sparring")) return parts.join("+");
  if (parts.length === 0) return "Sparring";
  return `${parts.join("+")}+Sparring`;
}

function summaryForSessions(sessions: PlanSessionSlot[], weekday: PlanWeekday, active: boolean) {
  if (!active) return "Off";
  const hasBag = sessions.some((session) => session.kind === "skill");
  const hasLift = sessions.some((session) => session.kind === "strength");
  const hasConditioning = sessions.some(sessionIsFridayConditioning);
  const hasCardio = sessions.some(
    (session) => session.kind === "conditioning" && !sessionIsFridayConditioning(session),
  );
  const hasMobility = sessions.some((session) => session.kind === "mobility");
  const parts: string[] = [];
  if (hasBag) parts.push("Bag");
  if (hasLift) parts.push("Lift");
  if (hasConditioning) parts.push(FRIDAY_CONDITIONING_LABEL);
  if (hasCardio) parts.push("Cardio");
  if (hasMobility) parts.push("Mobility");
  if (parts.length > 0) return parts.join("+");
  if (weekday === "Saturday" || weekday === "Sunday") return "Off";
  return "Rest";
}

/**
 * Days that have a v2 role. Saved availability and sessions-per-week do not
 * blank Tuesday, Thursday, or the bikes. Outside class and sparring still count.
 */
export function resolveTrainingDays(prefs: PlannerPrefs): Set<PlanWeekday> {
  const roles = weekRoles(prefs);
  const active = new Set<PlanWeekday>();
  for (const weekday of WEEKDAYS) {
    if (dayIsActive(roles[weekday])) active.add(weekday);
  }
  return active;
}

function dayIsActive(role: DayRole) {
  if (role.outside) return true;
  return Boolean(role.lift || role.cardio || role.mobility);
}

function outsideNote(role: DayRole) {
  if (!role.outside) return undefined;
  if (role.outside.kind === "sparring") {
    return `${outsideDayLabel(role.outside)}. No app workout — log rounds after you spar.`;
  }
  if (role.outside.hard) {
    return `${outsideDayLabel(role.outside)}. Light-to-moderate bike only — no heavy lifting. The next day stays as written unless you log sparring with a rating.`;
  }
  return `${outsideDayLabel(role.outside)}. Light day only: mobility and easy cardio. Nothing to log.`;
}

export function buildCoreWeekPlan(prefs: PlannerPrefs, weekIndex = 0): Record<PlanWeekday, DayPlan> {
  const roles = weekRoles(prefs);
  const mesoBlock = mesoBlockForWeekIndex(weekIndex);
  const mesoLabel = mesoBlockLabel(mesoBlock);
  const plan = {} as Record<PlanWeekday, DayPlan>;

  for (const weekday of WEEKDAYS) {
    const role = roles[weekday];
    const active = dayIsActive(role);
    const sessions = sessionsForRole(weekday, role, weekIndex);
    const outside = role.outside
      ? {
          kind: role.outside.kind,
          time: role.outside.time,
          label: outsideDayLabel(role.outside),
          ...(role.outside.hard ? { hard: true } : {}),
        }
      : null;
    let skipReason: string | undefined;
    if (!active) {
      skipReason =
        weekday === "Sunday"
          ? "Rest or light mobility. Core plan — not a fight camp."
          : "Not on your training days this week. Rest or do easy movement.";
    }
    plan[weekday] = {
      weekday,
      active,
      optionalDay: false,
      summary: active ? summaryForRole(role, true) : "Off",
      sessions: active ? (sessions.length > 0 ? sessions : []) : [{ kind: "rest", label: "Rest / skip" }],
      skipReason: active ? undefined : skipReason,
      deload: isDeloadWeekIndex(weekIndex),
      testingWeek: isTestingWeekIndex(weekIndex),
      mesoBlock,
      mesoLabel,
      outside,
      dayNote: outsideNote(role),
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
    summary: summaryWithOutside(
      summaryForSessions(training, calendarWeekday, true),
      template.outside,
    ),
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
  const built = buildCoreWeekPlan(prefs, weekIndexFor(prefs, date, timeZone));
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

const CHIP_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Calendar chip date. The month shows on the first day and when the week crosses a month. */
export function weekChipDateLabel(
  date: Date,
  dateLabel: string,
  index: number,
  previousDate: Date | undefined,
  timeZone = APP_TIMEZONE,
) {
  const month = CHIP_MONTHS[zonedParts(date, timeZone).month - 1] ?? "";
  const previous =
    previousDate != null ? CHIP_MONTHS[zonedParts(previousDate, timeZone).month - 1] ?? "" : "";
  if (index === 0 || month !== previous) return `${month} ${dateLabel}`;
  return dateLabel;
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
  const todayKey = formatDayParam(now, timeZone);
  const selectedKey = selected ? formatDayParam(selected, timeZone) : todayKey;
  const anchor = weekAnchor ?? now;
  const monday = mondayOfZoned(anchor, timeZone);
  const weekStart = weekStartKey(anchor, timeZone);
  const built = buildCoreWeekPlan(prefs, weekIndexFor(prefs, anchor, timeZone));
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
      // Match the calendar date, not the weekday name. A Thursday in another
      // week must not light up this week's Thursday.
      isSelected: dayParam === selectedKey,
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
    const title = session.title ?? (day?.title ? memberCopy(day.title) : session.label);
    const subtitle = session.detail ?? (day?.focus ? memberCopy(day.focus) : session.label);
    const bike = Boolean(day?.id) && isBikePlanSession({ title, label: session.label, day });
    const half = session.halved ? "?half=1" : "";
    const startHref = day?.id ? `${bikeLoggerHref(day.id)}${half}` : undefined;
    resolved.push({
      slot: slotLetter,
      kind: session.kind,
      label: session.label,
      title,
      subtitle,
      optional: Boolean(session.optional),
      programSlug: session.programSlug,
      dayNumber: session.dayNumber,
      dayId: day?.id,
      href: day?.id ? `/training/${day.id}${half}` : session.href,
      logHref: bike && startHref ? startHref : undefined,
      startHref,
      halved: Boolean(session.halved),
      day,
      sessionKey: session.sessionKey,
      sourceWeekday: session.sourceWeekday,
      heavy: Boolean(session.heavy),
    });
  }
  return resolved;
}

/** Week chip target when the day's work is one bike session (mobility may sit beside it). */
export function bikeChipLogHref(
  dayPlan: DayPlan,
  catalog: {
    strength?: { days: CatalogDayLike[] } | null;
    skill?: { days: CatalogDayLike[] } | null;
  },
): string | null {
  const sessions = resolvePlanSessions(dayPlan, catalog).filter((session) => session.kind !== "rest");
  const work = sessions.filter((session) => session.kind !== "mobility");
  if (work.length !== 1) return null;
  return work[0]?.logHref ?? null;
}

/** Program days on this chip, in plan order. Rest slots are not sessions. */
export function plannedChipSessionIds(
  dayPlan: DayPlan,
  catalog: {
    strength?: { days: CatalogDayLike[] } | null;
    skill?: { days: CatalogDayLike[] } | null;
  },
) {
  return resolvePlanSessions(dayPlan, catalog)
    .filter((session) => session.kind !== "rest" && session.dayId)
    .map((session) => session.dayId as string);
}

export function withChipSessionIds<T extends { date: Date }>(
  days: T[],
  prefs: PlannerPrefs,
  catalog: {
    strength?: { days: CatalogDayLike[] } | null;
    skill?: { days: CatalogDayLike[] } | null;
  },
  timeZone = APP_TIMEZONE,
  swaps: WeekPlanSwap[] = [],
): Array<T & { sessionIds: string[] }> {
  return days.map((day) => ({
    ...day,
    sessionIds: plannedChipSessionIds(planForDate(prefs, day.date, timeZone, swaps), catalog),
  }));
}

export function withBikeChipLogHrefs<T extends { date: Date; summary: string }>(
  days: T[],
  prefs: PlannerPrefs,
  catalog: {
    strength?: { days: CatalogDayLike[] } | null;
    skill?: { days: CatalogDayLike[] } | null;
  },
  timeZone = APP_TIMEZONE,
  swaps: WeekPlanSwap[] = [],
): Array<T & { logHref?: string }> {
  return days.map((day) => {
    const plan = planForDate(prefs, day.date, timeZone, swaps);
    if (plan.summary !== day.summary) return { ...day, logHref: undefined };
    return { ...day, logHref: bikeChipLogHref(plan, catalog) ?? undefined };
  });
}

export type MoveSessionChoice = {
  sessionKey: string;
  title: string;
  heavy: boolean;
  completed: boolean;
};

export type MoveListedSession = {
  title: string;
  sessionKey?: string;
  completed?: boolean;
  heavy?: boolean;
};

export type MoveDayChoice = {
  weekday: PlanWeekday;
  label: string;
  detail: string;
  isToday: boolean;
  isPast: boolean;
  outside: "class" | "sparring" | null;
  /** The next calendar day is one of this member’s sparring days. */
  beforeSparring: boolean;
  sessions: MoveSessionChoice[];
};

function nextPlanWeekday(day: PlanWeekday): PlanWeekday {
  const index = WEEKDAYS.indexOf(day);
  return WEEKDAYS[(index + 1) % WEEKDAYS.length];
}

/** Days in the viewed week, with the workouts already sitting on each one. */
export function moveDayChoices(
  prefs: PlannerPrefs,
  now: Date,
  timeZone: string,
  weekAnchor: Date,
  swaps: WeekPlanSwap[],
  titles?: Partial<Record<PlanWeekday, MoveListedSession[]>>,
): MoveDayChoice[] {
  const strip = weekStrip(prefs, now, timeZone, undefined, swaps, weekAnchor);
  const plans = strip.map((day) => planForDate(prefs, day.date, timeZone, swaps));
  const sparring = new Set(
    plans.filter((plan) => plan.outside?.kind === "sparring").map((plan) => plan.weekday),
  );
  return strip.map((day, index) => {
    const plan = plans[index]!;
    const named = titles?.[day.weekday] ?? [];
    const fromPlan: MoveSessionChoice[] = plan.sessions
      .filter((session) => session.kind !== "rest" && session.sessionKey)
      .map((session) => ({
        sessionKey: session.sessionKey!,
        title: session.label,
        heavy: Boolean(session.heavy),
        completed: false,
      }));
    const listed = named.filter((session) => session.sessionKey && session.title.trim());
    const sessions =
      listed.length > 0
        ? listed.map((session) => {
            const planned = fromPlan.find((row) => row.sessionKey === session.sessionKey);
            return {
              sessionKey: session.sessionKey!,
              title: session.title.trim(),
              heavy: session.heavy ?? planned?.heavy ?? false,
              completed: Boolean(session.completed),
            };
          })
        : fromPlan;
    const lines =
      named.length > 0
        ? named.map((session) => session.title.trim()).filter(Boolean)
        : fromPlan.map((session) => session.title);
    return {
      weekday: day.weekday,
      label: day.isToday ? `Today · ${day.weekday}` : `${day.weekday} ${day.dateLabel}`,
      detail: lines.length > 0 ? lines.join(" · ") : plan.outside?.kind === "sparring" ? "Sparring" : "Open",
      isToday: day.isToday,
      isPast: day.isPast,
      outside: plan.outside?.kind ?? null,
      beforeSparring: sparring.has(nextPlanWeekday(day.weekday)),
      sessions,
    };
  });
}

export function corePlanCopy(prefs: { goalKey?: string; primaryFocus?: string }) {
  const focus = prefs.primaryFocus;
  if (focus && focus !== "general-fitness") {
    return "Core week plan from your intake — weights, conditioning, and mobility on set weekdays. Each train session keeps a short warm-up and cooldown. Bag work is separate. Not Elite or fight-camp coaching.";
  }
  return "Core week plan — weights, conditioning, and mobility on set weekdays. Each train session keeps a short warm-up and cooldown. Bag work is separate. Not Elite or fight-camp coaching.";
}
