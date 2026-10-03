import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getShareCardView } from "@/lib/share-card-data";
import { getProfileForUser } from "@/lib/profile";
import { detectNewPrsForSession, evaluateBadgesForUser } from "@/lib/progress-companion";
import { parseUnlockQuery } from "@/lib/badge-unlocks";
import {
  formatWorkoutCompleteDate,
  sessionOrdinal,
  workoutCompleteShareStats,
  workoutCompleteTiles,
} from "@/lib/workout-complete";
import { WorkoutWinScreen } from "@/components/training/WorkoutWinScreen";
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
  const unit = profile?.preferredUnits ?? "lb";
  const [prs, completeIds, badges] = await Promise.all([
    detectNewPrsForSession(user.id, sessionId, unit),
    prisma.workoutSession.findMany({
      where: { userId: user.id, status: "complete" },
      select: { id: true },
      orderBy: { performedAt: "asc" },
    }),
    evaluateBadgesForUser(user.id, unit),
  ]);
  const unlockIds = parseUnlockQuery(query.pendingUnlock ?? query.unlock);
  const firstBadge = unlockIds
    .map((id) => badges.find((row) => row.id === id))
    .find((row) => Boolean(row));
  const tiles = workoutCompleteTiles({
    session: view.session,
    displayUnit: unit,
    newPrCount: prs.length,
  });

  return (
    <main className="min-h-[50vh]">
      <WorkoutWinScreen
        dateLine={formatWorkoutCompleteDate(view.session.performedAt, profile?.timeZone ?? undefined)}
        sessionNumber={sessionOrdinal(
          sessionId,
          completeIds.map((row) => row.id),
        )}
        tiles={tiles}
        shareTitle={view.session.title}
        shareStats={workoutCompleteShareStats(tiles)}
        badgeTitle={firstBadge?.title ?? null}
        unit={unit}
        workoutId={sessionId}
        difficultyRating={view.session.difficultyRating}
      />
    </main>
  );
}
