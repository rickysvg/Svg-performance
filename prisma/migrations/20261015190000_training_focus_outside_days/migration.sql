-- Training focus, lift-day target, outside class/sparring days, and sparring logs.
ALTER TABLE "Profile" ADD COLUMN "trainingFocus" TEXT NOT NULL DEFAULT 'martial_arts_sc';
ALTER TABLE "Profile" ADD COLUMN "liftDaysPerWeek" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "outsideTrainingJson" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "OutsideSessionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "weekday" TEXT NOT NULL DEFAULT '',
    "rounds" INTEGER NOT NULL,
    "minutesPerRound" INTEGER NOT NULL,
    "intensity" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutsideSessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OutsideSessionLog_userId_dateKey_key" ON "OutsideSessionLog"("userId", "dateKey");
CREATE INDEX "OutsideSessionLog_userId_dateKey_idx" ON "OutsideSessionLog"("userId", "dateKey");

UPDATE "Profile"
SET "liftDaysPerWeek" = 3
WHERE "liftDaysPerWeek" IS NULL
  AND "userId" IN (
    SELECT "id" FROM "User" WHERE lower("email") = 'rmaynez21@gmail.com'
  );

UPDATE "Profile"
SET "outsideTrainingJson" = '[{"weekday":"Wednesday","kind":"class","time":"18:00"},{"weekday":"Saturday","kind":"sparring","time":"11:00"}]'
WHERE "outsideTrainingJson" = '[]'
  AND "userId" IN (
    SELECT "id" FROM "User" WHERE lower("email") = 'rmaynez21@gmail.com'
  );
