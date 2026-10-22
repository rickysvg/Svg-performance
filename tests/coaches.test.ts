import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AI_COACHES,
  COACHING_STYLES,
  DEFAULT_AI_COACH_ID,
  DEFAULT_COACHING_STYLE,
  coachingStyleVoice,
  coachFabClearsBottomBar,
  needsCoachChoicePrompt,
  resolveAiCoach,
  resolveCoachingStyle,
  shouldShowCoachFab,
} from "@/lib/coaches";
import { buildCoachSystemPrompt } from "@/lib/coach/llm";
import { classifyQuestion } from "@/lib/coach/router";
import { safetyPreamble } from "@/lib/coach/safety";
import { CoachBubble } from "@/components/coach/CoachLiveThread";
import {
  completeOnboardingForUser,
  validateOnboardingInput,
} from "@/lib/onboarding";
import { dismissCoachChoiceForUser, saveCoachChoiceForUser, updateProfileForUser } from "@/lib/profile";
import { AppError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";

const intake = {
  displayName: "Ready",
  goalKey: "conditioning",
  goalNote: "",
  experienceLevel: "intermediate",
  primaryFocus: "boxing",
  equipment: ["Dumbbells"],
  weeklyAvailability: ["Monday"],
  sessionsPerWeek: 3,
  preferredUnits: "lb",
  trainingLimitations: "",
  foodPreferences: "",
  allergies: "",
};

describe("AI coach avatars", () => {
  it("ships five square webp portraits, circle crops, and thumbs", () => {
    expect(AI_COACHES.map((coach) => coach.name)).toEqual([
      "Skye",
      "Maya",
      "Mateo",
      "Cole",
      "Ricky",
    ]);
    const voices = AI_COACHES.map((coach) => coach.voice);
    expect(new Set(voices).size).toBe(AI_COACHES.length);
    const ricky = AI_COACHES.find((coach) => coach.id === "ricky");
    expect(ricky?.vibe).toBe("Ricky Maynez, SVG founder and head coach.");
    expect(ricky?.image).toBe("/coaches/ricky.webp");
    expect(ricky?.circle).toBe("/coaches/ricky-face.webp");
    expect(ricky?.thumb).toBe("/coaches/ricky-thumb.webp");
    expect(ricky?.voice).toBe("onyx");
    expect(AI_COACHES.find((coach) => coach.id === "skye")?.voice).toBe("nova");
    expect(AI_COACHES.find((coach) => coach.id === "maya")?.voice).toBe("sage");
    expect(AI_COACHES.find((coach) => coach.id === "mateo")?.voice).toBe("echo");
    expect(AI_COACHES.find((coach) => coach.id === "cole")?.voice).toBe("ash");
    for (const coach of AI_COACHES) {
      expect(coach.vibe.length).toBeGreaterThan(12);
      expect(coach.circle.endsWith(".webp")).toBe(true);
      for (const file of [coach.image, coach.circle, coach.thumb]) {
        const abs = path.join(process.cwd(), "public", file);
        expect(fs.existsSync(abs), file).toBe(true);
        expect(fs.statSync(abs).size).toBeGreaterThan(400);
      }
    }
    expect(COACHING_STYLES.map((style) => style.value)).toEqual([
      "tough",
      "supportive",
      "technical",
      "hype",
    ]);
  });

  it("defaults an empty choice to Skye and supportive", () => {
    expect(resolveAiCoach("").id).toBe(DEFAULT_AI_COACH_ID);
    expect(resolveAiCoach("").name).toBe("Skye");
    expect(resolveAiCoach("lena").id).toBe("skye");
    expect(resolveAiCoach("nope").name).toBe("Skye");
    expect(resolveCoachingStyle("").value).toBe(DEFAULT_COACHING_STYLE);
    expect(resolveCoachingStyle(null).label).toBe("Supportive");
    expect(needsCoachChoicePrompt(null)).toBe(false);
    expect(
      needsCoachChoicePrompt({ onboardingCompletedAt: new Date(), coachChoiceAt: null }),
    ).toBe(true);
    expect(
      needsCoachChoicePrompt({ onboardingCompletedAt: new Date(), coachChoiceAt: new Date() }),
    ).toBe(false);
    expect(
      needsCoachChoicePrompt({ onboardingCompletedAt: null, coachChoiceAt: null }),
    ).toBe(false);
  });

  it("adapts tone without dropping answer style or safety rules", () => {
    const route = classifyQuestion("When on cage can i use elbow against there jaw as a frame?", {
      topic: "martial_art",
      art: "mma",
    });
    const prompt = buildCoachSystemPrompt({
      topic: "martial_art",
      art: "mma",
      route,
      ownSummary: "x",
      coachingStyle: "tough",
      coachName: "Mateo",
    });
    expect(prompt).toContain(safetyPreamble());
    expect(prompt).toMatch(/Position/);
    expect(prompt).toMatch(/Mechanics/);
    expect(prompt).toMatch(/Common mistakes/);
    expect(prompt).toMatch(/Drill/);
    expect(prompt).toMatch(/Rules check/);
    expect(prompt).toMatch(/Coach avatar: Mateo/);
    expect(prompt).toMatch(/Coaching style: Tough/);
    expect(prompt).toMatch(/changes tone only/);
    expect(prompt).toMatch(/Never shame/);
    expect(coachingStyleVoice("hype", "Cole")).toMatch(/high-energy/);
    expect(coachingStyleVoice("hype", "Cole")).toMatch(/No emojis/);
    expect(coachingStyleVoice(undefined, undefined)).toMatch(/Skye/);
    expect(coachingStyleVoice(undefined, undefined)).toMatch(/Supportive/);
    expect(coachingStyleVoice("tough", "Ricky")).toMatch(/SVG founder and head coach/);
    expect(coachingStyleVoice("tough", "Ricky")).toMatch(/No fluff/);
    expect(coachingStyleVoice("tough", "Ricky")).not.toMatch(/Coach Savage/);
  });

  it("names the chosen coach on assistant messages", () => {
    const html = renderToStaticMarkup(
      createElement(CoachBubble, {
        speaker: "assistant",
        content: "Chin down.",
        coachName: "Maya",
        coachThumb: "/coaches/maya-thumb.webp",
      }),
    );
    expect(html).toContain("Maya");
    expect(html).toContain("/coaches/maya-thumb.webp");
    expect(html).toContain("ring-accent");
    expect(html).not.toContain(">SVG Coach<");
  });

  it("shows the floating coach on signed-in pages and hides it on the coach screen", () => {
    expect(shouldShowCoachFab("/home")).toBe(true);
    expect(shouldShowCoachFab("/training")).toBe(false);
    expect(shouldShowCoachFab("/training/log/abc")).toBe(false);
    expect(shouldShowCoachFab("/training/day/start")).toBe(false);
    expect(shouldShowCoachFab("/vip/apply")).toBe(false);
    expect(shouldShowCoachFab("/checkin")).toBe(false);
    expect(shouldShowCoachFab("/onboarding")).toBe(false);
    expect(shouldShowCoachFab("/training/calendar")).toBe(true);
    expect(shouldShowCoachFab("/bagwork")).toBe(true);
    expect(shouldShowCoachFab("/nutrition")).toBe(true);
    expect(shouldShowCoachFab("/profile")).toBe(false);
    expect(shouldShowCoachFab("/learn")).toBe(true);
    expect(shouldShowCoachFab("/coach")).toBe(false);
    expect(shouldShowCoachFab("/coach?topic=mental")).toBe(false);
    expect(coachFabClearsBottomBar("/training/log/abc")).toBe(true);
    expect(coachFabClearsBottomBar("/home")).toBe(false);

    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const frame = fs.readFileSync(
      path.join(process.cwd(), "src/components/MemberFrame.tsx"),
      "utf8",
    );
    expect(css).toContain("[data-coach-fab]");
    expect(css).toContain('html:not([data-splash="done"]) [data-coach-fab]');
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("safe-area-inset-right");
    expect(css).toContain("[data-logger-save]");
    expect(css).toContain("width: 48px");
    expect(css).toContain("#cbf805");
    expect(frame).toContain("<CoachFab");
    expect(frame).toContain("shouldShowCoachFab");
    expect(frame.match(/data-coach-fab/g)?.length ?? 0).toBeLessThan(3);

    const home = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/home/page.tsx"),
      "utf8",
    );
    const welcome = home.indexOf("bg-[#CBF805]");
    const summary = home.indexOf("<TodaySummaryButton");
    expect(welcome).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(welcome);
    expect(home).toContain("Welcome");
  });

  it("shows the selected coach name on the messenger header", () => {
    expect(resolveAiCoach("ricky").name).toBe("Ricky");
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/(member)/coach/page.tsx"), "utf8");
    expect(page).toContain("VIP Coaching");
    expect(page).not.toContain("1-on-1 clips");
    expect(page).toContain("{coach.name}");
    expect(page).toContain("resolveAiCoach(profile?.aiCoachId)");
  });
});

describe("coach choice persistence", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requires a real coach when the intake includes the choice", () => {
    expect(() =>
      validateOnboardingInput({ ...intake, aiCoachId: "skye", coachingStyle: "nope" }),
    ).toThrow(AppError);
  });

  it("saves the onboarding choice and skips the later prompt", async () => {
    const user = await makeUser("coach-pick@example.com");
    const saved = await completeOnboardingForUser(user.id, {
      ...intake,
      aiCoachId: "cole",
      coachingStyle: "hype",
    });
    expect(saved.aiCoachId).toBe("cole");
    expect(saved.coachingStyle).toBe("hype");
    expect(saved.coachChoiceAt).toBeTruthy();
    expect(needsCoachChoicePrompt(saved)).toBe(false);
    expect(resolveAiCoach(saved.aiCoachId).name).toBe("Cole");
  });

  it("keeps defaults for an existing member until they choose or dismiss", async () => {
    const user = await makeUser("legacy@example.com");
    const saved = await completeOnboardingForUser(user.id, intake);
    expect(saved.aiCoachId).toBe("skye");
    expect(saved.coachingStyle).toBe("");
    expect(saved.coachChoiceAt).toBeNull();
    expect(needsCoachChoicePrompt(saved)).toBe(true);
    expect(resolveAiCoach(saved.aiCoachId).name).toBe("Skye");
    expect(resolveCoachingStyle(saved.coachingStyle).value).toBe("supportive");

    const dismissed = await dismissCoachChoiceForUser(user.id);
    expect(dismissed.coachChoiceAt).toBeTruthy();
    expect(dismissed.aiCoachId).toBe("skye");
    expect(needsCoachChoicePrompt(dismissed)).toBe(false);
    expect(resolveAiCoach(dismissed.aiCoachId).id).toBe("skye");

    const chosen = await saveCoachChoiceForUser(user.id, {
      aiCoachId: "maya",
      coachingStyle: "technical",
    });
    expect(chosen.aiCoachId).toBe("maya");
    expect(chosen.coachingStyle).toBe("technical");

    const edited = await updateProfileForUser(user.id, {
      displayName: "Legacy",
      experienceLevel: "intermediate",
      equipment: ["Dumbbells"],
      weeklyAvailability: ["Monday"],
      hoursPerWeek: null,
      preferredUnits: "lb",
      claimsGymMembership: false,
      foodPreferences: "",
      allergies: "",
      aiCoachId: "mateo",
      coachingStyle: "tough",
    });
    expect(edited.aiCoachId).toBe("mateo");
    expect(edited.coachingStyle).toBe("tough");
  });
});
