import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getShareCardView } from "@/lib/share-card-data";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { civilDayInstant } from "@/lib/performed-at";
import { dayKey } from "@/lib/timezone";
import { memberFacingTitle } from "@/lib/member-copy";
import { defaultSavedWorkoutName } from "@/lib/my-workout-plan";
import { detectNewPrsForSession, evaluateBadgesForUser, newPrExerciseCount } from "@/lib/progress-companion";
import { parseUnlockQuery } from "@/lib/badge-unlocks";
import {
  formatWorkoutCompleteDate,
  sessionOrdinal,
  workoutCompleteShareStats,
  workoutCompleteTiles,
} from "@/lib/workout-complete";
import { WorkoutWinScreen } from "@/components/training/WorkoutWinScreen";
import { buildSessionSummary, summaryExercises } from "@/lib/session-summary";
import { loggedSetSome } from "@/lib/logged-work";
import { roundFinishProgress } from "@/lib/round-session";
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
  const [prs, completeIds, badges] = await Promise.all([
    detectNewPrsForSession(user.id, sessionId, unit),
    prisma.workoutSession.findMany({
      where: { userId: user.id, status: { in: ["complete", "partial"] }, sets: loggedSetSome },
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
    newPrCount: newPrExerciseCount(prs),
  });
  const performedKey = dayKey(view.session.performedAt, tz);
  const whenLabel =
    performedKey === dayKey(new Date(), tz)
      ? "Today"
      : view.session.performedAt.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: tz,
        });
  const summary = {
    ...buildSessionSummary({
      title: memberFacingTitle(view.session.title),
      programDayTitle: view.session.programDay?.title,
      programDayFocus: view.session.programDay?.focus,
      exercises: summaryExercises(view.session),
    }),
    whenLabel,
  };

  return (
    <main className="min-h-[50vh]">
      <WorkoutWinScreen
        dateLine={formatWorkoutCompleteDate(civilDayInstant(view.session.performedAt, tz), tz)}
        sessionNumber={sessionOrdinal(
          sessionId,
          completeIds.map((row) => row.id),
        )}
        tiles={tiles}
        shareTitle={memberFacingTitle(view.session.title)}
        shareStats={workoutCompleteShareStats(tiles)}
        badgeTitle={firstBadge?.title ?? null}
        unit={unit}
        workoutId={sessionId}
        difficultyRating={view.session.difficultyRating}
        savedWorkoutName={defaultSavedWorkoutName({
          title: view.session.title,
          date: view.session.performedAt,
          timeZone: tz,
        })}
        exerciseProgress={roundFinishProgress({
          plannedExercises: view.session.programDay?.exercises ?? [],
          sets: view.session.sets,
          plannedSetCount: view.session.plannedSetCount,
          status: view.session.status,
        }).filter((row) => row.ticked > 0 || row.planned > 0)}
        summary={summary}
        partial={view.session.status === "partial"}
      />
    </main>
  );
}
