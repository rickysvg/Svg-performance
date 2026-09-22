-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "onboardingDeepCompletedAt" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "currentWeight" REAL;
ALTER TABLE "Profile" ADD COLUMN "goalWeight" REAL;
ALTER TABLE "Profile" ADD COLUMN "sessionLengthMin" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "trainingLocation" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "competitionStatus" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "nextFightDate" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "coachingTone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "obstaclesJson" TEXT NOT NULL DEFAULT '[]';
