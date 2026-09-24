-- CreateTable
CREATE TABLE "ExerciseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "programDayId" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "aiReply" TEXT NOT NULL DEFAULT '',
    "aiOffline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExerciseNote_userId_programDayId_idx" ON "ExerciseNote"("userId", "programDayId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseNote_userId_exerciseName_programDayId_key" ON "ExerciseNote"("userId", "exerciseName", "programDayId");
