/**
 * Demote workouts marked complete that have no logged set back to draft.
 *
 * A logged set has reps, a load, or a duration greater than zero.
 * The session row is kept so a phone draft (`svg-logger-draft:<id>`) can
 * still Save into the same workout. Nothing is deleted.
 *
 * Dry-run unless --apply is passed. Do not point this at production
 * unless you mean to update that database.
 *
 *   npx tsx scripts/discard-empty-completed-workouts.ts
 *   npx tsx scripts/discard-empty-completed-workouts.ts --apply
 */
import { prisma } from "../src/lib/prisma";

const emptyComplete = {
  status: "complete",
  sets: {
    none: {
      OR: [
        { reps: { not: null } },
        { loadValue: { not: null } },
        { durationSeconds: { gt: 0 } },
      ],
    },
  },
};

async function main() {
  const apply = process.argv.includes("--apply");
  const sessions = await prisma.workoutSession.findMany({
    where: emptyComplete,
    orderBy: { performedAt: "asc" },
    select: {
      id: true,
      title: true,
      performedAt: true,
      sets: { select: { id: true } },
    },
  });
  console.log(
    `${apply ? "Applying" : "Dry run"}: ${sessions.length} complete session(s) with no logged sets.`,
  );
  for (const session of sessions) {
    console.log(
      `${session.performedAt.toISOString()}  ${session.id}  ${session.title}  (${session.sets.length} empty set rows)`,
    );
  }
  if (!apply) {
    console.log("No rows changed. Re-run with --apply to mark them draft.");
    return;
  }
  if (sessions.length === 0) return;
  const result = await prisma.workoutSession.updateMany({
    where: { id: { in: sessions.map((session) => session.id) }, status: "complete" },
    data: { status: "draft" },
  });
  console.log(`Marked ${result.count} session(s) draft. Logged workouts were left complete.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
