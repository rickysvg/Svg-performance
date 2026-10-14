"use server";

import { revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import {
  clearCurrentWeekPlanForUser,
  clearWeekPlanForUser,
  getWeekPlanSwapsForUser,
  moveWorkoutForUser,
  restoreWeekPlanForUser,
  swapCurrentWeekForUser,
  swapWeekOnDateForUser,
} from "@/lib/week-plan-swap-store";

export type WeekPlanActionState = { error?: string; undo?: string };

async function snapshot(userId: string) {
  return JSON.stringify(await getWeekPlanSwapsForUser(userId));
}

function refreshPlan() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/home");
}

export async function swapCalendarDaysAction(
  fromDay: string,
  toDay: string,
  weekStart?: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    const undo = await snapshot(user.id);
    if (weekStart) {
      await swapWeekOnDateForUser(user.id, fromDay, toDay, weekStart);
    } else {
      await swapCurrentWeekForUser(user.id, fromDay, toDay);
    }
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
    if (weekStart) {
      await clearWeekPlanForUser(user.id, weekStart);
    } else {
      await clearCurrentWeekPlanForUser(user.id);
    }
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function moveWorkoutAction(
  sessionKey: string,
  toDay: string,
  weekStart: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    const undo = await snapshot(user.id);
    await moveWorkoutForUser(user.id, sessionKey, toDay, weekStart);
    refreshPlan();
    return { undo };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function restoreWeekPlanAction(undo: string): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    await restoreWeekPlanForUser(user.id, undo);
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
