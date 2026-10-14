import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt, buildOwnSummary, coachMaxTokens, streamCoachCompletion } from "@/lib/coach/llm";
import { classifyQuestion } from "@/lib/coach/router";

const CAGE_Q = "When on cage can i use elbow against there jaw as a frame?";
const GENERIC =
  "Stay practical and do the next session you already have planned. If you need eyes on a movement, ask a coach on the floor. I will not guess gym-specific policy from here.";
const lane = { topic: "martial_art", art: "mma" };
const live = process.env.COACH_LIVE_EVAL === "1" && Boolean(process.env.OPENAI_API_KEY?.trim());

describe.skipIf(!live)("live SVG Coach eval", () => {
  it(
    "answers the cage-frame question with a real technique",
    async () => {
      const route = classifyQuestion(CAGE_Q, lane);
      const system = buildCoachSystemPrompt({
        topic: lane.topic,
        art: lane.art,
        route,
        ownSummary: buildOwnSummary({
          userId: "live-eval",
          experienceLevel: "intermediate",
          topic: lane.topic,
          art: lane.art,
        }),
      });
      const generator = streamCoachCompletion({
        system,
        history: [],
        message: CAGE_Q,
        maxTokens: coachMaxTokens(route),
        experienceLevel: "intermediate",
        topic: lane.topic,
        art: lane.art,
      });
      let content = "";
      let next = await generator.next();
      while (!next.done) {
        content += next.value;
        next = await generator.next();
      }
      if (next.value?.offline) content = next.value.fallbackText ?? content;
      const words = content.trim().split(/\s+/).filter(Boolean);
      for (const marker of [
        /frame|framing/i,
        /forearm|elbow/i,
        /jaw|chin|face/i,
        /cage|fence/i,
        /legal/i,
        /strike|strik/i,
        /12[- ]?(to[- ])?6/i,
        /amateur/i,
        /commission|promotion/i,
        /wall|circle|angle|underhook|pummel|space/i,
      ]) {
        expect(content).toMatch(marker);
      }
      expect(content).not.toContain(GENERIC);
      expect(content).not.toMatch(/I will not guess/i);
      expect(words.length).toBeGreaterThanOrEqual(120);
      expect(words.length).toBeLessThanOrEqual(450);
    },
    90_000,
  );
});
