-- Past-day logs. Empty source and backfilled=false keep older sessions as live logs.
ALTER TABLE "WorkoutSession" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutSession" ADD COLUMN "backfilled" BOOLEAN NOT NULL DEFAULT false;
