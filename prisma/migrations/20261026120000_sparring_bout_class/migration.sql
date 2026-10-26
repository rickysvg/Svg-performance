-- Optional amateur/pro mark on a sparring log. Blank is unspecified.
ALTER TABLE "OutsideSessionLog" ADD COLUMN "boutClass" TEXT NOT NULL DEFAULT '';
