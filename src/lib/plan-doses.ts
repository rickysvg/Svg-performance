import { cache } from "react";
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

type CalendarScaleContext = Awaited<ReturnType<typeof loadCalendarScaleContext>>;

/**
 * Request-scoped slot. React `cache` remembers the slot for this render and
 * does not keep a failed load: the catch below clears it. Outside a request
 * (unit tests) `cache` calls through, so `joining` only dedupes calls that
 * are already in flight and drops the entry when the load settles.
 */
const scaleSlot = cache((userId: string, bucket: number) => {
  return { current: null as Promise<CalendarScaleContext> | null };
});

const joining = new Map<string, Promise<CalendarScaleContext>>();

/** Drop an in-flight join. Tests call this between cases so a profile edit is visible. */
export function clearCalendarScaleCache() {
  joining.clear();
}

/**
 * One scaled catalog per member per request. Train, the calendar, and the
 * check-mark queries share it, so a page does not load the catalog again.
 */
export function calendarScaleContext(userId: string, now = new Date()) {
  const bucket = Math.floor(now.getTime() / 1000);
  const key = `${userId}:${bucket}`;
  const slot = scaleSlot(userId, bucket);
  if (slot.current) return slot.current;
  const pendingJoin = joining.get(key);
  if (pendingJoin) {
    slot.current = pendingJoin;
    return pendingJoin;
  }
  const pending = loadCalendarScaleContext(userId, now).then(
    (value) => value,
    (error: unknown) => {
      if (slot.current === pending) slot.current = null;
      joining.delete(key);
      throw error;
    },
  );
  void pending.then(
    () => {
      joining.delete(key);
    },
    () => {
      joining.delete(key);
    },
  );
  slot.current = pending;
  joining.set(key, pending);
  return pending;
}

/** Scaled dose for each program day, using the calendar's scale. */
export async function calendarPlanDoses(userId: string, now = new Date()) {
  const scale = await calendarScaleContext(userId, now);
  return scale.planByDay;
}
