import Link from "next/link";
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
import { loggedSetSome, sessionHasLoggedWork, sessionOpensFinishScreen } from "@/lib/logged-work";
import { sessionProgress } from "@/lib/session-progress";
import { calendarPlanDoses } from "@/lib/plan-doses";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";
import { prisma } from "@/lib/prisma";
import { visibleFinishDose } from "@/lib/finish-plan";
import { listSwapsForDay } from "@/lib/exercise-swap-store";
import { listRemovalsForDay, listRemovalsForSession } from "@/lib/exercise-removal-store";
import { trainingBlockKey, type SwapRecord } from "@/lib/exercise-swap";
import type { RemovalRecord } from "@/lib/exercise-removal";

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
  let owned = await getOwnWorkoutSessionOrNull(sessionId, user.id);
  if (!owned) owned = await getOwnWorkoutSessionOrNull(sessionId, user.id);
  if (!owned) notFound();
  if (owned.status === "partial" && !sessionHasLoggedWork(owned.sets)) {
    return (
      <main className="space-y-4 py-10" data-empty-partial>
        <p className="font-display text-xs uppercase tracking-[0.06em]">Session</p>
        <h1 className="text-3xl">Nothing logged yet</h1>
        <p className="text-sm text-muted">
          This partial session has no sets. Open it to log the first one, or leave it until you train.
        </p>
        <Link
          href={`/training/log/${sessionId}`}
          className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
        >
          Open the logger
        </Link>
      </main>
    );
  }
  let view = await getShareCardView(user.id, sessionId);
  if (!view && sessionOpensFinishScreen(owned) && sessionHasLoggedWork(owned.sets)) {
    view = await getShareCardView(user.id, sessionId);
  }
  if (!view) notFound();
  const profile = await getProfileForUser(user.id);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const doses = view.session.programDayId
    ? await calendarPlanDoses(user.id, view.session.performedAt)
    : null;
  const plan = view.session.programDayId ? doses?.get(view.session.programDayId) : undefined;
  const program = view.session.programDay;
  const baseExercises = (
    plan?.exercises && plan.exercises.length > 0
      ? plan.exercises
      : program?.exercises ?? []
  )
    .map((exercise) => ({
      name: (exercise.name ?? "").trim(),
      sets: Math.max(0, Math.round(exercise.sets ?? 0)),
    }))
    .filter((exercise) => exercise.name.length > 0);
  let swaps: SwapRecord[] = [];
  let removals: RemovalRecord[] = [];
  if (program) {
    [swaps, removals] = await Promise.all([
      listSwapsForDay({
        userId: user.id,
        programSlug: program.program.slug,
        dayNumber: program.dayNumber,
      }),
      listRemovalsForDay({
        userId: user.id,
        programSlug: program.program.slug,
        dayNumber: program.dayNumber,
      }),
    ]);
  } else {
    removals = await listRemovalsForSession(user.id, view.session.id);
  }
  const visible =
    baseExercises.length > 0
      ? visibleFinishDose({
          exercises: baseExercises,
          swaps,
          removals,
          sessionId: view.session.id,
          blockKey: trainingBlockKey(
            view.session.performedAt,
            tz,
            profile?.onboardingCompletedAt ?? null,
          ),
          catalogDose: plan?.dose,
          loggedSets: view.session.sets,
        })
      : null;
  const progress = sessionProgress(view.session, {
    dose: visible?.dose ?? plan?.dose,
    names: visible?.names ?? plan?.names,
    exercises: visible?.exercises ?? plan?.exercises ?? view.session.programDay?.exercises,
  });
  const partial = !progress.done;
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
    planExercises: visible?.exercises ?? plan?.exercises ?? view.session.programDay?.exercises,
  });
  const performed = civilDayInstant(view.session.performedAt, tz);
  const whenLabel =
    dayKey(performed, tz) === dayKey(new Date(), tz)
      ? "Today"
      : performed.toLocaleDateString("en-US", {
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
        exerciseProgress={progress.rows.filter((row) => row.ticked > 0 || row.planned > 0)}
        summary={summary}
        partial={partial}
        statusLabel={progress.text}
      />
    </main>
  );
}
