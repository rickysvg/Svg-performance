import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachBubble, QUICK_ANSWER_NOTE } from "@/components/coach/CoachLiveThread";
import { buildCoachSystemPrompt } from "@/lib/coach/llm";
import { classifyQuestion } from "@/lib/coach/router";
import { STYLE_LIMITS, styleInstructions } from "@/lib/coach/styles";

const CAGE_Q = "When on cage can i use elbow against there jaw as a frame?";
const lane = { topic: "martial_art", art: "mma" };

describe("coach answer styles", () => {
  it("builds a technique prompt for the incident question", () => {
    const route = classifyQuestion(CAGE_Q, lane);
    const prompt = buildCoachSystemPrompt({
      topic: lane.topic,
      art: lane.art,
      route,
      ownSummary: "x",
    });
    expect(prompt).toMatch(/Position/);
    expect(prompt).toMatch(/Mechanics/);
    expect(prompt).toMatch(/Common mistakes/);
    expect(prompt).toMatch(/Drill/);
    expect(prompt).toMatch(/Rules check/);
    expect(prompt).toMatch(/check your commission/i);
    expect(prompt).toMatch(/MMA/);
    expect(prompt).not.toMatch(/Give one or two technical cues/);
    expect(styleInstructions(route, lane)).toMatch(/Rules check/);
  });

  it("caps tokens by question type", () => {
    expect(STYLE_LIMITS.technique.maxTokens).toBe(650);
    expect(STYLE_LIMITS.rules.maxTokens).toBe(500);
    expect(STYLE_LIMITS.programming.maxTokens).toBe(550);
    expect(STYLE_LIMITS.nutrition.maxTokens).toBe(500);
    expect(STYLE_LIMITS.mindset.maxTokens).toBe(450);
    expect(STYLE_LIMITS.injury.maxTokens).toBe(300);
    expect(STYLE_LIMITS.general.maxTokens).toBe(400);
  });

  it("shows a quick answer note on offline bubbles only", () => {
    const offline = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        offline: true,
        viewerRole: "member",
      }),
    );
    expect(offline).toContain("quick answer");
    expect(offline).toContain(QUICK_ANSWER_NOTE);
    expect(offline).not.toMatch(/API key|OPENAI/i);

    const live = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        offline: false,
        viewerRole: "member",
      }),
    );
    expect(live).not.toContain("quick answer");
    expect(live).not.toContain(QUICK_ANSWER_NOTE);
  });

  it("shows the fallback reason to an admin and hides it from a member", () => {
    const member = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        offline: true,
        fallbackReason: "no_key",
        viewerRole: "member",
      }),
    );
    expect(member).toContain("quick answer");
    expect(member).not.toContain("no_key");

    const admin = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        offline: true,
        fallbackReason: "no_key",
        viewerRole: "admin",
      }),
    );
    expect(admin).toContain("quick answer");
    expect(admin).toContain("no_key");

    const reloaded = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        offline: true,
        viewerRole: "admin",
      }),
    );
    expect(reloaded).toContain("quick answer");
    expect(reloaded).not.toContain("no_key");
  });
});
