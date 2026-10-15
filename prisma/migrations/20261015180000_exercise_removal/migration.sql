-- CreateTable
CREATE TABLE "ExerciseRemoval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programSlug" TEXT NOT NULL DEFAULT '',
    "dayNumber" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL DEFAULT '',
    "snapshotJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseRemoval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExerciseRemoval_userId_programSlug_dayNumber_idx" ON "ExerciseRemoval"("userId", "programSlug", "dayNumber");

-- CreateIndex
CREATE INDEX "ExerciseRemoval_userId_workoutSessionId_idx" ON "ExerciseRemoval"("userId", "workoutSessionId");
