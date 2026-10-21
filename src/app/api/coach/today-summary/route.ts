import { NextResponse } from "next/server";
import { getTodayCoachSummary } from "@/lib/coach/day-summary";
import { coachVoiceEnabled } from "@/lib/coach/config";
import { getCurrentUser } from "@/lib/session";
import { AiCapError, consumeAiUse } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!coachVoiceEnabled()) {
    return NextResponse.json(
      { speak: false, muted: true },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to hear today's summary." }, { status: 401 });
  }

  try {
    await consumeAiUse({ userId: user.id, kind: "read_aloud", surface: "today_summary" });
  } catch (error) {
    if (error instanceof AiCapError) {
      return NextResponse.json(
        { error: error.message, paywall: error.reason },
        { status: 402, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }

  const summary = await getTodayCoachSummary(user.id);
  const headers = {
    "X-Summary-Cached": summary.cached ? "1" : "0",
    "X-Summary-Source": summary.source,
    "X-Coach-Voice": summary.voice,
    "Cache-Control": "private, no-store",
  };

  if (summary.audio && summary.audio.byteLength > 32) {
    return new NextResponse(Uint8Array.from(summary.audio), {
      headers: {
        ...headers,
        "Content-Type": summary.mime || "audio/mpeg",
      },
    });
  }

  return NextResponse.json(
    {
      script: summary.script,
      speak: true,
      voice: summary.voice,
      cached: summary.cached,
    },
    { headers },
  );
}
