import type { PlannedCue } from "@/lib/coach/motivation";
import { coachVoiceEnabled } from "@/lib/coach/config";

const COACH_AUDIO_MIME = "audio/mpeg";

export type CueClip = {
  cueKey: string;
  bytes: ArrayBuffer | null;
  /** In-memory object URL for the same bytes. Empty in environments without Blob URLs. */
  url: string;
  script: string;
  mime: string;
};

const clips = new Map<string, CueClip>();
const inflight = new Map<string, Promise<CueClip | null>>();

function blobUrl(bytes: ArrayBuffer, mime: string) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return "";
  if (typeof Blob === "undefined") return "";
  try {
    return URL.createObjectURL(new Blob([bytes], { type: mime || COACH_AUDIO_MIME }));
  } catch {
    return "";
  }
}

export function peekCueClip(cueKey: string) {
  return clips.get(cueKey) ?? null;
}

export function rememberCueClip(clip: CueClip) {
  clips.set(clip.cueKey, clip);
  return clip;
}

export function resetCueClipCacheForTests() {
  for (const clip of clips.values()) {
    if (clip.url.startsWith("blob:")) URL.revokeObjectURL(clip.url);
  }
  clips.clear();
  inflight.clear();
  fetchCue = fetchCueFromNetwork;
}

async function fetchCueFromNetwork(cue: PlannedCue): Promise<CueClip | null> {
  if (!coachVoiceEnabled()) return null;
  const params = new URLSearchParams();
  params.set("moment", cue.moment);
  if (cue.exerciseName) params.set("exerciseName", cue.exerciseName);
  if (cue.bagTheme) params.set("bagTheme", cue.bagTheme);
  if (cue.previousLoad != null) params.set("previousLoad", String(cue.previousLoad));
  if (cue.load != null) params.set("load", String(cue.load));
  params.set("id", cue.cueKey);
  const response = await fetch(`/api/coach/motivation?${params.toString()}`, {
    headers: { Accept: "audio/mpeg, application/json" },
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  const headerScript = response.headers.get("X-Coach-Script");
  const script = headerScript ? safeDecode(headerScript) : "";
  if (!type.includes("audio")) {
    const body = type.includes("json")
      ? ((await response.json()) as { text?: string; muted?: boolean })
      : null;
    if (body?.muted) return null;
    const text = body?.text || script;
    if (!text) return null;
    return { cueKey: cue.cueKey, bytes: null, url: "", script: text, mime: "application/json" };
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 32) return null;
  return {
    cueKey: cue.cueKey,
    bytes,
    url: blobUrl(bytes, COACH_AUDIO_MIME),
    script,
    mime: type.includes("audio") ? type : COACH_AUDIO_MIME,
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

let fetchCue = fetchCueFromNetwork;

/** Test seam. Pass null to restore the network fetch. */
export function setCueFetcherForTests(fetcher: ((cue: PlannedCue) => Promise<CueClip | null>) | null) {
  fetchCue = fetcher ?? fetchCueFromNetwork;
}

export function prefetchCueClip(cue: PlannedCue): Promise<CueClip | null> {
  const cached = clips.get(cue.cueKey);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(cue.cueKey);
  if (existing) return existing;
  const job = fetchCue(cue)
    .then((clip) => {
      if (clip) clips.set(cue.cueKey, clip);
      return clip;
    })
    .finally(() => {
      if (inflight.get(cue.cueKey) === job) inflight.delete(cue.cueKey);
    });
  inflight.set(cue.cueKey, job);
  return job;
}

/** Resolve a clip. A memory hit does not wait on the network. */
export async function resolveCueClip(cue: PlannedCue): Promise<{ clip: CueClip | null; fromMemory: boolean }> {
  const cached = clips.get(cue.cueKey);
  if (cached) return { clip: cached, fromMemory: true };
  return { clip: await prefetchCueClip(cue), fromMemory: false };
}

/** Warm the session. A few clips at a time so a cold TTS cache is not stampeded. */
export async function prefetchCueClips(cues: PlannedCue[]) {
  const queue = cues.filter((cue) => !clips.has(cue.cueKey));
  const workers = Math.min(4, queue.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (queue.length > 0) {
        const cue = queue.shift();
        if (!cue) return;
        await prefetchCueClip(cue);
      }
    }),
  );
}
