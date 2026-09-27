import { prisma } from "@/lib/prisma";
import { monthKeyFrom, monthRange } from "@/lib/challenges";
import { APP_TIMEZONE } from "@/lib/timezone";

export const MONTHLY_WORKOUT_GOAL = 12;

export type LeaderboardScope = "all" | "academy";

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  initials: string;
  workouts: number;
  rank: number;
  isYou: boolean;
  academy: boolean;
};

export function isVerifiedAcademy(profile: {
  claimsGymMembership?: boolean | null;
  gymMembershipVerified?: boolean | null;
}) {
  return Boolean(profile.claimsGymMembership && profile.gymMembershipVerified);
}

export function publicDisplayName(displayName: string) {
  return displayName.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function displayInitials(displayName: string) {
  const parts = publicDisplayName(displayName).split(" ").filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Never include emails. Blank names stay off the public board. */
export function optedInPublicName(input: {
  leaderboardOptIn: boolean;
  displayName: string;
}) {
  if (!input.leaderboardOptIn) return null;
  const name = publicDisplayName(input.displayName);
  return name || null;
}

export function daysLeftInMonth(monthKey: string, now = new Date(), timeZone = APP_TIMEZONE) {
  const { end } = monthRange(monthKey, timeZone);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function countWorkoutsInMonth(
  userId: string,
  monthKey: string,
  timeZone = APP_TIMEZONE,
) {
  const { start, end } = monthRange(monthKey, timeZone);
  return prisma.workoutSession.count({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: start, lt: end },
    },
  });
}

export async function getMonthlyWorkoutChallenge(input: {
  userId: string;
  timeZone?: string;
  now?: Date;
}) {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const now = input.now ?? new Date();
  const monthKey = monthKeyFrom(now, timeZone);
  const workouts = await countWorkoutsInMonth(input.userId, monthKey, timeZone);
  const goal = MONTHLY_WORKOUT_GOAL;
  return {
    monthKey,
    title: monthTitle(monthKey),
    workouts,
    goal,
    complete: workouts >= goal,
    ratio: Math.min(1, workouts / goal),
    daysLeft: daysLeftInMonth(monthKey, now, timeZone),
  };
}

export function rankEntries(
  rows: Array<{
    userId: string;
    displayName: string;
    workouts: number;
    academy: boolean;
  }>,
  viewerId: string,
): LeaderboardEntry[] {
  const sorted = [...rows].sort(
    (a, b) => b.workouts - a.workouts || a.displayName.localeCompare(b.displayName),
  );
  return sorted.map((row, index) => ({
    userId: row.userId,
    displayName: row.displayName,
    initials: displayInitials(row.displayName),
    workouts: row.workouts,
    rank: index + 1,
    isYou: row.userId === viewerId,
    academy: row.academy,
  }));
}

export async function getWorkoutLeaderboard(input: {
  viewerId: string;
  scope?: LeaderboardScope;
  timeZone?: string;
  now?: Date;
}) {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const now = input.now ?? new Date();
  const monthKey = monthKeyFrom(now, timeZone);
  const { start, end } = monthRange(monthKey, timeZone);
  const scope = input.scope ?? "all";

  const profiles = await prisma.profile.findMany({
    where: { leaderboardOptIn: true },
    select: {
      userId: true,
      displayName: true,
      claimsGymMembership: true,
      gymMembershipVerified: true,
    },
  });

  const visible = profiles
    .map((row) => ({
      userId: row.userId,
      displayName: optedInPublicName({
        leaderboardOptIn: true,
        displayName: row.displayName,
      }),
      academy: isVerifiedAcademy(row),
    }))
    .filter((row): row is { userId: string; displayName: string; academy: boolean } =>
      Boolean(row.displayName),
    )
    .filter((row) => (scope === "academy" ? row.academy : true));

  const counts = await prisma.workoutSession.groupBy({
    by: ["userId"],
    where: {
      userId: { in: visible.map((row) => row.userId) },
      status: "complete",
      performedAt: { gte: start, lt: end },
    },
    _count: { _all: true },
  });
  const countByUser = new Map(counts.map((row) => [row.userId, row._count._all]));

  const entries = rankEntries(
    visible.map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      academy: row.academy,
      workouts: countByUser.get(row.userId) ?? 0,
    })),
    input.viewerId,
  );

  const you = entries.find((row) => row.isYou) ?? null;
  const viewerWorkouts = await countWorkoutsInMonth(input.viewerId, monthKey, timeZone);
  const nextAhead = you
    ? entries.find((row) => row.rank === you.rank - 1) ?? null
    : null;

  return {
    monthKey,
    scope,
    entries,
    podium: entries.slice(0, 3),
    you,
    viewerWorkouts,
    nextAhead,
    goal: MONTHLY_WORKOUT_GOAL,
  };
}
