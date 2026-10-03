"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { isDeloadWeek } from "@/lib/training-cycle";
import {
  deleteWorkoutSessionForUser,
  rateWorkoutSessionForUser,
  startRoundWorkoutForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
  type WorkoutSetInput,
} from "@/lib/workouts";
import { TIMER_MODES, type TimerMode } from "@/lib/round-timer";
import { hasActivityOnLocalDay } from "@/lib/home";
import { publicErrorMessage } from "@/lib/errors";
import { isLoadUnit, type LoadUnit } from "@/lib/units";
import { isLogMode } from "@/lib/exercise-log-mode";
import { createWorkoutHrForUser } from "@/lib/heart";
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
  const profile = await getProfileForUser(user.id);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const modeRaw = String(formData.get("mode") ?? "bag");
  const mode: TimerMode = TIMER_MODES.includes(modeRaw as TimerMode)
    ? (modeRaw as TimerMode)
    : "bag";
  const session = await startRoundWorkoutForUser({
    userId: user.id,
    mode,
    rounds: Number(formData.get("rounds") ?? 3),
    workSeconds: Number(formData.get("workSeconds") ?? 180),
    preferredUnits: units,
  });
  redirect(`/training/log/${session.id}`);
}

export async function startSessionAction(formData: FormData) {
  const user = await requireUserOrThrow();
  const profile = await getProfileForUser(user.id);
  const units: LoadUnit = profile?.preferredUnits ?? "lb";
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const session = await startWorkoutFromDay({
    userId: user.id,
    programDayId: String(formData.get("programDayId") ?? ""),
    preferredUnits: units,
    scale: {
      experienceLevel: profile?.experienceLevel,
      competitionStatus: profile?.competitionStatus,
    },
    deload: isDeloadWeek(new Date(), timeZone),
  });
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
    const workoutId = String(formData.get("workoutId") ?? "");
    const intent = String(formData.get("intent") ?? "complete");
    const performedAt = new Date(String(formData.get("performedAt") ?? ""));
    const alreadyActive =
      intent === "complete" ? await hasActivityOnLocalDay(user.id, performedAt) : true;
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId,
      title: String(formData.get("title") ?? "Workout"),
      performedAt,
      notes: String(formData.get("notes") ?? ""),
      status: intent === "draft" ? "draft" : "complete",
      sets: parseSets(formData),
    });
    const profile = await getProfileForUser(user.id);
    const units: LoadUnit = profile?.preferredUnits ?? "lb";
    const newPrs =
      intent === "complete" ? await detectNewPrsForSession(user.id, workoutId, units) : [];
    const avgRaw = String(formData.get("hrAvgBpm") ?? "").trim();
    const maxRaw = String(formData.get("hrMaxBpm") ?? "").trim();
    if (intent === "complete" && avgRaw && maxRaw) {
      await createWorkoutHrForUser(user.id, {
        workoutSessionId: workoutId,
        startedAt: performedAt,
        endedAt: new Date(performedAt.getTime() + 45 * 60 * 1000),
        avgBpm: Number(avgRaw),
        maxBpm: Number(maxRaw),
        source: "manual",
      });
    }
    revalidatePath("/home");
    revalidatePath("/training");
    revalidatePath("/training/history");
    revalidatePath("/progress");
    revalidatePath("/progress/records");
    revalidatePath("/progress/streaks");
    revalidatePath("/heart");
    revalidatePath(`/training/log/${workoutId}`);
    revalidatePath(`/training/log/${workoutId}/done`);
    if (intent === "complete") {
      const celebrate = newPrs[0] ? "pr" : alreadyActive ? "workout" : "streak";
      const prQuery = newPrs[0]
        ? `&pr=${encodeURIComponent(newPrs[0].headline)}&prDetail=${encodeURIComponent(newPrs[0].detail)}`
        : "";
      const unlocked = await detectUnseenBadgeUnlocksForSession(user.id, workoutId, units);
      const unlockQuery = unlocked.length
        ? `&unlock=${encodeURIComponent(unlockQueryForBadges(unlocked))}&pendingUnlock=${encodeURIComponent(unlockQueryForBadges(unlocked))}`
        : "";
      redirectPath = `/training/log/${workoutId}/done?celebrate=${celebrate}${prQuery}${unlockQuery}`;
    } else {
      return { success: "Draft saved. You can finish it later." };
    }
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect(redirectPath);
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

export async function deleteWorkoutAction(formData: FormData) {
  const user = await requireUserOrThrow();
  await deleteWorkoutSessionForUser(
    String(formData.get("workoutId") ?? ""),
    user.id,
  );
  revalidatePath("/home");
  revalidatePath("/training/history");
  revalidatePath("/progress");
  redirect("/training/history");
}
