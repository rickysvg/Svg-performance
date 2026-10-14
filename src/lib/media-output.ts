/**
 * Phone speakers and the ringer are the default route for a fresh Web Audio
 * blip. iOS treats that as ambient audio: it follows the silent switch and
 * stays on the handset even when Bluetooth headphones are connected.
 *
 * A playback session ignores the silent switch and follows the media output
 * (AirPods / Bluetooth). The session has to be opened from a tap, then held
 * with a silent loop so a short cue is not swallowed by headphone wake-up.
 */

export type ToneStep = { frequency: number; seconds: number; gain: number };

type AudioSessionLike = { type: string };

let audioCtx: AudioContext | null = null;
let holds = 0;
let primed = false;
let keepPump = 0;
const blobUrls = new Map<string, string>();
const elements = new Map<string, HTMLAudioElement>();

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

/** 16-bit mono PCM WAV. Safe to call in tests (no DOM). */
export function encodeWav(steps: ToneStep[], sampleRate = 22050): ArrayBuffer {
  const totalSamples = steps.reduce(
    (sum, step) => sum + Math.max(1, Math.floor(sampleRate * step.seconds)),
    0,
  );
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const step of steps) {
    const samples = Math.max(1, Math.floor(sampleRate * step.seconds));
    for (let i = 0; i < samples; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, i / (sampleRate * 0.01));
      const release = Math.min(1, (samples - i) / (sampleRate * 0.025));
      const sample = Math.sin(2 * Math.PI * step.frequency * t) * step.gain * Math.min(attack, release);
      view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

function setPlaybackSession() {
  const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
  if (!session) return;
  try {
    session.type = "playback";
  } catch {
    /* Audio Session API is missing on older browsers */
  }
}

export function sharedAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
  return audioCtx;
}

function host() {
  let node = document.getElementById("svg-media-output");
  if (!node) {
    node = document.createElement("div");
    node.id = "svg-media-output";
    node.setAttribute("aria-hidden", "true");
    node.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
    document.body.appendChild(node);
  }
  return node;
}

function blobUrl(key: string, steps: ToneStep[]) {
  const cached = blobUrls.get(key);
  if (cached) return cached;
  const url = URL.createObjectURL(new Blob([encodeWav(steps)], { type: "audio/wav" }));
  blobUrls.set(key, url);
  return url;
}

function audioFor(src: string) {
  let el = elements.get(src);
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.src = src;
    el.muted = false;
    el.setAttribute("playsinline", "true");
    host().appendChild(el);
    elements.set(src, el);
  }
  el.muted = false;
  return el;
}

function keepAliveElement() {
  const el = audioFor(blobUrl("keep", [{ frequency: 28, seconds: 0.45, gain: 0.004 }]));
  el.loop = true;
  return el;
}

function pumpKeepAlive() {
  if (holds <= 0) return;
  const keep = keepAliveElement();
  keep.loop = true;
  keep.muted = false;
  keep.volume = 0.05;
  if (keep.paused) void keep.play().catch(() => undefined);
}

function startPump() {
  if (keepPump) return;
  pumpKeepAlive();
  keepPump = window.setInterval(pumpKeepAlive, 400);
}

function stopPumpSoon() {
  window.setTimeout(() => {
    if (holds > 0) return;
    if (keepPump) {
      window.clearInterval(keepPump);
      keepPump = 0;
    }
    const keep = elements.get(blobUrls.get("keep") ?? "");
    if (!keep) return;
    keep.loop = false;
    keep.pause();
  }, 900);
}

/** Call from a tap so later cues are allowed to play through headphones. */
export function primeMediaOutput() {
  if (typeof window === "undefined") return;
  setPlaybackSession();
  const ctx = sharedAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
  try {
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  } catch {
    /* ignore */
  }
  if (primed) return;
  const keep = keepAliveElement();
  keep.volume = 0.05;
  const pending = keep.play();
  if (!pending) {
    primed = true;
    return;
  }
  void pending
    .then(() => {
      primed = true;
      if (holds <= 0) {
        keep.pause();
        try {
          keep.currentTime = 0;
        } catch {
          /* element may not be seekable yet */
        }
      }
    })
    .catch(() => {
      primed = false;
    });
}

/**
 * Keep the playback route open (Bluetooth stays awake) until released.
 * Start this from the same tap that begins a timer.
 */
export function holdMediaRoute() {
  if (typeof window === "undefined") return () => {};
  holds += 1;
  primeMediaOutput();
  startPump();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    if (holds === 0) stopPumpSoon();
  };
}

function playOscillator(frequency: number, seconds: number, gainValue: number) {
  const ctx = sharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}

function playSteps(key: string, steps: ToneStep[]) {
  if (typeof window === "undefined") return;
  setPlaybackSession();
  const seconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  const el = audioFor(blobUrl(key, steps));
  el.loop = false;
  el.volume = 1;
  el.muted = false;
  try {
    el.currentTime = 0;
  } catch {
    /* not seekable yet */
  }
  const pending = el.play();
  const fallback = () => {
    const first = steps[0];
    if (first) playOscillator(first.frequency, seconds, Math.min(0.45, first.gain));
  };
  if (pending) void pending.catch(() => fallback());
  else fallback();
  if (holds > 0) window.setTimeout(pumpKeepAlive, Math.ceil(seconds * 1000) + 30);
}

export function playWarningCue() {
  playSteps("rest-warning", [{ frequency: 988, seconds: 0.2, gain: 0.72 }]);
}

export function playEndCue() {
  playSteps("rest-end", [
    { frequency: 523, seconds: 0.16, gain: 0.7 },
    { frequency: 784, seconds: 0.28, gain: 0.78 },
  ]);
}

export function playPhaseCue() {
  playSteps("phase", [{ frequency: 740, seconds: 0.16, gain: 0.66 }]);
}

export function playSynthCue(frequency: number, seconds = 0.16, gain = 0.66) {
  const safeSeconds = Math.max(0.05, Math.min(1.2, seconds));
  playSteps(`tone-${Math.round(frequency)}-${Math.round(safeSeconds * 1000)}`, [
    { frequency, seconds: safeSeconds, gain },
  ]);
}

/** File playback (finish sting, badge unlock). Rejects when autoplay blocks it. */
export function playMediaSrc(src: string, volume = 1) {
  if (typeof window === "undefined") return Promise.resolve();
  setPlaybackSession();
  const el = audioFor(src);
  el.loop = false;
  el.volume = Math.max(0, Math.min(1, volume));
  el.muted = false;
  try {
    el.currentTime = 0;
  } catch {
    /* ignore */
  }
  const pending = el.play();
  return pending ?? Promise.resolve();
}

/** Unlock a file during a tap so a later play() survives navigation. */
export function unlockMediaSrc(src: string) {
  if (typeof window === "undefined") return;
  primeMediaOutput();
  const el = audioFor(src);
  const previous = el.volume;
  el.volume = 0.001;
  const pending = el.play();
  if (!pending) return;
  void pending
    .then(() => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      el.volume = previous || 1;
    })
    .catch(() => undefined);
}

export function vibratePattern(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* iOS Safari does not implement the Vibration API */
  }
}
