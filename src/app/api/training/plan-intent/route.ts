import { revalidatePath } from "next/cache";
import { AuthError, publicErrorMessage } from "@/lib/errors";
import { requireUserOrThrow } from "@/lib/session";
import { placeSessionIntentForUser, type SessionIntentKind } from "@/lib/week-plan-swap-store";

type IncomingIntent = {
  sessionKey: string;
  weekStart: string;
  toDay: string;
  intentSeq: number;
  intent: SessionIntentKind;
};

const RETRY_MESSAGE = "That move did not save. Try again.";

function readIntent(value: unknown): IncomingIntent | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.sessionKey !== "string" || !item.sessionKey) return null;
  if (typeof item.weekStart !== "string" || !item.weekStart) return null;
  if (typeof item.toDay !== "string" || !item.toDay) return null;
  if (item.intent !== "move" && item.intent !== "restore") return null;
  if (typeof item.intentSeq !== "number" || !Number.isInteger(item.intentSeq) || item.intentSeq < 1) {
    return null;
  }
  return {
    sessionKey: item.sessionKey,
    weekStart: item.weekStart,
    toDay: item.toDay,
    intentSeq: item.intentSeq,
    intent: item.intent,
  };
}

function refreshPlan() {
  revalidatePath("/training");
  revalidatePath("/training/calendar");
  revalidatePath("/home");
}

/** Save move and undo clicks. A plain POST is not cancelled when the calendar refreshes. */
export async function POST(request: Request) {
  try {
    const user = await requireUserOrThrow();
    const body = (await request.json().catch(() => null)) as { intents?: unknown } | null;
    const raw = Array.isArray(body?.intents) ? body.intents : [];
    const intents = raw.map(readIntent).filter((item): item is IncomingIntent => item != null);
    if (intents.length === 0 || intents.length > 20) {
      return Response.json({ error: RETRY_MESSAGE }, { status: 400 });
    }
    intents.sort((a, b) => a.intentSeq - b.intentSeq);
    const results = [];
    for (const item of intents) {
      try {
        const placed = await placeSessionIntentForUser({
          userId: user.id,
          sessionKey: item.sessionKey,
          weekStart: item.weekStart,
          toDay: item.toDay,
          intentSeq: item.intentSeq,
          intent: item.intent,
        });
        results.push({ intentSeq: item.intentSeq, applied: placed.applied, seq: placed.seq });
      } catch (error) {
        if (error instanceof AuthError) throw error;
        const message = publicErrorMessage(error);
        results.push({
          intentSeq: item.intentSeq,
          applied: false,
          seq: item.intentSeq,
          error: message,
          retry: message === RETRY_MESSAGE,
        });
      }
    }
    if (results.some((item) => item.applied)) refreshPlan();
    return Response.json({ results });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const message = publicErrorMessage(error);
    const status = message === RETRY_MESSAGE ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
