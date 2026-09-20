-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkoutSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutSessionId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER,
    "loadValue" REAL,
    "loadUnit" TEXT NOT NULL DEFAULT 'lb',
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "WorkoutSet_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutSet" ("completed", "exerciseName", "id", "loadUnit", "loadValue", "notes", "reps", "setNumber", "workoutSessionId") SELECT "completed", "exerciseName", "id", "loadUnit", "loadValue", "notes", "reps", "setNumber", "workoutSessionId" FROM "WorkoutSet";
DROP TABLE "WorkoutSet";
ALTER TABLE "new_WorkoutSet" RENAME TO "WorkoutSet";
CREATE INDEX "WorkoutSet_workoutSessionId_idx" ON "WorkoutSet"("workoutSessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
