-- New sets stay unchecked until the member marks them.
-- SQLite cannot change a column default in place; inserts from the app
-- now pass completed = false. Empty rows that inherited the old default
-- are unchecked so they do not show as a finished set.
UPDATE "WorkoutSet"
SET "completed" = 0
WHERE "completed" = 1
  AND "reps" IS NULL
  AND "loadValue" IS NULL
  AND ("durationSeconds" IS NULL OR "durationSeconds" = 0);
