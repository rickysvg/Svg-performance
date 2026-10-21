-- Bagwork session RPE, and member-saved bag workouts.
ALTER TABLE "WorkoutSession" ADD COLUMN "sessionRpe" INTEGER;

CREATE TABLE "CustomBagWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "regions" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomBagWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomBagWorkout_userId_updatedAt_idx" ON "CustomBagWorkout"("userId", "updatedAt");
