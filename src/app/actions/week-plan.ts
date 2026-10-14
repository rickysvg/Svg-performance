"use server";

import { revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import {
  clearCurrentWeekPlanForUser,
  clearWeekPlanForUser,
  swapCurrentWeekForUser,
  swapWeekOnDateForUser,
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
  weekStart?: string,
): Promise<WeekPlanActionState> {
  try {
    const user = await requireUserOrThrow();
    if (weekStart) {
      await swapWeekOnDateForUser(user.id, fromDay, toDay, weekStart);
    } else {
      await swapCurrentWeekForUser(user.id, fromDay, toDay);
    }
    refreshPlan();
    return {};
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
