-- One slot per session. A second Resume click cannot insert the same set again.
DELETE FROM "WorkoutSet"
WHERE "rowid" NOT IN (
  SELECT MIN("rowid")
  FROM "WorkoutSet"
  GROUP BY "workoutSessionId", "exerciseName", "setNumber"
);

CREATE UNIQUE INDEX "WorkoutSet_workoutSessionId_exerciseName_setNumber_key"
ON "WorkoutSet"("workoutSessionId", "exerciseName", "setNumber");
