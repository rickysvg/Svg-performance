-- Saved workouts and per-day apply. Existing sessions stay; new columns are nullable.
CREATE TABLE "SavedWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SavedWorkout_userId_updatedAt_idx" ON "SavedWorkout"("userId", "updatedAt");

CREATE TABLE "SavedWorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savedWorkoutId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "loadText" TEXT NOT NULL DEFAULT '',
    "restSeconds" INTEGER NOT NULL DEFAULT 60,
    "rir" TEXT NOT NULL DEFAULT '',
    "logMode" TEXT NOT NULL DEFAULT 'load_reps',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SavedWorkoutExercise_savedWorkoutId_fkey" FOREIGN KEY ("savedWorkoutId") REFERENCES "SavedWorkout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SavedWorkoutExercise_savedWorkoutId_idx" ON "SavedWorkoutExercise"("savedWorkoutId");

CREATE TABLE "DayWorkoutPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "savedWorkoutId" TEXT,
    "name" TEXT NOT NULL,
    "exercisesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayWorkoutPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DayWorkoutPlan_savedWorkoutId_fkey" FOREIGN KEY ("savedWorkoutId") REFERENCES "SavedWorkout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DayWorkoutPlan_userId_dayKey_idx" ON "DayWorkoutPlan"("userId", "dayKey");

ALTER TABLE "WorkoutSession" ADD COLUMN "savedWorkoutId" TEXT;
ALTER TABLE "WorkoutSession" ADD COLUMN "dayPlanId" TEXT;

CREATE INDEX "WorkoutSession_savedWorkoutId_idx" ON "WorkoutSession"("savedWorkoutId");
CREATE INDEX "WorkoutSession_dayPlanId_idx" ON "WorkoutSession"("dayPlanId");
