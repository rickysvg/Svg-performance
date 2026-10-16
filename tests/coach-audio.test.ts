import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coachAudioResponse } from "@/app/api/coach/motivation/route";
import {
  prefetchCueClip,
  rememberCueClip,
  resetCueClipCacheForTests,
  resolveCueClip,
  setCueFetcherForTests,
} from "@/lib/coach/cue-prefetch";
import { COACH_AUDIO_MIME, speechModelsFor, synthesizeCoachSpeech } from "@/lib/coach/tts";
import type { PlannedCue } from "@/lib/coach/motivation";

const startCue: PlannedCue = {
  id: "start",
  moment: "start",
  cueKey: "start",
  dynamic: false,
  exerciseName: "Back squat",
};

describe("coach audio route", () => {
  it("returns audio/mpeg for a generated cue", () => {
    const bytes = new Uint8Array(64);
    bytes[0] = 1;
    const response = coachAudioResponse(bytes, { "X-Coach-Cue": "start" });
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expect(COACH_AUDIO_MIME).toBe("audio/mpeg");
  });
});

describe("short cue voices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_MODEL;
  });

  it("asks tts-1 first for a short workout cue and keeps mp3", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const calls: Array<Record<string, string>> = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, string>);
      return new Response(new Uint8Array(64));
    });
    const spoken = await synthesizeCoachSpeech("Skye. We start with squat.", "skye", "technical", {
      latency: "low",
    });
    expect(speechModelsFor("Skye. We start with squat.", "low")[0]).toBe("tts-1");
    expect(calls[0]?.model).toBe("tts-1");
    expect(calls[0]?.response_format).toBe("mp3");
    expect(calls[0]?.instructions).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(spoken?.mime).toBe("audio/mpeg");
  });

  it("keeps gpt-4o-mini-tts for a long read", () => {
    expect(speechModelsFor("word ".repeat(200), "quality")[0]).toBe("gpt-4o-mini-tts");
  });
});

describe("cue clip cache", () => {
  afterEach(() => {
    resetCueClipCacheForTests();
  });

  it("plays a cached clip without waiting on the network", async () => {
    const bytes = new Uint8Array(64).buffer;
    rememberCueClip({
      cueKey: "start",
      bytes,
      url: "blob:start",
      script: "Go.",
      mime: "audio/mpeg",
    });
    let fetches = 0;
    setCueFetcherForTests(async () => {
      fetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return null;
    });
    const started = performance.now();
    const result = await resolveCueClip(startCue);
    const elapsed = performance.now() - started;
    expect(result.fromMemory).toBe(true);
    expect(result.clip?.bytes).toBe(bytes);
    expect(fetches).toBe(0);
    expect(elapsed).toBeLessThan(30);
  });

  it("coalesces a cold prefetch into one request", async () => {
    let fetches = 0;
    setCueFetcherForTests(async (cue) => {
      fetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        cueKey: cue.cueKey,
        bytes: new Uint8Array(40).buffer,
        url: "blob:cold",
        script: "Go.",
        mime: "audio/mpeg",
      };
    });
    const [first, second] = await Promise.all([prefetchCueClip(startCue), prefetchCueClip(startCue)]);
    expect(fetches).toBe(1);
    expect(first).toBe(second);
    const again = await resolveCueClip(startCue);
    expect(again.fromMemory).toBe(true);
    expect(fetches).toBe(1);
  });

  it("unlocks on the start and coach controls before playback", () => {
    const cues = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutCoachCues.tsx"),
      "utf8",
    );
    const prime = fs.readFileSync(
      path.join(process.cwd(), "src/components/coach/PrimeCoachAudio.tsx"),
      "utf8",
    );
    const spoken = fs.readFileSync(path.join(process.cwd(), "src/lib/coach/spoken-audio.ts"), "utf8");
    expect(cues).toContain("resolveCueClip");
    expect(cues).toContain("prefetchCueClips");
    expect(cues).toContain("unlockCoachAudio");
    expect(prime).toContain("data-prime-coach-audio");
    expect(prime).toContain("data-coach-motivation");
    expect(prime).toContain("data-summary-read");
    expect(prime).toContain("data-coach-speak");
    expect(spoken).toContain("sharedAudioContext");
    expect(spoken).toContain("playCoachBytes");
    expect(spoken).toContain("Coach voice didn't play");
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/coach/motivation/route.ts"),
      "utf8",
    );
    expect(route).toContain('export async function GET');
    expect(route).toContain("audio/mpeg");
  });
});
