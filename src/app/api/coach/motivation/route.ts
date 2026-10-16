import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { cueFromRequest, loadCachedCue } from "@/lib/coach/cue-cache";

export const dynamic = "force-dynamic";

/**
 * Workout cue in the member's coach voice and intensity.
 * Generic cues are cached in the database and may be reused by the CDN
 * for a day. Dynamic cues (exercise name, a new load) are cached by key too.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to hear your coach." }, { status: 401 });
  }
  const profile = await getProfileForUser(user.id);
  if (profile && profile.coachMotivation === false) {
    return NextResponse.json({ speak: false, muted: true }, { status: 200 });
  }
  let body: Parameters<typeof cueFromRequest>[0];
  try {
    body = (await request.json()) as Parameters<typeof cueFromRequest>[0];
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }
  const cue = cueFromRequest(body);
  if (!cue) {
    return NextResponse.json({ error: "Unknown cue." }, { status: 400 });
  }
  const loaded = await loadCachedCue({
    coachId: profile?.aiCoachId,
    coachingStyle: profile?.coachingStyle,
    cue,
  });
  if (!loaded) {
    return NextResponse.json({ speak: true, text: "" }, { status: 200 });
  }
  const headers = {
    "X-Coach-Voice": loaded.voice,
    "X-Coach-Cue": cue.cueKey,
    "X-Coach-Script": encodeURIComponent(loaded.script),
    // Private: the clip follows this member's coach. The shared copy lives in CoachCueCache.
    "Cache-Control": "private, max-age=86400",
  };
  if (loaded.audio.byteLength > 32) {
    return new NextResponse(Uint8Array.from(loaded.audio), {
      headers: { ...headers, "Content-Type": loaded.mime || "audio/mpeg" },
    });
  }
  return NextResponse.json({ speak: true, text: loaded.script, voice: loaded.voice }, { headers });
}
