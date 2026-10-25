"use server";

import { refresh, revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { sessionHomeWeekday } from "@/lib/week-plan-swaps";
import { placeSessionIntentForUser } from "@/lib/week-plan-swap-store";

function refreshPlan() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/home");
  refresh();
}

export async function moveWorkoutHomeAction(
  sessionKey: string,
  weekStart: string,
  intentSeq: number,
) {
  if (!Number.isInteger(intentSeq) || intentSeq < 1) {
    return { error: "That move did not save. Try again." };
  }
  try {
    const user = await requireUserOrThrow();
    const home = sessionHomeWeekday(sessionKey);
    if (!home) return { error: "That workout cannot be moved back." };
    const placed = await placeSessionIntentForUser({
      userId: user.id,
      sessionKey,
      weekStart,
      toDay: home,
      intentSeq,
      intent: "restore",
    });
    refreshPlan();
    return { applied: placed.applied, seq: placed.seq };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
