import { loggedSetSome, sessionHasLoggedWork, sessionOpensFinishScreen } from "@/lib/logged-work";
import { prisma } from "@/lib/prisma";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";
import { APP_LOAD_UNIT, type LoadUnit } from "@/lib/units";
import { selectShareStats, workoutStreakDays } from "@/lib/share-card";

export async function getShareCardView(userId: string, sessionId: string) {
  const session = await getOwnWorkoutSessionOrNull(sessionId, userId);
  if (!session || !sessionOpensFinishScreen(session) || !sessionHasLoggedWork(session.sets)) {
    return null;
  }
  const profile = await getProfileForUser(userId);
  const displayUnit: LoadUnit = APP_LOAD_UNIT;
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const dates = await prisma.workoutSession.findMany({
    where: { userId, status: "complete", sets: loggedSetSome },
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
