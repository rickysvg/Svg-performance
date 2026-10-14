-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "aiCoachId" TEXT NOT NULL DEFAULT 'skye';
ALTER TABLE "Profile" ADD COLUMN "coachingStyle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "coachChoiceAt" DATETIME;

-- Existing rows that already stored the old default slug.
UPDATE "Profile" SET "aiCoachId" = 'skye' WHERE "aiCoachId" = 'lena' OR "aiCoachId" = '';
