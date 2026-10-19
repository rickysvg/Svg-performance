import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodaySummaryView } from "@/components/home/TodaySummaryView";
import { chunkSpeech, pickEnglishVoice } from "@/lib/coach/browser-speech";
import type { DaySummaryFacts } from "@/lib/coach/day-summary";
import fs from "node:fs";
import path from "node:path";

const facts: DaySummaryFacts = {
  coachId: "ricky",
  coachName: "Ricky",
  coachingStyle: "Tough",
  weekday: "Friday",
  dayKind: "train",
  sessions: [
    {
      kind: "bag",
      title: "Bag — intelligent jab",
      cues: ["The bag theme is intelligent jab."],
      lines: ["Theme: intelligent jab.", "About 40 minutes. Warm up, themed rounds, then a short cooldown."],
    },
    {
      kind: "lift",
      title: "Strength — lower",
      cues: ["Back squat at zero to two reps in reserve."],
      lines: ["Back squat · 0-2 RIR", "Main lifts: 4 sets max. Accessories: 3 sets max."],
    },
    {
      kind: "mobility",
      title: "Hips and t-spine",
      cues: ["Easy range."],
      lines: ["Hips and t-spine. Easy range. No grinding."],
    },
  ],
};

describe("today summary page", () => {
  it("renders the regimen and a read-aloud control", () => {
    const html = renderToStaticMarkup(
      createElement(TodaySummaryView, {
        facts,
        script: "Ricky here. Friday. You have bag work and a lift.",
        circle: "/coaches/ricky-face.webp",
        when: "Friday · Oct 16",
      }),
    );
    expect(html).toContain("Friday · Oct 16");
    expect(html).toContain("Coach Ricky");
    expect(html).toContain("Today&#x27;s summary");
    expect(html).toContain("intelligent jab");
    expect(html).toContain("0-2 RIR");
    expect(html).toContain("Hips and t-spine");
    expect(html).toContain("Read it to me");
    expect(html).toContain("data-summary-read");
    expect(html).not.toMatch(/no_key|OPENAI|API key/i);
  });
});

describe("browser speech helpers", () => {
  it("chunks long copy and picks a male English voice for Ricky", () => {
    const chunks = chunkSpeech(
      "Ricky here. Friday. You have bag work. The theme is the jab. Then you lift. Back squat, leave two reps. Sleep. Show up.",
      80,
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
    const voice = pickEnglishVoice(
      [
        { name: "Samantha", lang: "en-US" },
        { name: "Daniel", lang: "en-GB" },
        { name: "Amelie", lang: "fr-FR" },
      ],
      "ricky",
    );
    expect(voice?.name).toBe("Daniel");
    expect(pickEnglishVoice([{ name: "Samantha", lang: "en-US" }], "skye")?.name).toBe("Samantha");
  });

  it("unlocks a persistent audio element in the tap, then falls back to speech", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/SummaryReader.tsx"),
      "utf8",
    );
    const spoken = fs.readFileSync(
      path.join(process.cwd(), "src/lib/coach/spoken-audio.ts"),
      "utf8",
    );
    const click = source.indexOf("function onRead");
    const body = source.slice(click);
    const unlock = body.indexOf("unlockCoachAudio");
    const fetchAt = body.indexOf("void fetchAudio");
    expect(click).toBeGreaterThan(-1);
    expect(unlock).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(unlock);
    expect(source).toContain("data-summary-audio");
    expect(source).toContain("playsInline");
    expect(source).toContain("fallbackSpeech");
    const fetchFn = source.slice(source.indexOf("async function fetchAudio"));
    expect(fetchFn.indexOf("fallbackSpeech")).toBeGreaterThan(fetchFn.indexOf("await fetch"));
    expect(spoken).toContain("speechSynthesis");
    expect(spoken).toContain("SILENT_WAV");
    expect(source).not.toMatch(/no_key/);
  });
});
