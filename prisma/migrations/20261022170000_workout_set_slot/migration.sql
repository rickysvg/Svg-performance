-- One slot per session. Rank logged reps, load, or time first, then a tick,
-- then notes, then the lowest rowid. Merge the other copies onto that row
-- before they are deleted: OR the tick, keep any number, and join distinct notes.
DROP TABLE IF EXISTS "WorkoutSetKeep";
CREATE TEMP TABLE "WorkoutSetKeep" AS
SELECT "keepRowid", "workoutSessionId", "exerciseName", "setNumber"
FROM (
  SELECT
    "rowid" AS "keepRowid",
    "workoutSessionId",
    "exerciseName",
    "setNumber",
    ROW_NUMBER() OVER (
      PARTITION BY "workoutSessionId", "exerciseName", "setNumber"
      ORDER BY
        CASE
          WHEN "reps" IS NOT NULL OR "loadValue" IS NOT NULL OR IFNULL("durationSeconds", 0) > 0 THEN 1
          ELSE 0
        END DESC,
        CASE WHEN "completed" THEN 1 ELSE 0 END DESC,
        CASE WHEN TRIM(IFNULL("notes", '')) <> '' THEN 1 ELSE 0 END DESC,
        "rowid" ASC
    ) AS "keepRank",
    COUNT(*) OVER (PARTITION BY "workoutSessionId", "exerciseName", "setNumber") AS "copies"
  FROM "WorkoutSet"
)
WHERE "keepRank" = 1 AND "copies" > 1;

DROP TABLE IF EXISTS "WorkoutSetNote";
CREATE TEMP TABLE "WorkoutSetNote" AS
SELECT
  "keep"."keepRowid" AS "keepRowid",
  TRIM("slot"."notes") AS "note",
  MIN("slot"."rowid") AS "ord"
FROM "WorkoutSetKeep" AS "keep"
JOIN "WorkoutSet" AS "slot"
  ON "slot"."workoutSessionId" = "keep"."workoutSessionId"
 AND "slot"."exerciseName" = "keep"."exerciseName"
 AND "slot"."setNumber" = "keep"."setNumber"
WHERE TRIM(IFNULL("slot"."notes", '')) <> ''
GROUP BY "keep"."keepRowid", TRIM("slot"."notes");

DROP TABLE IF EXISTS "WorkoutSetMerge";
CREATE TEMP TABLE "WorkoutSetMerge" AS
SELECT
  "keep"."keepRowid" AS "keepRowid",
  (
    SELECT MAX(CASE WHEN "slot"."completed" THEN 1 ELSE 0 END)
    FROM "WorkoutSet" AS "slot"
    WHERE "slot"."workoutSessionId" = "keep"."workoutSessionId"
      AND "slot"."exerciseName" = "keep"."exerciseName"
      AND "slot"."setNumber" = "keep"."setNumber"
  ) AS "completed",
  COALESCE(
    (
      SELECT "slot"."reps"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."rowid" = "keep"."keepRowid" AND "slot"."reps" IS NOT NULL
    ),
    (
      SELECT "slot"."reps"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."workoutSessionId" = "keep"."workoutSessionId"
        AND "slot"."exerciseName" = "keep"."exerciseName"
        AND "slot"."setNumber" = "keep"."setNumber"
        AND "slot"."reps" IS NOT NULL
      ORDER BY "slot"."rowid" ASC
      LIMIT 1
    )
  ) AS "reps",
  COALESCE(
    (
      SELECT "slot"."loadValue"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."rowid" = "keep"."keepRowid" AND "slot"."loadValue" IS NOT NULL
    ),
    (
      SELECT "slot"."loadValue"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."workoutSessionId" = "keep"."workoutSessionId"
        AND "slot"."exerciseName" = "keep"."exerciseName"
        AND "slot"."setNumber" = "keep"."setNumber"
        AND "slot"."loadValue" IS NOT NULL
      ORDER BY "slot"."rowid" ASC
      LIMIT 1
    )
  ) AS "loadValue",
  COALESCE(
    (
      SELECT "slot"."durationSeconds"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."rowid" = "keep"."keepRowid" AND IFNULL("slot"."durationSeconds", 0) > 0
    ),
    (
      SELECT "slot"."durationSeconds"
      FROM "WorkoutSet" AS "slot"
      WHERE "slot"."workoutSessionId" = "keep"."workoutSessionId"
        AND "slot"."exerciseName" = "keep"."exerciseName"
        AND "slot"."setNumber" = "keep"."setNumber"
        AND IFNULL("slot"."durationSeconds", 0) > 0
      ORDER BY "slot"."rowid" ASC
      LIMIT 1
    )
  ) AS "durationSeconds",
  IFNULL((
    SELECT group_concat("ordered"."note", char(10))
    FROM (
      SELECT "note"."note" AS "note"
      FROM "WorkoutSetNote" AS "note"
      WHERE "note"."keepRowid" = "keep"."keepRowid"
      ORDER BY "note"."ord"
    ) AS "ordered"
  ), '') AS "notes"
FROM "WorkoutSetKeep" AS "keep";

UPDATE "WorkoutSet"
SET
  "completed" = "merge"."completed",
  "reps" = "merge"."reps",
  "loadValue" = "merge"."loadValue",
  "durationSeconds" = "merge"."durationSeconds",
  "notes" = "merge"."notes"
FROM "WorkoutSetMerge" AS "merge"
WHERE "WorkoutSet"."rowid" = "merge"."keepRowid";

DELETE FROM "WorkoutSet"
WHERE "rowid" IN (
  SELECT "slot"."rowid"
  FROM "WorkoutSet" AS "slot"
  JOIN "WorkoutSetKeep" AS "keep"
    ON "slot"."workoutSessionId" = "keep"."workoutSessionId"
   AND "slot"."exerciseName" = "keep"."exerciseName"
   AND "slot"."setNumber" = "keep"."setNumber"
  WHERE "slot"."rowid" <> "keep"."keepRowid"
);

DROP TABLE IF EXISTS "WorkoutSetMerge";
DROP TABLE IF EXISTS "WorkoutSetNote";
DROP TABLE IF EXISTS "WorkoutSetKeep";

CREATE UNIQUE INDEX "WorkoutSet_workoutSessionId_exerciseName_setNumber_key"
ON "WorkoutSet"("workoutSessionId", "exerciseName", "setNumber");
