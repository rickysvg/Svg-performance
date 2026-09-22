-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "goalKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "primaryFocus" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "sessionsPerWeek" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "trainingLimitations" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "onboardingCompletedAt" DATETIME;
