-- AlterTable
ALTER TABLE "ProgramExercise" ADD COLUMN "formVideoUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgramExercise" ADD COLUMN "formVideoPending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "calorieTarget" INTEGER NOT NULL DEFAULT 2200;
ALTER TABLE "Profile" ADD COLUMN "proteinTargetG" INTEGER NOT NULL DEFAULT 140;
ALTER TABLE "Profile" ADD COLUMN "carbsTargetG" INTEGER NOT NULL DEFAULT 220;
ALTER TABLE "Profile" ADD COLUMN "fatTargetG" INTEGER NOT NULL DEFAULT 70;

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BodyPhotoPlaceholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "recordedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BodyPhotoPlaceholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BodyMetric_userId_kind_recordedAt_idx" ON "BodyMetric"("userId", "kind", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BodyPhotoPlaceholder_userId_slot_key" ON "BodyPhotoPlaceholder"("userId", "slot");

-- CreateIndex
CREATE INDEX "BodyPhotoPlaceholder_userId_idx" ON "BodyPhotoPlaceholder"("userId");
