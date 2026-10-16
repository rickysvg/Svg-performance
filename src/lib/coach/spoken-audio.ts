import { chunkSpeech, pickEnglishVoice } from "@/lib/coach/browser-speech";

/** Short silent clip. Playing it inside a tap unlocks the element on iOS Safari. */
export const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const SPEECH_PITCH: Record<string, { pitch: number; rate: number }> = {
  ricky: { pitch: 0.75, rate: 0.95 },
  mateo: { pitch: 0.92, rate: 0.92 },
  cole: { pitch: 1.02, rate: 1 },
  skye: { pitch: 1.16, rate: 1.04 },
  maya: { pitch: 1.05, rate: 0.96 },
};

export function tuneForCoach(coachId: string) {
  return SPEECH_PITCH[coachId] ?? { pitch: 1, rate: 1 };
}

export function bindCoachAudio(audio: HTMLAudioElement) {
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
}

/**
 * Call synchronously inside the user gesture, on a persistent audio element
 * that is already in the document. Later play() calls on this element can
 * start after the TTS blob returns.
 */
export function unlockCoachAudio(audio: HTMLAudioElement) {
  bindCoachAudio(audio);
  if (!audio.src) audio.src = SILENT_WAV;
  else if (audio.paused) audio.src = SILENT_WAV;
  try {
    const pending = audio.play();
    if (pending) void pending.catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function playCoachSrc(audio: HTMLAudioElement, src: string) {
  bindCoachAudio(audio);
  audio.src = src;
  return audio.play();
}

/** Browser voice. Used only after OpenAI speech fails. */
export function speakFallback(text: string, coachId: string) {
  const synth = window.speechSynthesis;
  if (!synth) return false;
  const chunks = chunkSpeech(text);
  if (chunks.length === 0) return false;
  const tune = tuneForCoach(coachId);
  const voice = pickEnglishVoice(synth.getVoices(), coachId);
  synth.cancel();
  synth.resume();
  for (const chunk of chunks) {
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.lang = "en-US";
    utter.pitch = tune.pitch;
    utter.rate = tune.rate;
    if (voice) utter.voice = voice;
    synth.speak(utter);
  }
  synth.resume();
  return true;
}
