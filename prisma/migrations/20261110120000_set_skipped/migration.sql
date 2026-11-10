-- Deliberate untick. Existing rows stay false so a finished session can still count filled sets.
ALTER TABLE "WorkoutSet" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;
