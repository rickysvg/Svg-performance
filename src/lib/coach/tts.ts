import { openAiApiKey } from "@/lib/coach/llm";
import { resolveAiCoach, type AiCoachId } from "@/lib/coaches";

/**
 * Spoken delivery on top of each coach's OpenAI TTS voice.
 * Ricky is onyx (deep). Mateo is echo. Cole is fable. The three stay distinct.
 */
const SPEECH_INSTRUCTIONS: Record<AiCoachId, string> = {
  skye: "Bright, direct woman. Clear pace. Honest and short. No fluff.",
  maya: "Warm, precise woman. Calm. Stay on one detail. No fluff.",
  mateo: "Quiet, intense man. Low energy, high standard. Short pauses. Not a deep voice.",
  cole: "Easy, confident man. Warm, stays with the athlete. Mid pitch, not deep, not stern.",
  ricky:
    "Deep, confident male MMA head coach. Direct, hard-nosed, and motivating. Fight-gym voice. No fluff, no shouting, and no shame.",
};

export type CoachSpeechProfile = {
  voice: string;
  instructions: string;
};

export function coachSpeechProfile(coachId?: string | null): CoachSpeechProfile {
  const coach = resolveAiCoach(coachId);
  return {
    voice: coach.voice,
    instructions: SPEECH_INSTRUCTIONS[coach.id],
  };
}

const TTS_TIMEOUT_MS = 25_000;

async function requestSpeech(
  key: string,
  body: Record<string, string>,
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ response_format: "mp3", ...body }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[coach] tts unavailable", { status: response.status, model: body.model });
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.byteLength > 32 ? bytes : null;
  } catch (error) {
    console.warn("[coach] tts unavailable", {
      model: body.model,
      reason: error instanceof Error ? error.name : "network",
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** MP3 in the coach's voice. Null when the key is missing or speech fails. */
export async function synthesizeCoachSpeech(
  text: string,
  coachId?: string | null,
): Promise<{ audio: Buffer; mime: string; voice: string } | null> {
  const key = openAiApiKey();
  if (!key) return null;
  const spoken = text.trim().slice(0, 3500);
  if (!spoken) return null;
  const profile = coachSpeechProfile(coachId);
  const primary = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const first = await requestSpeech(key, {
    model: primary,
    voice: profile.voice,
    input: spoken,
    instructions: profile.instructions,
  });
  if (first) return { audio: first, mime: "audio/mpeg", voice: profile.voice };
  if (primary === "tts-1") return null;
  const fallback = await requestSpeech(key, {
    model: "tts-1",
    voice: profile.voice,
    input: spoken,
  });
  if (!fallback) return null;
  return { audio: fallback, mime: "audio/mpeg", voice: profile.voice };
}
