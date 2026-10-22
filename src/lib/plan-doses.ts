import { cache } from "react";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { campPlanWeekIndex, getActiveCampSnapshot, type CampPhase } from "@/lib/fight-camp";
import { planWeekIndex } from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { prescribedSetTotal } from "@/lib/logged-work";
import { dayKey, mondayOfZoned } from "@/lib/timezone";

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

type MemberScaleBundle = {
  catalog: Awaited<ReturnType<typeof findDemoTrainingCatalog>>;
  profile: Awaited<ReturnType<typeof getProfileForUser>>;
  tz: string;
};

async function loadMemberScaleBundle(userId: string): Promise<MemberScaleBundle> {
  const [catalog, profile] = await Promise.all([
    findDemoTrainingCatalog(),
    getProfileForUser(userId),
  ]);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  return { catalog, profile, tz };
}

const bundleSlot = cache((userId: string) => {
  return { current: null as Promise<MemberScaleBundle> | null };
});

const bundleJoining = new Map<string, Promise<MemberScaleBundle>>();

/**
 * React `cache` keeps a slot for the request. Unit tests call through, so a
 * settled map covers that case and `clearCalendarScaleCache` drops it.
 * A real request does not write the map, so nothing sticks to the process.
 */
const memoryProbe = cache(() => ({ mark: true as const }));

function requestCacheRemembers() {
  return memoryProbe() === memoryProbe();
}

const settledBundles = new Map<string, Promise<MemberScaleBundle>>();

function memberScaleBundle(userId: string) {
  const slot = bundleSlot(userId);
  if (slot.current) return slot.current;
  const remembered = requestCacheRemembers();
  if (!remembered) {
    const saved = settledBundles.get(userId);
    if (saved) return saved;
  }
  const pendingJoin = bundleJoining.get(userId);
  if (pendingJoin) {
    slot.current = pendingJoin;
    return pendingJoin;
  }
  const pending = loadMemberScaleBundle(userId).then(
    (value) => value,
    (error: unknown) => {
      if (slot.current === pending) slot.current = null;
      if (settledBundles.get(userId) === pending) settledBundles.delete(userId);
      bundleJoining.delete(userId);
      throw error;
    },
  );
  void pending.then(
    () => {
      bundleJoining.delete(userId);
    },
    () => {
      bundleJoining.delete(userId);
    },
  );
  slot.current = pending;
  if (!remembered) settledBundles.set(userId, pending);
  bundleJoining.set(userId, pending);
  return pending;
}

async function loadCalendarScaleContext(userId: string, now: Date, bundle: MemberScaleBundle) {
  scaleLoads += 1;
  const camp = await getActiveCampSnapshot(userId, now, bundle.tz);
  const scaled = calendarScaledCatalog(bundle.catalog, {
    experienceLevel: bundle.profile?.experienceLevel,
    competitionStatus: bundle.profile?.competitionStatus,
    weightAccess: bundle.profile?.weightAccess,
    onboardingCompletedAt: bundle.profile?.onboardingCompletedAt ?? null,
    now,
    timeZone: bundle.tz,
    camp,
  });
  return {
    profile: bundle.profile,
    tz: bundle.tz,
    camp,
    campWeek: campPlanWeekIndex(camp),
    strength: scaled.strength,
    skill: scaled.skill,
    planByDay: scaledPlanByProgramDay(scaled),
  };
}

type CalendarScaleContext = Awaited<ReturnType<typeof loadCalendarScaleContext>>;

/**
 * Request-scoped slot, one per member per plan week. React `cache` remembers
 * the slot for this render and does not keep a failed load: the catch below
 * clears it. Outside a request (unit tests) `cache` calls through, so a
 * settled map keeps the week until `clearCalendarScaleCache`. A real request
 * leaves that map empty.
 */
const scaleSlot = cache((userId: string, weekKey: string) => {
  return { current: null as Promise<CalendarScaleContext> | null };
});

const joining = new Map<string, Promise<CalendarScaleContext>>();
const settledWeeks = new Map<string, Promise<CalendarScaleContext>>();

/** Drop an in-flight join. Tests call this between cases so a profile edit is visible. */
export function clearCalendarScaleCache() {
  joining.clear();
  bundleJoining.clear();
  settledWeeks.clear();
  settledBundles.clear();
}

/**
 * Scaled catalog for the week that contains `now`. A past session passes its
 * own performed date, so a deload or camp week is not judged on today.
 * Callers in the same week share one load.
 */
export function calendarScaleContext(userId: string, now = new Date()) {
  return memberScaleBundle(userId).then((bundle) => {
    const weekKey = dayKey(mondayOfZoned(now, bundle.tz), bundle.tz);
    const key = `${userId}:${weekKey}`;
    const slot = scaleSlot(userId, weekKey);
    if (slot.current) return slot.current;
    const remembered = requestCacheRemembers();
    if (!remembered) {
      const saved = settledWeeks.get(key);
      if (saved) return saved;
    }
    const pendingJoin = joining.get(key);
    if (pendingJoin) {
      slot.current = pendingJoin;
      return pendingJoin;
    }
    const pending = loadCalendarScaleContext(userId, now, bundle).then(
      (value) => value,
      (error: unknown) => {
        if (slot.current === pending) slot.current = null;
        if (settledWeeks.get(key) === pending) settledWeeks.delete(key);
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
    if (!remembered) settledWeeks.set(key, pending);
    joining.set(key, pending);
    return pending;
  });
}

/** Scaled dose for each program day, using the calendar's scale. */
export async function calendarPlanDoses(userId: string, now = new Date()) {
  const scale = await calendarScaleContext(userId, now);
  return scale.planByDay;
}
