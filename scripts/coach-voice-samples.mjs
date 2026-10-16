/**
 * Write coach voice samples into ./voice-samples/.
 * Needs OPENAI_API_KEY. Uses gpt-4o-mini-tts, then tts-1 with the same voice.
 *
 *   node scripts/coach-voice-samples.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error("Set OPENAI_API_KEY to write voice samples.");
  process.exit(1);
}

if (!process.env.COACH_VOICE_TSX) {
  const result = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    env: { ...process.env, COACH_VOICE_TSX: "1" },
  });
  process.exit(result.status ?? 1);
}

const { mkdir, writeFile } = await import("node:fs/promises");
const path = await import("node:path");
const { AI_COACHES, COACHING_STYLES } = await import("../src/lib/coaches.ts");
const { coachIntroScript, rickySummarySample } = await import("../src/lib/coach/voice-copy.ts");
const { motivationScript } = await import("../src/lib/coach/motivation.ts");
const { synthesizeCoachSpeech } = await import("../src/lib/coach/tts.ts");

const outDir = path.join(process.cwd(), "voice-samples");
await mkdir(outDir, { recursive: true });

async function writeSample(filename, text, coachId, style) {
  const spoken = await synthesizeCoachSpeech(text, coachId, style);
  if (!spoken) {
    throw new Error(`No audio for ${filename}. Check the key and the TTS response.`);
  }
  const file = path.join(outDir, filename);
  await writeFile(file, spoken.audio);
  console.log(`${filename}  ${spoken.voice}  ${style}  ${spoken.audio.byteLength} bytes`);
}

for (const coach of AI_COACHES) {
  const style = coach.id === "ricky" ? "tough" : "supportive";
  await writeSample(
    `${coach.id}-intro.mp3`,
    coachIntroScript(coach.id, style),
    coach.id,
    style,
  );
}

for (const style of COACHING_STYLES) {
  await writeSample(
    `ricky-${style.value}.mp3`,
    coachIntroScript("ricky", style.value),
    "ricky",
    style.value,
  );
}

await writeSample("ricky-summary.mp3", rickySummarySample(), "ricky", "tough");

const motivation = [
  ["ricky-motivation-start.mp3", "start", "ricky", "tough", { exerciseName: "Back squat" }],
  ["ricky-motivation-rest.mp3", "rest10", "ricky", "tough", {}],
  ["ricky-motivation-finish.mp3", "finish", "ricky", "tough", {}],
  ["maya-motivation-exercise.mp3", "exercise", "maya", "technical", { exerciseName: "Back squat" }],
];

for (const [filename, moment, coachId, style, detail] of motivation) {
  await writeSample(filename, motivationScript(moment, coachId, style, detail), coachId, style);
}

console.log(`Wrote samples to ${outDir}`);
