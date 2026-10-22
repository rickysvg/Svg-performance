import { AuthError } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { discardEmptyWorkoutDraft } from "@/lib/workouts";

/** Drop a draft only when the member hits Cancel. A typed set is never deleted. */
export async function POST(request: Request) {
  try {
    const user = await requireUserOrThrow();
    const body = (await request.json().catch(() => null)) as {
      workoutId?: unknown;
      explicit?: unknown;
    } | null;
    const workoutId = typeof body?.workoutId === "string" ? body.workoutId.trim() : "";
    if (!workoutId) return Response.json({ discarded: false }, { status: 400 });
    const result = await discardEmptyWorkoutDraft(user.id, workoutId, {
      explicit: body?.explicit === true,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ discarded: false }, { status: 401 });
    }
    return Response.json({ discarded: false }, { status: 400 });
  }
}
