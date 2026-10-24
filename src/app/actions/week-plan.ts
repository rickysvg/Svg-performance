"use server";

import { refresh, revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import {
  clearCurrentWeekPlanForUser,
  clearWeekPlanForUser,
  enqueueWeekPlan,
  getWeekPlanSwapsForUser,
  placeSessionIntentForUser,
  restoreWeekPlanForUser,
  swapWorkoutForUser,
  swapCurrentWeekForUser,
  swapWeekOnDateForUser,
} from "@/lib/week-plan-swap-store";

export type WeekPlanActionState = {
  error?: string;
  undo?: string;
  applied?: boolean;
  seq?: number;
};

function intentSeqOrError(intentSeq: number): WeekPlanActionState | null {
  if (!Number.isInteger(intentSeq) || intentSeq < 1) {
    return { error: "That move did not save. Try again." };
  }
  return null;
}

async function snapshot(userId: string) {
  return JSON.stringify(await getWeekPlanSwapsForUser(userId));
}

function refreshPlan() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/home");
  refresh();
}

export async function swapCalendarDaysAction(
  fromDay: string,
  toDay: string,
  weekStart?: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    const undo = await enqueueWeekPlan(user.id, async () => {
      const prior = await snapshot(user.id);
      if (weekStart) {
        await swapWeekOnDateForUser(user.id, fromDay, toDay, weekStart);
      } else {
        await swapCurrentWeekForUser(user.id, fromDay, toDay);
      }
      return prior;
    });
    refreshPlan();
    return { undo };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function resetCalendarWeekAction(
  weekStart?: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    await enqueueWeekPlan(user.id, async () => {
      if (weekStart) {
        await clearWeekPlanForUser(user.id, weekStart);
      } else {
        await clearCurrentWeekPlanForUser(user.id);
      }
    });
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function swapWorkoutAction(
  sessionKey: string,
  otherKey: string,
  weekStart: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    const undo = await enqueueWeekPlan(user.id, async () => {
      const prior = await snapshot(user.id);
      await swapWorkoutForUser(user.id, sessionKey, otherKey, weekStart);
      return prior;
    });
    refreshPlan();
    return { undo };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function moveWorkoutAction(
  sessionKey: string,
  toDay: string,
  weekStart: string,
  intentSeq: number,
): Promise<WeekPlanActionState> {
  const invalid = intentSeqOrError(intentSeq);
  if (invalid) return invalid;
  try {
    const user = await requireUserOrThrow();
    const placed = await placeSessionIntentForUser({
      userId: user.id,
      sessionKey,
      weekStart,
      toDay,
      intentSeq,
      intent: "move",
    });
    refreshPlan();
    return { applied: placed.applied, seq: placed.seq };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

/** Put the session back on the day Undo names. A lower sequence is ignored. */
export async function undoSessionMoveAction(
  sessionKey: string,
  toDay: string,
  weekStart: string,
  intentSeq: number,
): Promise<WeekPlanActionState> {
  const invalid = intentSeqOrError(intentSeq);
  if (invalid) return invalid;
  try {
    const user = await requireUserOrThrow();
    const placed = await placeSessionIntentForUser({
      userId: user.id,
      sessionKey,
      weekStart,
      toDay,
      intentSeq,
      intent: "restore",
    });
    refreshPlan();
    return { applied: placed.applied, seq: placed.seq };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function restoreWeekPlanAction(undo: string): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    await enqueueWeekPlan(user.id, () => restoreWeekPlanForUser(user.id, undo));
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
