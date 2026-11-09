import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function walk(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Files that may play audio, and only after an explicit hear tap. */
const HEAR_FILES = new Set([
  "src/lib/coach/spoken-audio.ts",
  "src/components/coach/CoachSpeakButton.tsx",
  "src/components/coach/CoachLiveThread.tsx",
  "src/components/coach/PrimeCoachAudio.tsx",
  "src/components/home/SummaryReader.tsx",
]);

describe("background music stays uninterrupted", () => {
  it("does not open an audio session except from an explicit hear control", () => {
    const hits: string[] = [];
    for (const file of walk(path.join(root, "src"))) {
      const rel = path.relative(root, file);
      if (HEAR_FILES.has(rel)) continue;
      const source = fs.readFileSync(file, "utf8");
      if (/new Audio\(/.test(source) || /webkitAudioContext/.test(source) || /audioSession/.test(source)) {
        hits.push(rel);
      }
      if (/speechSynthesis/.test(source)) hits.push(`${rel} speech`);
    }
    expect(hits).toEqual([]);
  });

  it("keeps the rest-end banner and the vibrate toggle, with no timer sound controls", () => {
    const logger = fs.readFileSync(path.join(root, "src/components/training/WorkoutLogForm.tsx"), "utf8");
    const timer = fs.readFileSync(path.join(root, "src/components/timer/RoundTimer.tsx"), "utf8");
    const sw = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
    expect(logger).toContain("data-rest-complete");
    expect(logger).toContain('aria-live="assertive"');
    expect(logger).toContain("Rest over");
    expect(logger).not.toContain("primeMediaOutput");
    expect(timer).toContain("Vibrate");
    expect(timer).not.toContain("warning beep");
    expect(timer).not.toContain("Bell start/end");
    expect(sw).toContain("silent: true");
  });
});
