import { notFound, redirect } from "next/navigation";
import { getAppTier } from "@/lib/entitlements";
import { ForbiddenError } from "@/lib/errors";
import { startDayPlanForUser } from "@/lib/my-workouts";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { startRequestCreatesSession } from "@/lib/start-request";
import { requireUser } from "@/lib/session";

/**
 * Explicit Start for an applied My Workout. Prefetch and cross-site GETs
 * stay on the read-only plan page and do not create a draft.
 */
export async function GET(request: Request, context: { params: Promise<{ planId: string }> }) {
  const { planId } = await context.params;
  if (!startRequestCreatesSession(request.headers)) {
    redirect(`/training/my-workouts/day/${planId}`);
  }
  const user = await requireUser();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  try {
    const session = await startDayPlanForUser({
      userId: user.id,
      planId,
      preferredUnits: profile?.preferredUnits ?? "lb",
      timeZone,
    });
    redirect(`/training/log/${session.id}`);
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
}
