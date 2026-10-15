-- New sessions are drafts until the member taps Save.
-- SQLite cannot change a column default in place; the Prisma client writes
-- "draft" on insert. Sessions already marked complete with no reps, load,
-- or duration are demoted to draft so a local logger can still save them.
-- Hosted Postgres does not run this file. Use
-- scripts/discard-empty-completed-workouts.ts (dry-run unless --apply).
UPDATE "WorkoutSession"
SET "status" = 'draft'
WHERE "status" = 'complete'
AND NOT EXISTS (
  SELECT 1 FROM "WorkoutSet"
  WHERE "WorkoutSet"."workoutSessionId" = "WorkoutSession"."id"
  AND (
    "WorkoutSet"."reps" IS NOT NULL
    OR "WorkoutSet"."loadValue" IS NOT NULL
    OR "WorkoutSet"."durationSeconds" > 0
  )
);
