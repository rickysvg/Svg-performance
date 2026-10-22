import { prisma } from "@/lib/prisma";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { campPlanWeekIndex, getActiveCampSnapshot, type CampPhase } from "@/lib/fight-camp";
import { planWeekIndex } from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { prescribedSetTotal } from "@/lib/logged-work";

export type ScaledDayPlan = {
  dose: number;
  names: readonly string[];
};

type CalendarScaleInput = {
  experienceLevel?: string | null;
  competitionStatus?: string | null;
  weightAccess?: string | null;
  onboardingCompletedAt?: Date | null;
  now: Date;
  timeZone: string;
  camp: { weekNumber: number | null; phase: CampPhase } | null;
};

/**
 * Set totals on the scaled catalog the calendar renders.
 * Program day ids stay the same. The dose does not.
 */
export function scaledPlanByProgramDay(catalog: {
  strength?: { days: { id?: string; exercises?: { name?: string | null; sets?: number | null }[] }[] } | null;
  skill?: { days: { id?: string; exercises?: { name?: string | null; sets?: number | null }[] }[] } | null;
}) {
  const plans = new Map<string, ScaledDayPlan>();
  for (const program of [catalog.strength, catalog.skill]) {
    for (const day of program?.days ?? []) {
      if (!day.id) continue;
      const dose = prescribedSetTotal(day.exercises);
      if (dose <= 0) continue;
      const names = (day.exercises ?? [])
        .map((exercise) => (exercise.name ?? "").trim())
        .filter((name) => name.length > 0);
      plans.set(day.id, { dose, names });
    }
  }
  return plans;
}

/** Same scale inputs the calendar schedule uses for set counts. */
export function calendarScaledCatalog<T extends Parameters<typeof scaleDemoCatalog>[0]>(
  catalog: T,
  input: CalendarScaleInput,
) {
  const campWeek = campPlanWeekIndex(input.camp);
  return scaleDemoCatalog(catalog, {
    experienceLevel: input.experienceLevel,
    competitionStatus: input.competitionStatus,
    weightAccess: input.weightAccess,
    weekIndex: campWeek ?? planWeekIndex(input.now, input.timeZone, input.onboardingCompletedAt ?? null),
    campPhase: input.camp && input.camp.phase !== "complete" ? input.camp.phase : null,
  });
}

let scaleLoads = 0;

/** How many times the scaled catalog was actually read. Parallel callers share one load. */
export function calendarScaleLoadCount() {
  return scaleLoads;
}

const inflight = new Map<string, ReturnType<typeof loadCalendarScaleContext>>();

function scaleKey(userId: string, now: Date) {
  return `${userId}:${Math.floor(now.getTime() / 1000)}`;
}

async function loadCalendarScaleContext(userId: string, now: Date) {
  scaleLoads += 1;
  const [catalog, profile] = await Promise.all([
    findDemoTrainingCatalog(),
    getProfileForUser(userId),
  ]);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const camp = await getActiveCampSnapshot(userId, now, tz);
  const campWeek = campPlanWeekIndex(camp);
  const scaled = calendarScaledCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
    now,
    timeZone: tz,
    camp,
  });
  return {
    profile,
    tz,
    camp,
    campWeek,
    strength: scaled.strength,
    skill: scaled.skill,
    planByDay: scaledPlanByProgramDay(scaled),
  };
}

/** Drop a cached catalog. Tests call this between cases so a profile edit is visible. */
export function clearCalendarScaleCache() {
  inflight.clear();
}

/**
 * One scaled catalog per member per second. Train, the calendar, and the
 * check-mark queries share it, so a page does not load the catalog again.
 */
export function calendarScaleContext(userId: string, now = new Date()) {
  const key = scaleKey(userId, now);
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = loadCalendarScaleContext(userId, now);
  inflight.set(key, pending);
  return pending;
}

/** Scaled dose for each program day, using the calendar's scale. */
export async function calendarPlanDoses(userId: string, now = new Date()) {
  const scale = await calendarScaleContext(userId, now);
  return scale.planByDay;
}
