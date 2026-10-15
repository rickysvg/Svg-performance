-- CreateTable
CREATE TABLE "ExerciseSwap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programSlug" TEXT NOT NULL DEFAULT '',
    "dayNumber" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT NOT NULL,
    "replacementName" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL DEFAULT '',
    "blockKey" TEXT NOT NULL DEFAULT '',
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "loadText" TEXT NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "logMode" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "retiredNamesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseSwap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExerciseSwap_userId_programSlug_dayNumber_idx" ON "ExerciseSwap"("userId", "programSlug", "dayNumber");

-- CreateIndex
CREATE INDEX "ExerciseSwap_userId_workoutSessionId_idx" ON "ExerciseSwap"("userId", "workoutSessionId");
