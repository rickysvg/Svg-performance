import { WEEKDAYS } from "@/lib/constants";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";

export const CORE_DEFAULT_TRAINING_DAYS = ["Monday", "Wednesday", "Friday"] as const;

/** El Paso / SVG. Planner weekdays use this zone so hosted UTC boxes match Ricky’s week. */
export const APP_TIMEZONE = "America/Denver";

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

export function weekdayInAppZone(date: Date): PlanWeekday {
  // Same civil weekday as Home / nutrition (`startOfLocalDay`). America/Denver
  // is the gym zone; hosted UTC can flip after evening in El Paso — same limit
  // as the rest of the app until a later timezone pass.
  return JS_WEEKDAYS[date.getDay()] ?? "Monday";
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

function thursdaySkillSlot(focus: string): PlanSessionSlot {
  if (focus === "boxing") {
    return {
      kind: "skill",
      label: "Second striking block",
      programSlug: DEMO_SKILL_PROGRAM_SLUG,
      dayNumber: 3,
    };
  }
  if (focus === "muay-thai") {
    return {
      kind: "skill",
      label: "Bag / pads (second block)",
      programSlug: DEMO_SKILL_PROGRAM_SLUG,
      dayNumber: 2,
    };
  }
  if (focus === "jiu-jitsu") {
    return {
      kind: "skill",
      label: "Grappling / ground",
      programSlug: DEMO_SKILL_PROGRAM_SLUG,
      dayNumber: 6,
    };
  }
  if (focus === "wrestling") {
    return {
      kind: "skill",
      label: "Grappling / ground",
      programSlug: DEMO_SKILL_PROGRAM_SLUG,
      dayNumber: 5,
    };
  }
  return {
    kind: "skill",
    label: "Grappling / ground",
    programSlug: DEMO_SKILL_PROGRAM_SLUG,
    dayNumber: 4,
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
export function coreSkeletonSessions(weekday: PlanWeekday, focus?: string | null): PlanSessionSlot[] {
  const art = focus ?? "";
  const striking = isStrikingFocus(art);
  const grappling = isGrapplingFocus(art);

  if (weekday === "Monday") {
    const sessions: PlanSessionSlot[] = [];
    if (striking) {
      sessions.push(skillSlot(bagDayNumber(art, "power"), "Bag / striking"));
    }
    sessions.push(strengthSlot(2, "Strength — push / upper"));
    return sessions;
  }

  if (weekday === "Tuesday") {
    if (striking) {
      return [skillSlot(bagDayNumber(art, "technique"), "Skill technique (lighter)")];
    }
    return [{ kind: "mobility", label: "Active recovery / mobility" }];
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
    if (grappling || striking) {
      return [thursdaySkillSlot(art)];
    }
    return [{ kind: "rest", label: "Rest / skip" }];
  }

  if (weekday === "Friday") {
    return [
      strengthSlot(3, "Conditioning", "conditioning"),
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
  if (kinds.includes("conditioning") && kinds.includes("strength")) return "Cond+Lift";
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

export function buildCoreWeekPlan(prefs: PlannerPrefs): Record<PlanWeekday, DayPlan> {
  const activeDays = resolveTrainingDays(prefs);
  const focus = prefs.primaryFocus ?? "";
  const plan = {} as Record<PlanWeekday, DayPlan>;

  for (const weekday of WEEKDAYS) {
    const optionalDay = weekday === "Saturday";
    const active = weekday === "Sunday" ? false : activeDays.has(weekday);
    const sessions = coreSkeletonSessions(weekday, focus);
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

export function planForDate(prefs: PlannerPrefs, date: Date): DayPlan {
  const weekday = weekdayInAppZone(date);
  return buildCoreWeekPlan(prefs)[weekday];
}

export function nextActiveWeekday(prefs: PlannerPrefs, from: Date): PlanWeekday | null {
  const plan = buildCoreWeekPlan(prefs);
  for (let offset = 1; offset <= 7; offset += 1) {
    const cursor = new Date(from.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = weekdayInAppZone(cursor);
    if (plan[weekday].active) return weekday;
  }
  return null;
}

export function weekStrip(prefs: PlannerPrefs, now = new Date()) {
  const today = weekdayInAppZone(now);
  const plan = buildCoreWeekPlan(prefs);
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
