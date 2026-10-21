-- Additive header-timer columns. Safe to run more than once on Postgres.
-- Existing rows stay null; the logger then uses capped updatedAt - createdAt.
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "elapsedSeconds" INTEGER;
ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "timerStartedAt" TIMESTAMP(3);
