import { prisma } from "@/lib/prisma";

export const METRIC_NAMES = {
  workoutLogged: "workout_logged",
  foodLogged: "food_logged",
  lessonCompleted: "lesson_completed",
  helpRequested: "help_requested",
  reminderShown: "reminder_shown",
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];

/** Counts only. Never store food names, chat text, or other private payloads. */
export async function recordMetric(name: MetricName, userId?: string | null) {
  return prisma.metricEvent.create({
    data: { name, userId: userId || null },
  });
}

export async function countDistinctActiveUsersSince(since: Date) {
  const rows = await prisma.metricEvent.findMany({
    where: { createdAt: { gte: since }, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}
