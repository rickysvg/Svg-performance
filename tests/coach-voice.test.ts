import { describe, expect, it } from "vitest";
import { offlineReply } from "@/lib/coach/offline";
import { coachSpeechProfile } from "@/lib/coach/tts";
import { coachIntroScript } from "@/lib/coach/voice-copy";
import {
  AI_COACHES,
  COACHING_STYLES,
  coachingStyleVoice,
  intensityBand,
  intensitySpeech,
} from "@/lib/coaches";
import { daySummaryFactsKey, templateDaySummary, type DaySummaryFacts } from "@/lib/coach/day-summary";

const TTS_VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

describe("coach speech profiles", () => {
  it("gives every coach a distinct tts-1 voice and a written delivery", () => {
    const voices = AI_COACHES.map((coach) => coach.voice);
    expect(new Set(voices).size).toBe(AI_COACHES.length);
    for (const voice of voices) expect(TTS_VOICES).toContain(voice);
    const ricky = coachSpeechProfile("ricky", "tough");
    expect(ricky.voice).toBe("onyx");
    expect(ricky.instructions).toMatch(/gritty/i);
    expect(ricky.instructions).toMatch(/Drill-sergeant/);
    const calm = coachSpeechProfile("ricky", "supportive");
    expect(calm.voice).toBe("onyx");
    expect(calm.instructions).toMatch(/softer volume/i);
    expect(calm.instructions).not.toMatch(/Drill-sergeant/);
    const tones = AI_COACHES.map((coach) => coachSpeechProfile(coach.id, "technical").instructions);
    expect(new Set(tones).size).toBe(AI_COACHES.length);
  });

  it("stacks intensity on the same coach in the system prompt and offline line", () => {
    expect(intensityBand("supportive")).toBe("calm");
    expect(intensityBand("technical")).toBe("balanced");
    expect(intensityBand("hype")).toBe("lifted");
    expect(intensityBand("Tough")).toBe("intense");
    const calm = coachingStyleVoice("supportive", "Ricky");
    const hard = coachingStyleVoice("tough", "Ricky");
    expect(calm).toMatch(/Intensity: calm/);
    expect(calm).toMatch(/SVG MMA Academy head coach/);
    expect(hard).toMatch(/Intensity: intense/);
    expect(hard).toMatch(/Drill-sergeant/);
    expect(intensitySpeech("hype")).toMatch(/Quicker pace/);
    for (const style of COACHING_STYLES) {
      expect(coachingStyleVoice(style.value, "Maya")).toMatch(/changes tone only/);
    }
    const soft = offlineReply("How do I throw a jab?", "intermediate", "", "martial_art", "boxing", {
      coachName: "Ricky",
      coachingStyle: "supportive",
    });
    const blunt = offlineReply("How do I throw a jab?", "intermediate", "", "martial_art", "boxing", {
      coachName: "Ricky",
      coachingStyle: "tough",
    });
    expect(soft).toMatch(/What is working stays/);
    expect(soft).toMatch(/No fluff/);
    expect(blunt).toMatch(/No fluff\. Do it/);
    expect(soft).not.toBe(blunt);
  });

  it("writes a short in-character intro and changes Ricky's words with intensity", () => {
    const intros = AI_COACHES.map((coach) => coachIntroScript(coach.id, "supportive"));
    expect(new Set(intros).size).toBe(AI_COACHES.length);
    for (const intro of intros) {
      const words = intro.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThan(20);
      expect(words).toBeLessThan(70);
    }
    const bands = COACHING_STYLES.map((style) => coachIntroScript("ricky", style.value));
    expect(new Set(bands).size).toBe(COACHING_STYLES.length);
    expect(bands[0]).toMatch(/Ricky here/);
  });
});

describe("summary cache intensity", () => {
  it("changes the cache key when the coaching style changes", () => {
    const base: DaySummaryFacts = {
      coachId: "ricky",
      coachName: "Ricky",
      coachingStyle: "Tough",
      weekday: "Friday",
      dayKind: "rest",
      sessions: [
        {
          kind: "rest",
          title: "Rest day",
          cues: ["Walk if you want."],
          lines: ["Walk if you want."],
        },
      ],
    };
    const calm = { ...base, coachingStyle: "Supportive" };
    expect(daySummaryFactsKey(base)).not.toBe(daySummaryFactsKey(calm));
    expect(templateDaySummary(base)).toMatch(/^Ricky here/);
    expect(templateDaySummary(calm)).toMatch(/You're in/);
    expect(templateDaySummary(base)).not.toBe(templateDaySummary(calm));
  });
});
