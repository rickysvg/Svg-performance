/** Pure helpers for the on-device summary voice. No DOM. */

const MALE_VOICE =
  /daniel|alex|aaron|fred|rishi|david|guy|male|daniel compact|google uk english male|microsoft david/i;
const FEMALE_VOICE =
  /samantha|victoria|karen|moira|fiona|zira|female|google uk english female|microsoft zira|serena/i;

export type SpeechVoice = {
  name: string;
  lang: string;
};

export function coachVoiceGender(coachId?: string | null): "male" | "female" {
  if (coachId === "skye" || coachId === "maya") return "female";
  return "male";
}

export function pickEnglishVoice<T extends SpeechVoice>(
  voices: T[],
  coachId?: string | null,
): T | null {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;
  const gender = coachVoiceGender(coachId);
  const wanted = gender === "female" ? FEMALE_VOICE : MALE_VOICE;
  const other = gender === "female" ? MALE_VOICE : FEMALE_VOICE;
  return (
    english.find((voice) => wanted.test(voice.name)) ??
    english.find((voice) => !other.test(voice.name)) ??
    english[0]
  );
}

function splitLong(text: string, max: number) {
  if (text.length <= max) return [text];
  const parts = text.split(/,\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    const next = current ? `${current}, ${part}` : part;
    if (next.length > max && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= max) return [chunk];
    const out: string[] = [];
    for (let index = 0; index < chunk.length; index += max) {
      out.push(chunk.slice(index, index + max).trim());
    }
    return out.filter(Boolean);
  });
}

/** Sentence-sized chunks. iOS cuts off one long utterance. */
export function chunkSpeech(text: string, max = 160) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (`${current} ${sentence}`.length > max) {
      chunks.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => splitLong(chunk, max));
}
