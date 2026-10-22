"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extendActiveSession, requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  deleteWorkoutSessionForUser,
  getOwnWorkoutSessionOrNull,
  rateWorkoutSessionForUser,
  continuePartialWorkoutForUser,
  reopenCompletedWorkoutForUser,
  logBikeRoundsForUser,
  logRoundSessionForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
  type WorkoutSetInput,
} from "@/lib/workouts";
import { parseSessionRpe } from "@/lib/bagwork";
import { TIMER_MODES, type TimerMode } from "@/lib/round-timer";
import { choiceFromToken } from "@/lib/bike-chooser";
import { hasActivityOnLocalDay } from "@/lib/home";
import { sessionHasLoggedWork } from "@/lib/logged-work";
import { resolveLoggedPerformedAt } from "@/lib/performed-at";
import { parseDateTimeLocal } from "@/lib/timezone";
import { isDeloadWeekIndex } from "@/lib/training-cycle";
import { planWeekIndex } from "@/lib/week-plan";
import { AppError, isUniqueConstraintError, publicErrorMessage, StaleDraftError } from "@/lib/errors";
import { getAppTier } from "@/lib/entitlements";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { isLogMode } from "@/lib/exercise-log-mode";
import { createWorkoutHrForUser } from "@/lib/heart";
import { noteAfterWorkout } from "@/lib/coach/auto-notes";
import {
  detectNewPrsForSession,
  detectUnseenBadgeUnlocksForSession,
  unlockQueryForBadges,
} from "@/lib/progress-companion";

export type WorkoutActionState = {
  error?: string;
  success?: string;
  newPr?: string;
  savedRating?: string;
};

export async function startRoundLogAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  const modeRaw = String(formData.get("mode") ?? "bag");
  const mode: TimerMode = TIMER_MODES.includes(modeRaw as TimerMode)
    ? (modeRaw as TimerMode)
    : "bag";
  const programDayId = String(formData.get("programDayId") ?? "").trim();
  const configuredRaw = String(formData.get("configuredRounds") ?? "").trim();
  const session = await logRoundSessionForUser({
    userId: user.id,
    type: mode,
    roundsCompleted: Number(formData.get("rounds") ?? 0),
    workSeconds: Number(formData.get("workSeconds") ?? 180),
    restSeconds: Number(formData.get("restSeconds") ?? 0),
    notes: String(formData.get("notes") ?? ""),
    rpe: parseSessionRpe(formData.get("rpe")),
    programDayId: programDayId || null,
    configuredRounds: configuredRaw === "" ? null : Number(configuredRaw),
  });
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  redirect(`/training/log/${session.id}/done?celebrate=workout`);
}

export async function logBikeTimerAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  const choice = choiceFromToken(String(formData.get("workout") ?? ""));
  if (!choice) {
    throw new AppError("WORKOUT", "Pick a bike workout before logging.");
  }
  const roundsCompleted = Number(formData.get("rounds"));
  const programDayId = String(formData.get("programDayId") ?? "").trim();
  const session = await logBikeRoundsForUser({
    userId: user.id,
    choice,
    roundsCompleted,
    notes: String(formData.get("notes") ?? ""),
    rpe: parseSessionRpe(formData.get("rpe")),
    programDayId: programDayId || null,
  });
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/training/history");
  revalidatePath("/training/history/bike");
  revalidatePath("/progress");
  redirect(`/training/log/${session.id}/done?celebrate=workout`);
}

export async function startProgramDayLog(userId: string, programDayId: string, half = false) {
  const profile = await getProfileForUser(userId);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const timeZone = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const now = new Date();
  return startWorkoutFromDay({
    userId,
    programDayId,
    preferredUnits: units,
    scale: {
      experienceLevel: profile?.experienceLevel,
      competitionStatus: profile?.competitionStatus,
      weightAccess: profile?.weightAccess,
    },
    deload: isDeloadWeekIndex(planWeekIndex(now, timeZone, profile?.onboardingCompletedAt)),
    timeZone,
    planAnchor: profile?.onboardingCompletedAt ?? null,
    half,
  });
}

export async function startSessionAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  const session = await startProgramDayLog(user.id, String(formData.get("programDayId") ?? ""));
  redirect(`/training/log/${session.id}`);
}

function parseSets(formData: FormData): WorkoutSetInput[] {
  const count = Number(formData.get("setCount") ?? 0);
  const sets: WorkoutSetInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const repsRaw = String(formData.get(`sets.${i}.reps`) ?? "").trim();
    const loadRaw = String(formData.get(`sets.${i}.loadValue`) ?? "").trim();
    const unitRaw = String(formData.get(`sets.${i}.loadUnit`) ?? "lb");
    const durationRaw = String(formData.get(`sets.${i}.durationSeconds`) ?? "").trim();
    const modeRaw = String(formData.get(`sets.${i}.logMode`) ?? "");
    sets.push({
      exerciseName: String(formData.get(`sets.${i}.exerciseName`) ?? ""),
      setNumber: Number(formData.get(`sets.${i}.setNumber`) ?? i + 1),
      reps: repsRaw === "" ? null : Number(repsRaw),
      loadValue: loadRaw === "" ? null : Number(loadRaw),
      loadUnit: isLoadUnit(unitRaw) ? unitRaw : "lb",
      logMode: isLogMode(modeRaw) ? modeRaw : undefined,
      durationSeconds: durationRaw === "" ? null : Number(durationRaw),
      completed: formData.get(`sets.${i}.completed`) === "on",
      prescriptionKey: String(formData.get(`sets.${i}.prescriptionKey`) ?? ""),
      rir: String(formData.get(`sets.${i}.rir`) ?? ""),
    });
  }
  return sets;
}

export async function saveWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  let redirectPath = "";
  try {
    const user = await requireUserOrThrow();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const workoutId = String(formData.get("workoutId") ?? "");
    const intentRaw = String(formData.get("intent") ?? "");
    const intent = intentRaw === "complete" ? "complete" : "draft";
    const existing = await getOwnWorkoutSessionOrNull(workoutId, user.id);
    const now = new Date();
    const performedAt = existing
      ? resolveLoggedPerformedAt({
          raw: String(formData.get("performedAt") ?? ""),
          existing: existing.performedAt,
          now,
          timeZone,
          completing: intent === "complete",
          hasPriorLogs: sessionHasLoggedWork(existing.sets) || Boolean(existing.dayPlanId),
        })
      : now;
    const alreadyActive =
      intent === "complete" ? await hasActivityOnLocalDay(user.id, performedAt, timeZone) : true;
    const elapsedRaw = String(formData.get("elapsedSeconds") ?? "").trim();
    const reportedElapsed = elapsedRaw === "" ? null : Number(elapsedRaw);
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      title: String(formData.get("title") ?? "Workout"),
      performedAt,
      notes: String(formData.get("notes") ?? ""),
      status: intent === "draft" ? "draft" : "complete",
      sets: parseSets(formData),
      rest: intent === "complete" ? null : undefined,
      timeZone,
      elapsedSeconds: Number.isFinite(reportedElapsed) ? reportedElapsed : null,
    });
    const savedId = saved.id;
    const units: LoadUnit = profile?.preferredUnits ?? "lb";
    const newPrs =
      intent === "complete" ? await detectNewPrsForSession(user.id, savedId, units) : [];
    const avgRaw = String(formData.get("hrAvgBpm") ?? "").trim();
    const maxRaw = String(formData.get("hrMaxBpm") ?? "").trim();
    if (intent === "complete" && avgRaw && maxRaw) {
      await createWorkoutHrForUser(user.id, {
        workoutSessionId: savedId,
        startedAt: performedAt,
        endedAt: new Date(performedAt.getTime() + 45 * 60 * 1000),
        avgBpm: Number(avgRaw),
        maxBpm: Number(maxRaw),
        source: "manual",
      });
    }
    revalidatePath("/home");
    revalidatePath("/training");
    revalidatePath("/training/calendar");
    revalidatePath("/training/my-workouts");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath("/progress/records");
    revalidatePath("/progress/streaks");
    revalidatePath("/heart");
    revalidatePath(`/training/log/${workoutId}`);
    revalidatePath(`/training/log/${savedId}`);
    revalidatePath(`/training/log/${workoutId}/done`);
    revalidatePath(`/training/log/${savedId}/done`);
    revalidatePath("/coach");
    if (intent === "complete") {
      await noteAfterWorkout(user.id, workoutId).catch(() => {
        console.warn("[coach] workout note skipped");
      });
      const celebrate = newPrs[0] ? "pr" : alreadyActive ? "workout" : "streak";
      const prQuery = newPrs[0]
        ? `&pr=${encodeURIComponent(newPrs[0].headline)}&prDetail=${encodeURIComponent(newPrs[0].detail)}`
        : "";
      const unlocked = await detectUnseenBadgeUnlocksForSession(user.id, savedId, units);
      const unlockQuery = unlocked.length
        ? `&unlock=${encodeURIComponent(unlockQueryForBadges(unlocked))}&pendingUnlock=${encodeURIComponent(unlockQueryForBadges(unlocked))}`
        : "";
      redirectPath = `/training/log/${savedId}/done?celebrate=${celebrate}${prQuery}${unlockQuery}`;
    } else {
      return { success: "Draft saved. You can finish it later." };
    }
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(redirectPath);
}

export async function syncWorkoutDraftAction(input: {
  workoutId: string;
  title: string;
  performedAt: string;
  notes: string;
  sets: WorkoutSetInput[];
  rest: { exerciseName: string; endsAtMs: number } | null;
  /** Session updatedAt the logger built this payload from. A newer save wins. */
  baseUpdatedAt?: string | null;
}): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string; stale?: boolean }> {
  try {
    const user = await requireUserOrThrow();
    await extendActiveSession();
    const profile = await getProfileForUser(user.id);
    const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
    const parsed = parseDateTimeLocal(input.performedAt, timeZone);
    const loose = new Date(input.performedAt);
    const performedAt = parsed ?? (Number.isNaN(loose.getTime()) ? new Date() : loose);
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: input.workoutId,
      title: input.title || "Workout",
      performedAt,
      notes: input.notes ?? "",
      status: "draft",
      sets: input.sets,
      rest: input.rest,
      baseUpdatedAt: input.baseUpdatedAt,
    });
    revalidatePath("/training");
    revalidatePath("/home");
    return { ok: true, updatedAt: saved.updatedAt.toISOString() };
  } catch (error) {
    if (error instanceof StaleDraftError) {
      return { ok: false, stale: true, error: "" };
    }
    return { ok: false, error: publicErrorMessage(error) };
  }
}

export async function rateWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    const workoutId = String(formData.get("workoutId") ?? "");
    await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      difficultyRating: String(formData.get("difficultyRating") ?? ""),
    });
    revalidatePath("/home");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath("/staff/reports");
    revalidatePath(`/training/log/${workoutId}`);
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(`/training/log/${String(formData.get("workoutId") ?? "")}`);
}

/** One tap on the finish screen. Stays on that screen so Done can still skip. */
export async function rateFinishedWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  try {
    const user = await requireUserOrThrow();
    const workoutId = String(formData.get("workoutId") ?? "");
    const rated = await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      difficultyRating: String(formData.get("difficultyRating") ?? ""),
    });
    revalidatePath("/home");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath("/staff/reports");
    revalidatePath(`/training/log/${workoutId}`);
    revalidatePath(`/training/log/${workoutId}/done`);
    return { success: "Saved.", savedRating: rated.difficultyRating };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

/** Reopen a short save, restore its planned rows, and open that same logger. */
export async function continuePartialWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const workoutId = String(formData.get("workoutId") ?? "");
  const profile = await getProfileForUser(user.id);
  const units: LoadUnit = profile?.preferredUnits === "kg" ? "kg" : "lb";
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  let sessionId = workoutId;
  try {
    const session = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId,
      preferredUnits: units,
      timeZone,
    });
    sessionId = session.id;
  } catch (error) {
    // The other tap already filled this session. Open it instead of an error screen.
    if (!isUniqueConstraintError(error)) throw error;
  }
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  revalidatePath(`/training/log/${sessionId}`);
  redirect(`/training/log/${sessionId}`);
}

/** Undo an accidental finish and return to the same logger, sets intact. */
export async function resumeWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const workoutId = String(formData.get("workoutId") ?? "");
  await reopenCompletedWorkoutForUser(user.id, workoutId);
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  revalidatePath(`/training/log/${workoutId}`);
  revalidatePath(`/training/log/${workoutId}/done`);
  redirect(`/training/log/${workoutId}`);
}

export async function deleteWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteWorkoutSessionForUser(
    String(formData.get("workoutId") ?? ""),
    user.id,
  );
  revalidatePath("/home");
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  revalidatePath("/progress/records");
  revalidatePath("/progress/streaks");
  redirect("/training/history");
}
