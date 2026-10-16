import { NextResponse } from "next/server";
import { getTodayCoachSummary } from "@/lib/coach/day-summary";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to hear today's summary." }, { status: 401 });
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
