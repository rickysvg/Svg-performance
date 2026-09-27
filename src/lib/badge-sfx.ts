import type { BadgeCategoryId } from "@/lib/badges";
import { SFX_BY_CATEGORY } from "@/lib/badge-art";

export const SOUND_FX_STORAGE_KEY = "svg_sound_fx";

/** Sparks / badge-settle beat. Studio stings put their boom on this offset. */
export const UNLOCK_HIT_MS = 700;

/**
 * Named unlock / win pairs. Swap ACTIVE_UNLOCK_SFX to preview another option.
 * Existing: metal | cinematic | fightnight
 * Studio logo stings: studio1_boom | studio2_brass | studio3_metal_braam
 */
export const UNLOCK_SFX = {
  metal: { unlock: "/sfx/unlock_metal.mp3", win: "/sfx/win_metal.mp3", hitOffsetMs: 0 },
  cinematic: { unlock: "/sfx/unlock_cinematic.mp3", win: "/sfx/win_cinematic.mp3", hitOffsetMs: 360 },
  fightnight: { unlock: "/sfx/unlock_fightnight.mp3", win: "/sfx/win_fightnight.mp3", hitOffsetMs: 0 },
  studio1_boom: {
    unlock: "/sfx/unlock_studio1_boom.mp3",
    win: "/sfx/win_studio1_boom.mp3",
    hitOffsetMs: UNLOCK_HIT_MS,
  },
  studio2_brass: {
    unlock: "/sfx/unlock_studio2_brass.mp3",
    win: "/sfx/win_studio2_brass.mp3",
    hitOffsetMs: UNLOCK_HIT_MS,
  },
  studio3_metal_braam: {
    unlock: "/sfx/unlock_studio3_metal_braam.mp3",
    win: "/sfx/win_studio3_metal_braam.mp3",
    hitOffsetMs: UNLOCK_HIT_MS,
  },
} as const;

export type UnlockSfxName = keyof typeof UNLOCK_SFX;

/** Ricky picked studio1_boom — drives unlock and the short win sting. */
export const ACTIVE_UNLOCK_SFX: UnlockSfxName = "studio1_boom";

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

function activePair(name: UnlockSfxName = ACTIVE_UNLOCK_SFX) {
  return UNLOCK_SFX[name] ?? UNLOCK_SFX.metal;
}

/** Start early enough that the named option's hit lands on the spark burst. */
export function unlockSfxStartDelayMs(reduce: boolean, name: UnlockSfxName = ACTIVE_UNLOCK_SFX) {
  if (reduce) return 80;
  const hit = activePair(name).hitOffsetMs;
  return Math.max(0, UNLOCK_HIT_MS - hit);
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
  const pair = activePair();
  void loadBuffer(pair.unlock);
  void loadBuffer(pair.win);
  for (const row of Object.values(UNLOCK_SFX)) {
    void loadBuffer(row.unlock);
    void loadBuffer(row.win);
  }
  for (const src of Object.values(SFX_BY_CATEGORY)) {
    void loadBuffer(src);
  }
}

async function playBuffer(src: string, gainValue = 0.95) {
  if (!soundFxEnabled()) return;
  const context = ctx();
  if (!context) return;
  if (context.state === "suspended") {
    await context.resume();
  }
  const buffer = await loadBuffer(src);
  if (!buffer) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = gainValue;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0);
}

/** Full badge-unlock sting for the active named option. */
export function playUnlockSfx(name: UnlockSfxName = ACTIVE_UNLOCK_SFX) {
  return playBuffer(activePair(name).unlock);
}

/** Short per-workout win sting — same named option, under 1s. */
export function playFinishSfx(name: UnlockSfxName = ACTIVE_UNLOCK_SFX) {
  return playBuffer(activePair(name).win);
}

async function loadBuffer(src: string) {
  const context = ctx();
  if (!context) return null;
  const cached = buffers.get(src);
  if (cached) return cached;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const raw = await res.arrayBuffer();
    const decoded = await context.decodeAudioData(raw.slice(0));
    buffers.set(src, decoded);
    return decoded;
  } catch {
    return null;
  }
}

/** Badge unlock uses the named option, not the older per-category files. */
export async function playCategorySfx(_category: BadgeCategoryId) {
  return playUnlockSfx();
}
