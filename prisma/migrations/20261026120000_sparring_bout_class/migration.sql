-- Optional amateur/pro mark on a sparring log. Blank is unspecified.
ALTER TABLE "OutsideSessionLog" ADD COLUMN "roundType" TEXT NOT NULL DEFAULT '';
