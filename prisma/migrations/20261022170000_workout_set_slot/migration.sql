-- One slot per session. Keep the ticked row, then a logged row, then notes, then the lowest rowid.
DELETE FROM "WorkoutSet"
WHERE "rowid" IN (
  SELECT "rowid" FROM (
    SELECT
      "rowid",
      ROW_NUMBER() OVER (
        PARTITION BY "workoutSessionId", "exerciseName", "setNumber"
        ORDER BY
          CASE WHEN "completed" THEN 1 ELSE 0 END DESC,
          CASE
            WHEN "reps" IS NOT NULL OR "loadValue" IS NOT NULL OR IFNULL("durationSeconds", 0) > 0 THEN 1
            ELSE 0
          END DESC,
          CASE WHEN TRIM(IFNULL("notes", '')) <> '' THEN 1 ELSE 0 END DESC,
          "rowid" ASC
      ) AS "keepRank"
    FROM "WorkoutSet"
  ) AS "ranked"
  WHERE "keepRank" > 1
);

CREATE UNIQUE INDEX "WorkoutSet_workoutSessionId_exerciseName_setNumber_key"
ON "WorkoutSet"("workoutSessionId", "exerciseName", "setNumber");
