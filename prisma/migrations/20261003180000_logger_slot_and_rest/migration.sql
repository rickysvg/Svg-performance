-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "restExerciseName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutSession" ADD COLUMN "restEndsAt" DATETIME;

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN "prescriptionKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutSet" ADD COLUMN "rir" TEXT NOT NULL DEFAULT '';
