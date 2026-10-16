import { prisma } from "@/lib/prisma";
import { resolveAiCoach, resolveCoachingStyle } from "@/lib/coaches";
import { scriptForCue, type PlannedCue } from "@/lib/coach/motivation";
import { synthesizeCoachSpeech } from "@/lib/coach/tts";

const memory = new Map<string, { audio: Buffer; mime: string; voice: string; script: string }>();
const pending = new Map<
  string,
  { script: string; promise: Promise<{ audio: Buffer; mime: string; voice: string; script: string } | null> }
>();

function cacheId(coachId: string, style: string, cueKey: string) {
  return `${coachId}:${style}:${cueKey}`;
}

/**
 * One MP3 per coach, intensity, and cue key.
 * The first request generates it. Later requests reuse the row (and this process).
 */
export async function loadCachedCue(input: {
  coachId?: string | null;
  coachingStyle?: string | null;
  cue: PlannedCue;
  synthesize?: typeof synthesizeCoachSpeech;
}): Promise<{ audio: Buffer; mime: string; voice: string; script: string } | null> {
  const coach = resolveAiCoach(input.coachId);
  const style = resolveCoachingStyle(input.coachingStyle);
  const script = scriptForCue(input.cue, coach.id, style.value);
  const id = cacheId(coach.id, style.value, input.cue.cueKey);
  const warm = memory.get(id);
  if (warm && warm.script === script) return warm;
  const inflight = pending.get(id);
  if (inflight && inflight.script === script) return inflight.promise;

  const promise = loadCueFromStore(input, coach.id, style.value, script, id).finally(() => {
    if (pending.get(id)?.promise === promise) pending.delete(id);
  });
  pending.set(id, { script, promise });
  return promise;
}

async function loadCueFromStore(
  input: {
    cue: PlannedCue;
    synthesize?: typeof synthesizeCoachSpeech;
  },
  coachId: string,
  style: string,
  script: string,
  id: string,
): Promise<{ audio: Buffer; mime: string; voice: string; script: string } | null> {
  const coach = resolveAiCoach(coachId);
  const existing = await prisma.coachCueCache.findUnique({
    where: { coachId_style_cueKey: { coachId: coach.id, style, cueKey: input.cue.cueKey } },
  });
  if (existing && existing.audio.byteLength > 32 && existing.script === script) {
    const hit = {
      audio: Buffer.from(existing.audio),
      mime: existing.mimeType || "audio/mpeg",
      voice: existing.voice,
      script: existing.script,
    };
    memory.set(id, hit);
    return hit;
  }

  const synthesize = input.synthesize ?? synthesizeCoachSpeech;
  const spoken = await synthesize(script, coach.id, style, { latency: "low" });
  if (!spoken) return { audio: Buffer.alloc(0), mime: "audio/mpeg", voice: coach.voice, script };

  await prisma.coachCueCache.upsert({
    where: { coachId_style_cueKey: { coachId: coach.id, style, cueKey: input.cue.cueKey } },
    create: {
      coachId: coach.id,
      style,
      cueKey: input.cue.cueKey,
      voice: spoken.voice,
      script,
      audio: Uint8Array.from(spoken.audio),
      mimeType: spoken.mime,
    },
    update: {
      voice: spoken.voice,
      script,
      audio: Uint8Array.from(spoken.audio),
      mimeType: spoken.mime,
    },
  });
  const stored = { audio: spoken.audio, mime: spoken.mime, voice: spoken.voice, script };
  memory.set(id, stored);
  return stored;
}

export function cueFromRequest(body: {
  moment?: string;
  exerciseName?: string;
  previousLoad?: number | null;
  load?: number | null;
  bagTheme?: string;
  id?: string;
}): PlannedCue | null {
  const moment = body.moment;
  if (
    moment !== "start" &&
    moment !== "exercise" &&
    moment !== "rest10" &&
    moment !== "hard-set" &&
    moment !== "pr" &&
    moment !== "halfway" &&
    moment !== "bag-round" &&
    moment !== "finish"
  ) {
    return null;
  }
  const exerciseName = body.exerciseName?.trim().slice(0, 80) || undefined;
  const generic =
    moment === "start" ||
    moment === "rest10" ||
    moment === "hard-set" ||
    moment === "halfway" ||
    moment === "finish";
  let cueKey = moment;
  if (moment === "exercise" && exerciseName) {
    cueKey = `exercise:${exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`;
  } else if (moment === "bag-round") {
    const theme = (body.bagTheme || exerciseName || "bag").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
    cueKey = `bag:${theme}`;
  } else if (moment === "pr" && exerciseName) {
    const prev = body.previousLoad == null ? "x" : String(Math.round(body.previousLoad));
    const next = body.load == null ? "y" : String(Math.round(body.load));
    cueKey = `pr:${exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}:${prev}:${next}`;
  }
  return {
    id: body.id?.slice(0, 80) || cueKey,
    moment,
    cueKey,
    dynamic: !generic,
    exerciseName,
    previousLoad: body.previousLoad,
    load: body.load,
    bagTheme: body.bagTheme?.slice(0, 80),
  };
}
