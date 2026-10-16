import { chunkSpeech, pickEnglishVoice } from "@/lib/coach/browser-speech";
import { primeMediaOutput, sharedAudioContext } from "@/lib/media-output";

/** Short silent clip. Playing it inside a tap unlocks the element on iOS Safari. */
export const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export const COACH_AUDIO_FAILED = "Coach voice didn't play";

const SPEECH_PITCH: Record<string, { pitch: number; rate: number }> = {
  ricky: { pitch: 0.75, rate: 0.95 },
  mateo: { pitch: 0.92, rate: 0.92 },
  cole: { pitch: 1.02, rate: 1 },
  skye: { pitch: 1.16, rate: 1.04 },
  maya: { pitch: 1.05, rate: 0.96 },
};

type ActiveCue = {
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
  startedAt: number;
  offset: number;
  onEnded?: () => void;
  generation: number;
};

let persistent: HTMLAudioElement | null = null;
let elementArmed = false;
let objectUrl: string | null = null;
let gestureUnlocked = false;
let resumePromise: Promise<void> | null = null;
let gain: GainNode | null = null;
let volume = 1;
let playGeneration = 0;
let current: ActiveCue | null = null;
let held: { buffer: AudioBuffer; offset: number; onEnded?: () => void } | null = null;
let issue: string | null = null;
let issueToken = 0;
const issueListeners = new Set<(value: string | null) => void>();

export function tuneForCoach(coachId: string) {
  return SPEECH_PITCH[coachId] ?? { pitch: 1, rate: 1 };
}

export function bindCoachAudio(audio: HTMLAudioElement) {
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
}

function persistentElement() {
  if (persistent && persistent.isConnected) return persistent;
  const audio = document.createElement("audio");
  bindCoachAudio(audio);
  audio.setAttribute("data-coach-audio", "persistent");
  audio.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
  document.body.appendChild(audio);
  persistent = audio;
  return audio;
}

/**
 * Call synchronously inside a user gesture (Start workout, Coach on, speaker,
 * Read it to me). Resumes one shared AudioContext and arms one audio element.
 * Later cues play through that context, so iOS still allows them after an await.
 * Do not swap this element out or change its src as the only way to play.
 */
export function unlockCoachOutput() {
  if (typeof window === "undefined") return false;
  primeMediaOutput();
  const ctx = sharedAudioContext();
  gestureUnlocked = true;
  if (ctx) {
    const pending = ctx.resume();
    resumePromise = pending.then(() => undefined).catch(() => undefined);
  }
  try {
    if (!elementArmed) {
      const audio = persistentElement();
      if (audio.paused) {
        audio.src = SILENT_WAV;
        const pending = audio.play();
        if (!pending) elementArmed = true;
        else {
          void pending.then(() => {
            elementArmed = true;
          }).catch(() => {
            elementArmed = false;
          });
        }
      }
    }
  } catch {
    /* The context is the path that survives the await. */
  }
  return true;
}

/** @deprecated Prefer unlockCoachOutput. The element argument is not the playback target. */
export function unlockCoachAudio(audio?: HTMLAudioElement | null) {
  if (audio) bindCoachAudio(audio);
  return unlockCoachOutput();
}

export function coachGestureUnlocked() {
  return gestureUnlocked;
}

function isRunning(ctx: AudioContext) {
  return ctx.state === "running";
}

export function coachOutputReady() {
  if (!gestureUnlocked || typeof window === "undefined") return false;
  const ctx = sharedAudioContext();
  return Boolean(ctx && isRunning(ctx));
}

export async function whenCoachOutputReady() {
  if (!gestureUnlocked || typeof window === "undefined") return false;
  const ctx = sharedAudioContext();
  if (!ctx) return false;
  if (isRunning(ctx)) return true;
  const pending = resumePromise;
  if (!pending) return false;
  await Promise.race([
    pending,
    new Promise((resolve) => window.setTimeout(resolve, 400)),
  ]);
  return isRunning(ctx);
}

function outputNode(ctx: AudioContext) {
  if (!gain || gain.context !== ctx) {
    gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
  }
  return gain;
}

export function setCoachOutputVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  if (gain) gain.gain.value = volume;
  if (persistent) persistent.volume = volume;
}

function stopCurrent() {
  held = null;
  if (!current) return;
  playGeneration += 1;
  const source = current.source;
  current = null;
  try {
    source.onended = null;
    source.stop();
  } catch {
    /* already stopped */
  }
}

async function waitUntilRunning(ctx: AudioContext) {
  if (isRunning(ctx)) return true;
  const pending = resumePromise ?? ctx.resume().then(() => undefined).catch(() => undefined);
  await Promise.race([
    pending,
    new Promise((resolve) => window.setTimeout(resolve, 700)),
  ]);
  if (ctx.state === "suspended" && gestureUnlocked) {
    try {
      await ctx.resume();
    } catch {
      /* A resume outside the original tap often stays suspended on iOS. */
    }
  }
  return isRunning(ctx);
}

function startBuffer(ctx: AudioContext, buffer: AudioBuffer, offset: number, onEnded?: () => void) {
  stopCurrent();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(outputNode(ctx));
  const generation = ++playGeneration;
  source.onended = () => {
    if (generation !== playGeneration) return;
    current = null;
    onEnded?.();
  };
  const startAt = Math.max(0, Math.min(offset, Math.max(0, buffer.duration - 0.05)));
  source.start(0, startAt);
  current = { source, buffer, startedAt: ctx.currentTime, offset: startAt, onEnded, generation };
}

async function playThroughContext(bytes: ArrayBuffer, onEnded?: () => void) {
  const ctx = sharedAudioContext();
  if (!ctx) return false;
  const running = await waitUntilRunning(ctx);
  if (!running) return false;
  const copy = bytes.slice(0);
  const audioBuffer = await ctx.decodeAudioData(copy);
  startBuffer(ctx, audioBuffer, 0, onEnded);
  return true;
}

async function playThroughElement(bytes: ArrayBuffer, onEnded?: () => void) {
  const audio = persistentElement();
  bindCoachAudio(audio);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
  audio.onended = () => onEnded?.();
  audio.volume = volume;
  audio.src = objectUrl;
  await audio.play();
}

/**
 * Play MP3 bytes on the context that was resumed during the tap.
 * Resolves when playback has started.
 */
export async function playCoachBytes(bytes: ArrayBuffer, hooks?: { onEnded?: () => void }) {
  if (typeof window === "undefined" || bytes.byteLength < 32) {
    reportCoachAudioIssue(COACH_AUDIO_FAILED);
    throw new Error("coach-audio");
  }
  try {
    const played = await playThroughContext(bytes, hooks?.onEnded);
    if (played) {
      clearCoachAudioIssue();
      return;
    }
  } catch {
    /* decode failed; try the element that was armed in the tap */
  }
  try {
    await playThroughElement(bytes, hooks?.onEnded);
    clearCoachAudioIssue();
  } catch (error) {
    reportCoachAudioIssue(COACH_AUDIO_FAILED);
    throw error instanceof Error ? error : new Error("coach-audio");
  }
}

export function playCoachSrc(audio: HTMLAudioElement, src: string) {
  bindCoachAudio(audio);
  return fetch(src)
    .then((response) => response.arrayBuffer())
    .then((bytes) => playCoachBytes(bytes));
}

export function stopCoachPlayback() {
  stopCurrent();
  if (persistent && !persistent.paused) persistent.pause();
}

export function pauseCoachPlayback() {
  if (current) {
    const elapsed = Math.max(0, current.source.context.currentTime - current.startedAt);
    held = {
      buffer: current.buffer,
      offset: Math.min(current.buffer.duration, current.offset + elapsed),
      onEnded: current.onEnded,
    };
    playGeneration += 1;
    const source = current.source;
    current = null;
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* already stopped */
    }
    return true;
  }
  if (persistent && !persistent.paused) {
    persistent.pause();
    return true;
  }
  return false;
}

export function resumeCoachPlayback() {
  if (held) {
    const ctx = sharedAudioContext();
    const next = held;
    held = null;
    if (!ctx || ctx.state !== "running") {
      held = next;
      return Promise.reject(new Error("coach-audio"));
    }
    startBuffer(ctx, next.buffer, next.offset, next.onEnded);
    return Promise.resolve();
  }
  if (persistent && persistent.src) return persistent.play();
  return Promise.reject(new Error("coach-audio"));
}

export function reportCoachAudioIssue(message: string) {
  issue = message;
  const token = ++issueToken;
  for (const listener of issueListeners) listener(issue);
  const clear = () => {
    if (issueToken !== token) return;
    issue = null;
    for (const listener of issueListeners) listener(null);
  };
  if (typeof window === "undefined") return;
  window.setTimeout(clear, 5000);
}

export function clearCoachAudioIssue() {
  if (!issue) return;
  issue = null;
  issueToken += 1;
  for (const listener of issueListeners) listener(null);
}

export function subscribeCoachAudioIssue(listener: (value: string | null) => void) {
  issueListeners.add(listener);
  listener(issue);
  return () => {
    issueListeners.delete(listener);
  };
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
