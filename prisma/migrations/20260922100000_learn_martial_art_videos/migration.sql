-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "keyDetails" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lesson" ADD COLUMN "youtubeUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lesson" ADD COLUMN "videoPending" BOOLEAN NOT NULL DEFAULT false;

-- Remap legacy topic values onto martial-art filters
UPDATE "Lesson" SET topic = 'mma' WHERE topic IN ('stance', 'conditioning', 'recovery');
UPDATE "Lesson" SET topic = 'boxing' WHERE topic = 'striking';
