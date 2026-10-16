import { openAiApiKey } from "@/lib/coach/llm";
import {
  intensitySpeech,
  resolveAiCoach,
  resolveCoachingStyle,
  type AiCoachId,
} from "@/lib/coaches";

/**
 * Base delivery for each coach's OpenAI voice.
 * Voices are unique and valid on both gpt-4o-mini-tts and tts-1.
 * Intensity (coaching style) stacks on top: pace, energy, emphasis, volume, grit.
 */
const SPEECH_INSTRUCTIONS: Record<AiCoachId, string> = {
  skye:
    "Bright woman. Quick, clear speech. Honest and forward. Medium-high energy even before the intensity layer. Crisp consonants. No softness that hides the standard.",
  maya:
    "Calm woman. Warm and precise. Unhurried by default. Lower energy than a hype coach. Land on one detail and let it sit. Clear diction. No rush.",
  mateo:
    "Quiet man. Clear and dry, not a deep voice. Short phrases with a short pause between them. Low energy, high standard. Almost flat. No pep and no gravel.",
  cole:
    "Easy, confident man. Warm mid pitch, not deep and not stern. Conversational. Medium energy, a slight smile in the voice. He stays with the athlete.",
  ricky:
    "Deep, gritty, confident male MMA head coach. Fight-gym voice. Chest resonance and a little gravel. Direct and motivating. Short sentences. Never shout. No fluff and no shame.",
};

export type CoachSpeechProfile = {
  voice: string;
  instructions: string;
  coachId: AiCoachId;
  style: string;
};

export function coachSpeechProfile(
  coachId?: string | null,
  coachingStyle?: string | null,
): CoachSpeechProfile {
  const coach = resolveAiCoach(coachId);
  const style = resolveCoachingStyle(coachingStyle);
  return {
    coachId: coach.id,
    style: style.value,
    voice: coach.voice,
    instructions: `${SPEECH_INSTRUCTIONS[coach.id]} Intensity layer: ${intensitySpeech(style.value)}`,
  };
}

const TTS_TIMEOUT_MS = 25_000;
const TTS_FAST_TIMEOUT_MS = 12_000;

/** What the browser and iOS decode. Opus is smaller but Safari often cannot decode it. */
export const COACH_AUDIO_MIME = "audio/mpeg";

export type CoachSpeechOptions = {
  /**
   * "low" uses tts-1 first. Short workout cues return sooner than gpt-4o-mini-tts.
   * "quality" keeps the instruction-following model and falls back to tts-1.
   */
  latency?: "low" | "quality";
};

export function speechModelsFor(text: string, latency?: CoachSpeechOptions["latency"]) {
  const quality = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const fast = "tts-1";
  const preferFast = latency === "low" || (latency !== "quality" && text.trim().length <= 320);
  if (quality === fast) return [fast];
  return preferFast ? [fast, quality] : [quality, fast];
}

export async function requestSpeech(
  key: string,
  body: Record<string, string>,
  timeoutMs = TTS_TIMEOUT_MS,
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/**
 * MP3 in the coach's voice, with the member's intensity on the delivery.
 * Short cues and latency: "low" use tts-1 first (it returns sooner).
 * Longer reads use gpt-4o-mini-tts, then tts-1 if that fails.
 * Null when the key is missing or every model fails.
 */
export async function synthesizeCoachSpeech(
  text: string,
  coachId?: string | null,
  coachingStyle?: string | null,
  options?: CoachSpeechOptions,
): Promise<{ audio: Buffer; mime: string; voice: string } | null> {
  const key = openAiApiKey();
  if (!key) return null;
  const spoken = text.trim().slice(0, 3500);
  if (!spoken) return null;
  const profile = coachSpeechProfile(coachId, coachingStyle);
  for (const model of speechModelsFor(spoken, options?.latency)) {
    const body: Record<string, string> = {
      model,
      voice: profile.voice,
      input: spoken,
    };
    // tts-1 has no instructions field. Sending one makes the request fail.
    if (model !== "tts-1" && model !== "tts-1-hd") body.instructions = profile.instructions;
    const audio = await requestSpeech(
      key,
      body,
      model === "tts-1" ? TTS_FAST_TIMEOUT_MS : TTS_TIMEOUT_MS,
    );
    if (audio) return { audio, mime: COACH_AUDIO_MIME, voice: profile.voice };
  }
  return null;
}
