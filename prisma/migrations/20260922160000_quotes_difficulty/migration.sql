-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "difficultyRating" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ReminderPrefs" ADD COLUMN "quoteEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReminderPrefs" ADD COLUMN "lastQuoteRemindedAt" DATETIME;
