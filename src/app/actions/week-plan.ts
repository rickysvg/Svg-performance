"use server";

import { revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import {
  clearCurrentWeekPlanForUser,
  swapCurrentWeekForUser,
} from "@/lib/week-plan-swap-store";

export type WeekPlanActionState = { error?: string };

function refreshPlan() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/home");
}

export async function swapCalendarDaysAction(
  fromDay: string,
  toDay: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    await swapCurrentWeekForUser(user.id, fromDay, toDay);
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}

export async function resetCalendarWeekAction(): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    await clearCurrentWeekPlanForUser(user.id);
    refreshPlan();
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
