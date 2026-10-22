import { notFound, redirect } from "next/navigation";
import { startProgramDayLog } from "@/app/actions/workouts";
import { getAppTier } from "@/lib/entitlements";
import { NotFoundError } from "@/lib/errors";
import { startRequestCreatesSession } from "@/lib/start-request";
import { requireUser } from "@/lib/session";

/**
 * Opening a programmed day is a command, not a screen. A page that immediately
 * redirect()s during a client navigation makes the browser throw
 * `performance.measure` ("negative time stamp") and Next shows that as a dev
 * issue on the logger. An HTTP redirect never renders that component.
 *
 * Prefetch and cross-site GETs are answered with the day page and do not
 * create a draft. A real visit reuses today's matching draft.
 */
export async function GET(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await context.params;
  const half = new URL(request.url).searchParams.get("half") === "1";
  if (!startRequestCreatesSession(request.headers)) {
    redirect(half ? `/training/${dayId}?half=1` : `/training/${dayId}`);
  }
  const user = await requireUser();
  const tier = await getAppTier(user.id);
  if (tier === "locked" && user.role !== "admin" && user.role !== "coach") {
    redirect("/home");
  }
  let session;
  try {
    session = await startProgramDayLog(user.id, dayId, half);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  redirect(`/training/log/${session.id}`);
}
