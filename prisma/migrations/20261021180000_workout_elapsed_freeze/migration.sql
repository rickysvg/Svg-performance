-- Freeze the logger header clock on Save. Nullable so existing sessions stay valid.
ALTER TABLE "WorkoutSession" ADD COLUMN "finishedAt" DATETIME;
ALTER TABLE "WorkoutSession" ADD COLUMN "elapsedSeconds" INTEGER;
ALTER TABLE "WorkoutSession" ADD COLUMN "timerStartedAt" DATETIME;
