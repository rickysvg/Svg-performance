"use server";

import { revalidatePath } from "next/cache";
import { publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { moveWorkoutHomeForUser } from "@/lib/week-plan-swap-store";

export async function moveWorkoutHomeAction(sessionKey: string, weekStart: string) {
  try {
    const user = await requireUserOrThrow();
    await moveWorkoutHomeForUser(user.id, sessionKey, weekStart);
    revalidatePath("/training");
    revalidatePath("/training/calendar");
    revalidatePath("/home");
    return {};
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
