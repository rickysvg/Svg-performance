import { prisma } from "@/lib/prisma";
import { PLAN_CATALOG, normalizePlanId, type CatalogPlanId } from "@/lib/plans";
import { COACHING_CAP } from "@/lib/pricing";
import { isTrialActive } from "@/lib/trial";
import {
  difficultyLabel,
  tooEasyCoachNote,
  tooEasyStreak,
} from "@/lib/difficulty";
import { parseFlagsJson } from "@/lib/weekly-checkin-shared";
import { parseOutsideTraining } from "@/lib/member-plan";
import { parseWeekPlanSwaps } from "@/lib/week-plan-swaps";
import { planForDate } from "@/lib/week-plan";
import { buildTrainingStreak, plannerPrefsFromProfile, type WeekStreakDot } from "@/lib/streaks";
import { civilDayInstant } from "@/lib/performed-at";
import { APP_TIMEZONE, addZonedDays, isValidTimeZone, mondayOfZoned } from "@/lib/timezone";

/** Admin-only counter. Never render this on a public page. */
export const FOUNDING_DEAL_CAP = 40;

export function foundingDeal(claimed: number) {
  const seats = Number.isFinite(claimed) ? Math.max(0, Math.floor(claimed)) : 0;
  return {
    claimed: seats,
    cap: FOUNDING_DEAL_CAP,
    remaining: Math.max(0, FOUNDING_DEAL_CAP - seats),
  };
}

export function coachingDesk(used: number) {
  const seats = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
  return {
    used: seats,
    cap: COACHING_CAP,
    remaining: Math.max(0, COACHING_CAP - seats),
    full: seats >= COACHING_CAP,
  };
}

export function memberPlanSnapshot(input: {
  now?: Date;
  plan: string | null;
  status: string | null;
  periodEnd: Date | null;
  verified: boolean;
  trialEndsAt: Date | null;
}) {
  const now = input.now ?? new Date();
  const subLive =
    input.status === "active" && (!input.periodEnd || input.periodEnd.getTime() >= now.getTime());
  if (subLive && input.plan) {
    const planId = normalizePlanId(input.plan);
    if (planId !== "member_access" && planId !== "academy") {
      return {
        planId,
        label: PLAN_CATALOG[planId].label,
        academy: input.verified,
        trial: false,
      };
    }
  }
  if (isTrialActive(input.trialEndsAt, now)) {
    return {
      planId: "performance" as CatalogPlanId,
      label: "Pro trial",
      academy: input.verified,
      trial: true,
    };
  }
  if (input.verified) {
    return {
      planId: "academy" as CatalogPlanId,
      label: PLAN_CATALOG.academy.label,
      academy: true,
      trial: false,
    };
  }
  return {
    planId: "member_access" as CatalogPlanId,
    label: "No plan",
    academy: false,
    trial: false,
  };
}

type SubRow = {
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
};

type ProfileRow = {
  userId: string;
  trialEndsAt: Date | null;
  trialStartedAt: Date | null;
};

function liveSub(row: SubRow, now: Date) {
  return row.status === "active" && (!row.currentPeriodEnd || row.currentPeriodEnd.getTime() >= now.getTime());
}

export function revenueSnapshot(input: {
  now?: Date;
  subscriptions: SubRow[];
  profiles: ProfileRow[];
}) {
  const now = input.now ?? new Date();
  const active = input.subscriptions.filter((row) => liveSub(row, now));
  const proUsers = new Set(
    active.filter((row) => normalizePlanId(row.plan) === "performance").map((row) => row.userId),
  );
  const paidUsers = new Set(
    active
      .filter((row) => {
        const planId = normalizePlanId(row.plan);
        return planId !== "member_access" && planId !== "academy";
      })
      .map((row) => row.userId),
  );
  let trials = 0;
  let conversions = 0;
  for (const profile of input.profiles) {
    const paid = paidUsers.has(profile.userId);
    if (isTrialActive(profile.trialEndsAt, now) && !paid) trials += 1;
    if (profile.trialStartedAt && paid) conversions += 1;
  }
  return {
    activePro: proUsers.size,
    trials,
    conversions,
    empty: proUsers.size === 0 && trials === 0 && conversions === 0,
  };
}

export function formatAdminWhen(date: Date | null, now = new Date()) {
  if (!date) return "No activity yet";
  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function memberMatchesQuery(member: { name: string; email: string }, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle);
}

function stringList(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const memberInclude = {
  profile: true,
  subscriptions: { orderBy: { updatedAt: "desc" as const }, take: 1 },
  sessions: { orderBy: { createdAt: "desc" as const }, take: 1, select: { createdAt: true } },
  workoutSessions: {
    where: { status: "complete" },
    select: { performedAt: true },
    orderBy: { performedAt: "desc" as const },
  },
};

type MemberRecord = Awaited<ReturnType<typeof loadMemberRows>>[number];

async function loadMemberRows() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: memberInclude,
  });
}

export type AdminWeekDay = WeekStreakDot & { title: string };

export type AdminMemberCard = {
  id: string;
  email: string;
  name: string;
  role: string;
  planLabel: string;
  academy: boolean;
  trial: boolean;
  lastActive: Date | null;
  lastActiveLabel: string;
  streak: number;
  week: AdminWeekDay[];
  verified: boolean;
  override: string;
  overrideNote: string;
  currentPlan: CatalogPlanId;
};

function presentMember(user: MemberRecord, now: Date, withTitles: boolean): AdminMemberCard {
  const profile = user.profile;
  const sub = user.subscriptions[0] ?? null;
  const plan = memberPlanSnapshot({
    now,
    plan: sub?.plan ?? null,
    status: sub?.status ?? null,
    periodEnd: sub?.currentPeriodEnd ?? null,
    verified: Boolean(profile?.gymMembershipVerified),
    trialEndsAt: profile?.trialEndsAt ?? null,
  });
  const tz =
    profile?.timeZone && isValidTimeZone(profile.timeZone) ? profile.timeZone : APP_TIMEZONE;
  const prefs = plannerPrefsFromProfile({
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: stringList(profile?.weeklyAvailabilityJson ?? "[]"),
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek ?? null,
    experienceLevel: profile?.experienceLevel,
    email: user.email,
    outsideTraining: parseOutsideTraining(profile?.outsideTrainingJson),
    onboardingCompletedAt: profile?.onboardingCompletedAt ?? null,
  });
  const streak = buildTrainingStreak({
    completedDates: user.workoutSessions.map((row) => civilDayInstant(row.performedAt, tz)),
    prefs,
    now,
    timeZone: tz,
  });
  const swaps = parseWeekPlanSwaps(profile?.weekPlanSwapsJson);
  const monday = mondayOfZoned(now, tz);
  const week: AdminWeekDay[] = streak.weekDots.map((dot, index) => {
    if (!withTitles) {
      return { ...dot, title: dot.scheduled ? "Train" : "Rest" };
    }
    const plan = planForDate(prefs, addZonedDays(monday, index, tz), tz, swaps);
    const titles = plan.sessions.map((session) => session.title || session.label).filter(Boolean);
    return { ...dot, title: titles.slice(0, 2).join(" · ") || (plan.active ? "Train" : "Rest") };
  });
  const stamps = [user.sessions[0]?.createdAt, user.workoutSessions[0]?.performedAt].filter(
    (value): value is Date => value instanceof Date,
  );
  stamps.sort((a, b) => b.getTime() - a.getTime());
  const lastActive = stamps[0] ?? null;
  return {
    id: user.id,
    email: user.email,
    name: profile?.displayName?.trim() || user.email,
    role: user.role,
    planLabel: plan.label,
    academy: plan.academy,
    trial: plan.trial,
    lastActive,
    lastActiveLabel: formatAdminWhen(lastActive, now),
    streak: streak.current,
    week,
    verified: Boolean(profile?.gymMembershipVerified),
    override: profile?.gymMembershipOverride ?? "none",
    overrideNote: profile?.gymMembershipOverrideNote ?? "",
    currentPlan: sub ? normalizePlanId(sub.plan) : "member_access",
  };
}

export async function listAdminMembers(query = "", now = new Date()) {
  const rows = await loadMemberRows();
  return rows
    .map((row) => presentMember(row, now, false))
    .filter((row) => memberMatchesQuery(row, query));
}

export async function getAdminMember(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: memberInclude,
  });
  if (!user) return null;
  return presentMember(user, now, true);
}

export async function listCoachingRoster(now = new Date()) {
  const subs = await prisma.subscription.findMany({
    where: { status: "active" },
    include: {
      user: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const rows: { userId: string; email: string; name: string; since: Date }[] = [];
  for (const sub of subs) {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) continue;
    if (normalizePlanId(sub.plan) !== "coaching") continue;
    if (seen.has(sub.userId)) continue;
    seen.add(sub.userId);
    rows.push({
      userId: sub.user.id,
      email: sub.user.email,
      name: sub.user.profile?.displayName?.trim() || sub.user.email,
      since: sub.createdAt,
    });
  }
  return { ...coachingDesk(rows.length), rows };
}

export async function getFoundingDeal() {
  const rows = await prisma.subscription.findMany({
    where: { status: "active", founding: true },
    include: {
      user: { select: { email: true, profile: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return {
    ...foundingDeal(rows.length),
    rows: rows.map((row) => ({
      email: row.user.email,
      name: row.user.profile?.displayName?.trim() || row.user.email,
      plan: normalizePlanId(row.plan),
    })),
  };
}

export async function getRevenueDesk(now = new Date()) {
  const [subscriptions, profiles] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { email: true, profile: { select: { displayName: true } } } },
      },
    }),
    prisma.profile.findMany({
      select: {
        userId: true,
        displayName: true,
        trialEndsAt: true,
        trialStartedAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);
  const snapshot = revenueSnapshot({ now, subscriptions, profiles });
  const paid = new Set(
    subscriptions
      .filter((row) => liveSub(row, now))
      .filter((row) => {
        const planId = normalizePlanId(row.plan);
        return planId !== "member_access" && planId !== "academy";
      })
      .map((row) => row.userId),
  );
  const pro = subscriptions.filter(
    (row) => liveSub(row, now) && normalizePlanId(row.plan) === "performance",
  );
  const seen = new Set<string>();
  const activeProRows = pro.filter((row) => {
    if (seen.has(row.userId)) return false;
    seen.add(row.userId);
    return true;
  });
  const trials = profiles.filter(
    (row) => isTrialActive(row.trialEndsAt, now) && !paid.has(row.userId),
  );
  return {
    ...snapshot,
    wired: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    activeProRows: activeProRows.map((row) => ({
      email: row.user.email,
      name: row.user.profile?.displayName?.trim() || row.user.email,
    })),
    trialRows: trials.map((row) => ({
      email: row.user.email,
      name: row.displayName?.trim() || row.user.email,
      ends: row.trialEndsAt,
    })),
  };
}

export async function getContentDesk() {
  const [exercises, lessons] = await Promise.all([
    prisma.programExercise.findMany({
      where: { formVideoPending: true },
      select: { name: true },
    }),
    prisma.lesson.findMany({
      where: { OR: [{ videoPending: true }, { youtubeUrl: "" }] },
      select: { id: true, title: true, status: true },
      orderBy: { title: "asc" },
    }),
  ]);
  const formVideos = [...new Set(exercises.map((row) => row.name))].sort((a, b) =>
    a.localeCompare(b),
  );
  return { formVideos, lessons };
}

export type SessionFeelFlag = {
  userId: string;
  name: string;
  label: string;
  detail: string;
};

export async function listSessionFeel(now = new Date()) {
  const since = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
  const rows = await prisma.workoutSession.findMany({
    where: { status: "complete", difficultyRating: { not: "" }, performedAt: { gte: since } },
    orderBy: { performedAt: "desc" },
    take: 120,
    select: {
      id: true,
      userId: true,
      title: true,
      difficultyRating: true,
      performedAt: true,
      user: { select: { email: true, profile: { select: { displayName: true } } } },
    },
  });
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  const flags: SessionFeelFlag[] = [];
  for (const [userId, list] of byUser) {
    const name = list[0]?.user.profile?.displayName?.trim() || list[0]?.user.email || "Member";
    const note = tooEasyCoachNote(tooEasyStreak(list));
    if (note) flags.push({ userId, name, label: "Too easy", detail: note });
    const hard = list.find(
      (row) => row.difficultyRating === "extremely_difficult" || row.difficultyRating === "very_hard",
    );
    if (hard) {
      flags.push({
        userId,
        name,
        label: difficultyLabel(hard.difficultyRating) || "Hard",
        detail: hard.title,
      });
    }
  }
  return {
    flags,
    recent: rows.slice(0, 12).map((row) => ({
      id: row.id,
      name: row.user.profile?.displayName?.trim() || row.user.email,
      title: row.title,
      label: difficultyLabel(row.difficultyRating) || "Rated",
      when: formatAdminWhen(row.performedAt, now),
      hard: row.difficultyRating === "extremely_difficult" || row.difficultyRating === "very_hard",
    })),
  };
}

export async function getAdminDeskCounts(now = new Date()) {
  const since = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
  const [formChecks, checkInRows, members, subs, feedbackNew, feelRows, exercises, profiles] =
    await Promise.all([
      prisma.formCheck.count({ where: { status: { not: "reviewed" } } }),
      prisma.weeklyCheckIn.findMany({
        where: { coachStatus: "pending" },
        select: { aiFlagsJson: true },
      }),
      prisma.user.count({ where: { role: "member" } }),
      prisma.subscription.findMany({
        where: { status: "active" },
        select: {
          userId: true,
          plan: true,
          status: true,
          currentPeriodEnd: true,
          founding: true,
        },
      }),
      prisma.memberFeedback.count({ where: { status: "new" } }),
      prisma.workoutSession.findMany({
        where: {
          status: "complete",
          difficultyRating: { not: "" },
          performedAt: { gte: since },
        },
        orderBy: { performedAt: "desc" },
        take: 120,
        select: { userId: true, difficultyRating: true, performedAt: true },
      }),
      prisma.programExercise.findMany({
        where: { formVideoPending: true },
        select: { name: true },
      }),
      prisma.profile.findMany({
        select: { userId: true, trialEndsAt: true, trialStartedAt: true },
      }),
    ]);

  const coachingUsers = new Set<string>();
  let foundingClaimed = 0;
  for (const sub of subs) {
    if (sub.founding) foundingClaimed += 1;
    if (!liveSub(sub, now)) continue;
    if (normalizePlanId(sub.plan) === "coaching") coachingUsers.add(sub.userId);
  }
  const coaching = coachingDesk(coachingUsers.size);
  const founding = foundingDeal(foundingClaimed);
  const revenue = revenueSnapshot({ now, subscriptions: subs, profiles });
  const checkInFlags = checkInRows.filter((row) => parseFlagsJson(row.aiFlagsJson).length > 0).length;
  const byUser = new Map<string, { difficultyRating: string; performedAt: Date }[]>();
  for (const row of feelRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  let feelFlags = 0;
  for (const list of byUser.values()) {
    if (tooEasyCoachNote(tooEasyStreak(list))) feelFlags += 1;
    if (
      list.some(
        (row) =>
          row.difficultyRating === "extremely_difficult" || row.difficultyRating === "very_hard",
      )
    ) {
      feelFlags += 1;
    }
  }

  return {
    formChecks,
    checkIns: checkInRows.length,
    checkInFlags,
    members,
    coachingUsed: coaching.used,
    coachingCap: coaching.cap,
    coachingFull: coaching.full,
    foundingClaimed: founding.claimed,
    foundingCap: founding.cap,
    foundingRemaining: founding.remaining,
    activePro: revenue.activePro,
    trials: revenue.trials,
    conversions: revenue.conversions,
    feedbackNew,
    feelFlags,
    pendingVideos: new Set(exercises.map((row) => row.name)).size,
  };
}
