import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CoachBubble } from "@/components/coach/CoachLiveThread";
import { CoachChoiceFields } from "@/components/coach/CoachChoiceFields";
import { CoachFabLink } from "@/components/coach/CoachFab";
import { CoachIdentity } from "@/components/coach/CoachIdentity";
import { dismissCoachPromptForUser, saveCoachChoiceForUser } from "@/lib/coach-choice";
import { buildCoachSystemPrompt } from "@/lib/coach/llm";
import { classifyQuestion } from "@/lib/coach/router";
import { safetyPreamble } from "@/lib/coach/safety";
import { prisma } from "@/lib/prisma";
import { getProfileForUser } from "@/lib/profile";
import {
  COACHES,
  COACHING_STYLES,
  coachFabBottomClass,
  coachingStyleVoice,
  needsCoachChoicePrompt,
  resolveCoach,
  resolveCoachingStyle,
  shouldHideCoachFab,
} from "@/lib/coaches";
import { makeUser, resetDatabase } from "./helpers";

describe("coach avatars", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ships six coaches and four styles, with a default for an empty profile", () => {
    expect(COACHES).toHaveLength(6);
    expect(COACHING_STYLES.map((style) => style.id)).toEqual([
      "tough",
      "supportive",
      "technical",
      "hype",
    ]);
    expect(resolveCoach("").name).toBe("Lena");
    expect(resolveCoach("nope").id).toBe("lena");
    expect(resolveCoachingStyle("").id).toBe("supportive");
    expect(resolveCoachingStyle("balanced").label).toBe("Supportive");
    for (const coach of COACHES) {
      expect(coach.src).toBe(`/coaches/${coach.id}.webp`);
      expect(coach.thumbSrc).toBe(`/coaches/${coach.id}-thumb.webp`);
      expect(coach.vibe.length).toBeGreaterThan(8);
    }
  });

  it("persists a choice and treats a missing choice as the default until dismissed", async () => {
    const user = await makeUser("coach-pick@example.com");
    const fresh = await getProfileForUser(user.id);
    expect(fresh?.aiCoachId).toBe("");
    expect(fresh?.coachingStyle).toBe("");
    expect(fresh?.coachChoiceAt).toBeNull();
    expect(needsCoachChoicePrompt(fresh)).toBe(true);
    expect(resolveCoach(fresh?.aiCoachId).name).toBe("Lena");

    const saved = await saveCoachChoiceForUser(user.id, {
      coachId: "malik",
      coachingStyle: "technical",
    });
    expect(saved.aiCoachId).toBe("malik");
    expect(saved.coachingStyle).toBe("technical");
    expect(saved.coachChoiceAt).toBeTruthy();
    expect(needsCoachChoicePrompt(saved)).toBe(false);

    const ignored = await saveCoachChoiceForUser(user.id, {
      coachId: "not-a-coach",
      coachingStyle: "yelling",
    });
    expect(ignored.aiCoachId).toBe("lena");
    expect(ignored.coachingStyle).toBe("supportive");
  });

  it("dismisses the one-time prompt without overwriting a later choice", async () => {
    const user = await makeUser("coach-dismiss@example.com");
    const dismissed = await dismissCoachPromptForUser(user.id);
    expect(dismissed.coachChoiceAt).toBeTruthy();
    expect(dismissed.aiCoachId).toBe("");
    expect(needsCoachChoicePrompt(dismissed)).toBe(false);

    await saveCoachChoiceForUser(user.id, {
      coachId: "sloane",
      coachingStyle: "hype",
    });
    const again = await dismissCoachPromptForUser(user.id);
    expect(again.aiCoachId).toBe("sloane");
    expect(again.coachingStyle).toBe("hype");
    expect(again.coachChoiceAt).toBeTruthy();
  });

  it("adapts the system prompt tone without dropping answer style or weight-cut rules", () => {
    const route = classifyQuestion("When on cage can i use elbow against there jaw as a frame?", {
      topic: "martial_art",
      art: "mma",
    });
    const prompt = buildCoachSystemPrompt({
      topic: "martial_art",
      art: "mma",
      route,
      ownSummary: "x",
      coachName: "Malik",
      coachingStyle: "tough",
    });
    expect(prompt).toMatch(/Speak as Malik/);
    expect(prompt).toMatch(/Drill-sergeant|drill-sergeant/);
    expect(prompt).toMatch(/tone only/i);
    expect(prompt).toMatch(/Position/);
    expect(prompt).toMatch(/Mechanics/);
    expect(prompt).toMatch(/weight-cut|dehydrat/i);
    expect(safetyPreamble()).toMatch(/weight-cut|dehydrat/i);
    expect(coachingStyleVoice({})).toBe("");

    const nutrition = buildCoachSystemPrompt({
      route: classifyQuestion("How should I eat on a weight cut?"),
      ownSummary: "x",
      coachName: "Maren",
      coachingStyle: "supportive",
    });
    expect(nutrition).toMatch(/Speak as Maren/);
    expect(nutrition).toMatch(/Never give dehydration/);
    expect(nutrition).toMatch(/Answer style: nutrition/);
  });

  it("renders the picker, the chat header, and a left-side lime coach button", () => {
    const picker = renderToStaticMarkup(
      createElement(CoachChoiceFields, { coachId: "andre", styleId: "hype" }),
    );
    for (const coach of COACHES) {
      expect(picker).toContain(coach.name);
      expect(picker).toContain(coach.vibe);
      expect(picker).toContain(coach.src);
    }
    for (const style of COACHING_STYLES) {
      expect(picker).toContain(style.label);
      expect(picker).toContain(style.detail);
    }
    expect(picker).toContain('value="andre"');
    expect(picker).toContain('value="hype"');

    const header = renderToStaticMarkup(
      createElement(CoachIdentity, {
        coach: resolveCoach("sloane"),
        styleLabel: "Hype",
      }),
    );
    expect(header).toContain("data-coach-header");
    expect(header).toContain("Sloane");
    expect(header).toContain("SVG Coach");
    expect(header).toContain("ring-accent");

    const bubble = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Frame the jaw.",
        coachName: "Sloane",
        coachThumb: "/coaches/sloane-thumb.webp",
      }),
    );
    expect(bubble).toContain("Sloane");
    expect(bubble).toContain("/coaches/sloane-thumb.webp");

    const fab = renderToStaticMarkup(
      createElement(CoachFabLink, {
        name: "Lena",
        thumbSrc: "/coaches/lena-thumb.webp",
        className: `fixed z-30 h-12 w-12 overflow-hidden rounded-full ring-2 ring-accent left-[max(0.75rem,env(safe-area-inset-left))] ${coachFabBottomClass("/home")}`,
      }),
    );
    expect(fab).toContain('data-coach-fab');
    expect(fab).toContain('href="/coach"');
    expect(fab).toContain("h-12");
    expect(fab).toContain("w-12");
    expect(fab).toContain("ring-accent");
    expect(fab).toContain("safe-area-inset-left");
    expect(fab).toContain("safe-area-inset-bottom");
    expect(shouldHideCoachFab("/coach")).toBe(true);
    expect(shouldHideCoachFab("/home")).toBe(false);
    expect(coachFabBottomClass("/training/log/abc")).toContain("6.75rem");
    expect(coachFabBottomClass("/home")).toContain("5.25rem");
    expect(coachFabBottomClass("/home", { staffDock: true })).toContain("7.5rem");
  });
});
