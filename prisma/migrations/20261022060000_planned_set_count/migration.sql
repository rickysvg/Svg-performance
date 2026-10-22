-- Sets prescribed at Start. Nullable so existing sessions stay valid.
ALTER TABLE "WorkoutSession" ADD COLUMN "plannedSetCount" INTEGER;
