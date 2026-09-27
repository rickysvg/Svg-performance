import type { BadgeCategoryId } from "@/lib/badges";
import { SFX_BY_CATEGORY } from "@/lib/badge-art";

export const SOUND_FX_STORAGE_KEY = "svg_sound_fx";

let audioCtx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function ctx() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function soundFxEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_FX_STORAGE_KEY) !== "off";
}

export function setSoundFxEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_FX_STORAGE_KEY, on ? "on" : "off");
}

/** Call from the SAVE tap so the browser allows later playback. */
export function primeUnlockAudio() {
  const context = ctx();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    /* ignore */
  }
  for (const src of Object.values(SFX_BY_CATEGORY)) {
    void loadBuffer(src);
  }
}

async function loadBuffer(src: string) {
  const context = ctx();
  if (!context) return null;
  const cached = buffers.get(src);
  if (cached) return cached;
  const res = await fetch(src);
  const raw = await res.arrayBuffer();
  const decoded = await context.decodeAudioData(raw.slice(0));
  buffers.set(src, decoded);
  return decoded;
}

export async function playCategorySfx(category: BadgeCategoryId) {
  if (!soundFxEnabled()) return;
  const context = ctx();
  if (!context) return;
  if (context.state === "suspended") {
    await context.resume();
  }
  const buffer = await loadBuffer(SFX_BY_CATEGORY[category]);
  if (!buffer) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = 0.85;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0);
}
