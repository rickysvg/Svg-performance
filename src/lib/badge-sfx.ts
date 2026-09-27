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

/** Short original finish sting — impact + sparkle. Respects the sound toggle. */
export function playFinishSfx() {
  if (!soundFxEnabled()) return;
  const context = ctx();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.7, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  master.connect(context.destination);

  const thump = context.createOscillator();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(72, now + 0.16);
  const thumpGain = context.createGain();
  thumpGain.gain.setValueAtTime(0.55, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  thump.connect(thumpGain);
  thumpGain.connect(master);
  thump.start(now);
  thump.stop(now + 0.22);

  const snap = context.createOscillator();
  snap.type = "square";
  snap.frequency.setValueAtTime(740, now);
  snap.frequency.exponentialRampToValueAtTime(220, now + 0.09);
  const snapGain = context.createGain();
  snapGain.gain.setValueAtTime(0.18, now);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  snap.connect(snapGain);
  snapGain.connect(master);
  snap.start(now);
  snap.stop(now + 0.11);

  const sparkle = context.createOscillator();
  sparkle.type = "sine";
  sparkle.frequency.setValueAtTime(1480, now + 0.04);
  sparkle.frequency.exponentialRampToValueAtTime(920, now + 0.32);
  const sparkleGain = context.createGain();
  sparkleGain.gain.setValueAtTime(0.0001, now + 0.04);
  sparkleGain.gain.exponentialRampToValueAtTime(0.22, now + 0.07);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(master);
  sparkle.start(now + 0.04);
  sparkle.stop(now + 0.38);
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
