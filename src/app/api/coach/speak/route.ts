import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";
import { synthesizeCoachSpeech } from "@/lib/coach/tts";
import { AiCapError, consumeAiUse, estimateSpeechSeconds } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

/** Spoken coach reply. Uses the signed-in member's coach and intensity. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to hear your coach." }, { status: 401 });
  }
  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }
  const text = String(body.text ?? "").trim().slice(0, 3500);
  if (!text) {
    return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  }
  try {
    await consumeAiUse({
      userId: user.id,
      kind: "voice",
      surface: "speak",
      units: estimateSpeechSeconds(text),
    });
  } catch (error) {
    if (error instanceof AiCapError) {
      return NextResponse.json(
        { error: error.message, paywall: error.reason },
        { status: 402, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }
  const profile = await getProfileForUser(user.id);
  const coach = resolveAiCoach(profile?.aiCoachId);
  const style = resolveCoachingStyle(profile?.coachingStyle);
  const spoken = await synthesizeCoachSpeech(text, coach.id, style.value);
  const headers = {
    "X-Coach-Voice": coach.voice,
    "X-Coach-Style": style.value,
    "Cache-Control": "private, no-store",
  };
  if (spoken && spoken.audio.byteLength > 32) {
    return new NextResponse(Uint8Array.from(spoken.audio), {
      headers: {
        ...headers,
        "Content-Type": spoken.mime || "audio/mpeg",
        "X-Coach-Script": encodeURIComponent(text),
      },
    });
  }
  return NextResponse.json({ speak: true, text, voice: coach.voice }, { headers });
}
