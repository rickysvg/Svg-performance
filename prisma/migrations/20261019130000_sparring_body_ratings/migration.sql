-- Session rating, body rating, and sore spots on a sparring log.
ALTER TABLE "OutsideSessionLog" ADD COLUMN "sessionRating" INTEGER;
ALTER TABLE "OutsideSessionLog" ADD COLUMN "bodyRating" INTEGER;
ALTER TABLE "OutsideSessionLog" ADD COLUMN "soreSpots" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OutsideSessionLog" ADD COLUMN "coachCheckIn" TEXT NOT NULL DEFAULT '';
