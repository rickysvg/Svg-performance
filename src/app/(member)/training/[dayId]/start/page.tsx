import { notFound, redirect } from "next/navigation";
import { startProgramDayLog } from "@/app/actions/workouts";
import { getAppTier } from "@/lib/entitlements";
import { NotFoundError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export default async function StartProgramDayPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const user = await requireUser();
  const { dayId } = await params;
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  let session;
  try {
    session = await startProgramDayLog(user.id, dayId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  redirect(`/training/log/${session.id}`);
}
