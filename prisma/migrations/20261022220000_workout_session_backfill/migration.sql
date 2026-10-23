-- Past-day logs. Named after 20261022170000_workout_set_slot so the folder does not collide.
-- Empty source and backfilled=false keep older sessions as live logs.
ALTER TABLE "WorkoutSession" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutSession" ADD COLUMN "backfilled" BOOLEAN NOT NULL DEFAULT false;
