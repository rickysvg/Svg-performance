import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getAppTier } from "@/lib/entitlements";
import { ForbiddenError } from "@/lib/errors";
import { startDayPlanForUser } from "@/lib/my-workouts";

export default async function StartDayPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireUser();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  const { planId } = await params;
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
