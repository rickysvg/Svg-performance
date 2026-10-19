import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getShareCardView } from "@/lib/share-card-data";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { civilDayInstant } from "@/lib/performed-at";
import { memberFacingTitle } from "@/lib/member-copy";
import { detectNewPrsForSession, evaluateBadgesForUser, newPrExerciseCount } from "@/lib/progress-companion";
import { parseUnlockQuery } from "@/lib/badge-unlocks";
import {
  formatWorkoutCompleteDate,
  sameDaySessionOrdinal,
  workoutCompleteShareStats,
  workoutCompleteTiles,
} from "@/lib/workout-complete";
import { omitSwapFirstMarks } from "@/lib/personal-bests";
import { WorkoutWinScreen } from "@/components/training/WorkoutWinScreen";
import { buildSessionSummary, summaryExercises } from "@/lib/session-summary";
import { loggedSetSome } from "@/lib/logged-work";
import { prisma } from "@/lib/prisma";

export default async function WorkoutDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ unlock?: string; pendingUnlock?: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const query = await searchParams;
  const view = await getShareCardView(user.id, sessionId);
  if (!view) notFound();
  const profile = await getProfileForUser(user.id);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const unit = profile?.preferredUnits ?? "lb";
  const [detected, completeRows, badges, swaps] = await Promise.all([
    detectNewPrsForSession(user.id, sessionId, unit),
    prisma.workoutSession.findMany({
      where: { userId: user.id, status: "complete", sets: loggedSetSome },
      select: { id: true, performedAt: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),
    evaluateBadgesForUser(user.id, unit),
    prisma.exerciseSwap.findMany({
      where: { userId: user.id, workoutSessionId: sessionId },
      select: { replacementName: true },
    }),
  ]);
  const prs = omitSwapFirstMarks(
    detected,
    swaps.map((row) => row.replacementName),
  );
  const unlockIds = parseUnlockQuery(query.pendingUnlock ?? query.unlock);
  const firstBadge = unlockIds
    .map((id) => badges.find((row) => row.id === id))
    .find((row) => Boolean(row));
  const tiles = workoutCompleteTiles({
    session: view.session,
    displayUnit: unit,
    newPrCount: newPrExerciseCount(prs),
  });

  return (
    <main className="min-h-[50vh]">
      <WorkoutWinScreen
        dateLine={formatWorkoutCompleteDate(civilDayInstant(view.session.performedAt, tz), tz)}
        sessionNumber={sameDaySessionOrdinal(sessionId, completeRows, tz)}
        tiles={tiles}
        shareTitle={memberFacingTitle(view.session.title)}
        shareStats={workoutCompleteShareStats(tiles)}
        badgeTitle={firstBadge?.title ?? null}
        unit={unit}
        workoutId={sessionId}
        difficultyRating={view.session.difficultyRating}
        summary={buildSessionSummary({
          title: memberFacingTitle(view.session.title),
          programDayTitle: view.session.programDay?.title,
          programDayFocus: view.session.programDay?.focus,
          exercises: summaryExercises(view.session),
        })}
      />
    </main>
  );
}
