import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { COACH_WORKOUT_MOTIVATION_ENABLED, coachVoiceEnabled } from "@/lib/coach/config";
import { cueFromRequest, loadCachedCue } from "@/lib/coach/cue-cache";
import { COACH_AUDIO_MIME } from "@/lib/coach/tts";
import type { PlannedCue } from "@/lib/coach/motivation";

export const dynamic = "force-dynamic";

/**
 * Workout cue in the member's coach voice and intensity.
 * Generic cues are cached in the database. GET responses also send
 * Cache-Control: private, max-age=86400 so the browser can reuse the MP3.
 * The body is audio/mpeg (mp3). tts-1 generates short cues; see synthesizeCoachSpeech.
 */
export function coachAudioResponse(audio: Uint8Array, headers: Record<string, string> = {}) {
  return new NextResponse(Uint8Array.from(audio), {
    headers: {
      ...headers,
      "Content-Type": COACH_AUDIO_MIME,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

function cueFromUrl(url: URL): PlannedCue | null {
  const previous = url.searchParams.get("previousLoad");
  const load = url.searchParams.get("load");
  return cueFromRequest({
    moment: url.searchParams.get("moment") ?? undefined,
    exerciseName: url.searchParams.get("exerciseName") ?? undefined,
    bagTheme: url.searchParams.get("bagTheme") ?? undefined,
    id: url.searchParams.get("id") ?? undefined,
    previousLoad: previous == null || previous === "" ? null : Number(previous),
    load: load == null || load === "" ? null : Number(load),
  });
}

function motivationOffResponse() {
  return NextResponse.json(
    { speak: false, muted: true },
    { status: 200, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function respond(cue: PlannedCue | null) {
  if (!COACH_WORKOUT_MOTIVATION_ENABLED || !coachVoiceEnabled()) return motivationOffResponse();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to hear your coach." }, { status: 401 });
  }
  const profile = await getProfileForUser(user.id);
  if (profile && profile.coachMotivation === false) {
    return NextResponse.json(
      { speak: false, muted: true },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!cue) {
    return NextResponse.json({ error: "Unknown cue." }, { status: 400 });
  }
  const loaded = await loadCachedCue({
    coachId: profile?.aiCoachId,
    coachingStyle: profile?.coachingStyle,
    cue,
  });
  if (!loaded) {
    return NextResponse.json(
      { speak: true, text: "" },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const headers = {
    "X-Coach-Voice": loaded.voice,
    "X-Coach-Cue": cue.cueKey,
    "X-Coach-Script": encodeURIComponent(loaded.script),
    Vary: "Cookie",
  };
  if (loaded.audio.byteLength > 32) {
    return coachAudioResponse(Uint8Array.from(loaded.audio), headers);
  }
  return NextResponse.json(
    { speak: true, text: loaded.script, voice: loaded.voice },
    { headers: { ...headers, "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  return respond(cueFromUrl(new URL(request.url)));
}

export async function POST(request: Request) {
  let body: Parameters<typeof cueFromRequest>[0];
  try {
    body = (await request.json()) as Parameters<typeof cueFromRequest>[0];
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }
  return respond(cueFromRequest(body));
}
