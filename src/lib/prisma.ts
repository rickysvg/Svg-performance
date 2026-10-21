import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "@/lib/db-provider";

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Keep these off every generated SELECT. A production database that has
    // not run the additive SQL yet must still load and save workouts.
    // Timer values are read and written with raw SQL only when the columns exist.
    omit: {
      workoutSession: {
        finishedAt: true,
        elapsedSeconds: true,
        timerStartedAt: true,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
