import { prisma } from "@/lib/prisma";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { selectShareStats, workoutStreakDays } from "@/lib/share-card";

export async function getShareCardView(userId: string, sessionId: string) {
  const session = await getOwnWorkoutSessionOrNull(sessionId, userId);
  if (!session || session.status !== "complete") {
    return null;
  }
  const profile = await getProfileForUser(userId);
  const displayUnit: LoadUnit = isLoadUnit(profile?.preferredUnits ?? "")
    ? (profile?.preferredUnits as LoadUnit)
    : "lb";
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const dates = await prisma.workoutSession.findMany({
    where: { userId, status: "complete" },
    select: { performedAt: true },
  });
  const streakDays = workoutStreakDays(
    dates.map((row) => row.performedAt),
    new Date(),
    tz,
  );
  return {
    session,
    displayUnit,
    stats: selectShareStats({
      session,
      displayUnit,
      streakDays,
    }),
    streakDays,
  };
}
