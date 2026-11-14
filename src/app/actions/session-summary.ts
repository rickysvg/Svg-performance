"use server";

import { activePlanWeekIndex } from "@/lib/fight-camp";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { buildSessionSummary, summaryExercises, type SessionSummary } from "@/lib/session-summary";
import { requireUser } from "@/lib/session";
import { prescribedDayFocus, scaleBandFromPrefs } from "@/lib/training-scale";
import { getOwnWorkoutSessionOrNull } from "@/lib/workouts";

export async function loadSessionSummaryAction(sessionId: string): Promise<SessionSummary | null> {
  const id = sessionId.trim();
  if (!id) return null;
  const user = await requireUser();
  const session = await getOwnWorkoutSessionOrNull(id, user.id);
  if (!session) return null;
  const profile = await getProfileForUser(user.id);
  const programDay = session.programDay;
  let programDayFocus = programDay?.focus;
  if (programDay) {
    const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const doseWeek = await activePlanWeekIndex(
      user.id,
      session.performedAt,
      tz,
      profile?.onboardingCompletedAt ?? null,
    );
    programDayFocus = prescribedDayFocus(programDay, {
      band: scaleBandFromPrefs({
        experienceLevel: profile?.experienceLevel,
        competitionStatus: profile?.competitionStatus,
      }),
      programSlug: programDay.program.slug,
      weightAccess: profile?.weightAccess,
      weekIndex: doseWeek.weekIndex,
      campPhase: doseWeek.camp?.phase ?? null,
    });
  }
  return buildSessionSummary({
    title: session.title,
    programDayTitle: programDay?.title,
    programDayFocus,
    exercises: summaryExercises(session),
  });
}
