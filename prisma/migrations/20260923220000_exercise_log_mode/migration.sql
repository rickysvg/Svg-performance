-- AlterTable
ALTER TABLE "ProgramExercise" ADD COLUMN "logMode" TEXT NOT NULL DEFAULT 'load_reps';

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN "logMode" TEXT NOT NULL DEFAULT 'load_reps';
ALTER TABLE "WorkoutSet" ADD COLUMN "durationSeconds" INTEGER;
