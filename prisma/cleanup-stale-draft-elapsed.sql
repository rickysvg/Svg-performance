-- Manual cleanup only. Do not run from migrate or hosted-additive.
-- Drafts whose header froze at the 4 hour cap stored a wall-clock gap, not training time.
UPDATE "WorkoutSession"
SET "elapsedSeconds" = NULL
WHERE "status" = 'draft'
  AND "elapsedSeconds" >= 14400;
