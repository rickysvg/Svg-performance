"use server";

import { buildSessionSummary, summaryExercises, type SessionSummary } from "@/lib/session-summary";
import { requireUser } from "@/lib/session";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";

export async function loadSessionSummaryAction(sessionId: string): Promise<SessionSummary | null> {
  const id = sessionId.trim();
  if (!id) return null;
  const user = await requireUser();
  const session = await getOwnWorkoutSessionOrNull(id, user.id);
  if (!session) return null;
  return buildSessionSummary({
    title: session.title,
    programDayTitle: session.programDay?.title,
    programDayFocus: session.programDay?.focus,
    exercises: summaryExercises(session),
  });
}
