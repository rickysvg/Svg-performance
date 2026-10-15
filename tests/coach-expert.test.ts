import { describe, expect, it } from "vitest";
import { domainOfflineFallback } from "@/lib/coach/offline-bank";
import { offlineReply } from "@/lib/coach/offline";
import {
  listExpertKnowledgeFiles,
  loadCoreKnowledge,
  retrieveCoachKnowledge,
} from "@/lib/coach/knowledge";
import { formatMemberContext } from "@/lib/coach/member-context";
import { buildCoachSystemPrompt } from "@/lib/coach/llm";
import { QUESTION_TYPES, classifyQuestion } from "@/lib/coach/router";

describe("coach expert knowledge", () => {
  it("ships a retrieved library instead of one stub file", () => {
    const files = listExpertKnowledgeFiles();
    expect(files.length).toBeGreaterThanOrEqual(40);
    expect(files.some((name) => name.startsWith("technique/"))).toBe(true);
    expect(files.some((name) => name.startsWith("nutrition/"))).toBe(true);
    expect(files.some((name) => name.startsWith("injury/"))).toBe(true);
    const core = loadCoreKnowledge();
    expect(core).toMatch(/COACHING_GUIDE\.md/);
    expect(core).toMatch(/safety\.md/);
    expect(core).not.toMatch(/Target: 30–50 questions/);
    expect(core).not.toMatch(/DEMO — Missed class/);
  });

  it("retrieves a few boxing notes for a jab, not the whole library", () => {
    const notes = retrieveCoachKnowledge({
      primary: "technique",
      art: "boxing",
      message: "How do I throw a jab and bring it home?",
      level: "intermediate",
    });
    const headings = notes.match(/^## /gm) ?? [];
    expect(headings.length).toBeGreaterThanOrEqual(3);
    expect(headings.length).toBeLessThanOrEqual(5);
    expect(notes.length).toBeLessThanOrEqual(8000);
    expect(notes).toMatch(/boxing/i);
    expect(notes).toMatch(/jab/i);
    expect(notes).not.toMatch(/taekwondo/i);
  });

  it("retrieves nutrition notes for a gradual cut", () => {
    const notes = retrieveCoachKnowledge({
      primary: "nutrition",
      message: "How far out should I start a gradual weight cut?",
    });
    expect(notes).toMatch(/coach-kb\/nutrition\//);
    expect(notes).toMatch(/1%/);
  });
});

describe("coach member context", () => {
  it("keeps a compact profile and leaves body weight out", () => {
    const text = formatMemberContext({
      experienceLevel: "intermediate",
      primaryFocus: "boxing",
      trainingEmphasis: "striker",
      goals: "Get stronger for training",
      sessionsPerWeek: 4,
      weeklyAvailability: ["Monday", "Wednesday"],
      trainingLimitations: "Right knee is cranky after long runs",
      competitionStatus: "amateur",
      laneArt: "boxing",
      camp: {
        status: "active",
        weightClass: "Lightweight",
        fightDate: "2026-12-01",
        discipline: "boxing",
      },
    });
    expect(text).toMatch(/Level: intermediate/);
    expect(text).toMatch(/Boxing/);
    expect(text).toMatch(/4 days\/week/);
    expect(text).toMatch(/Monday/);
    expect(text).toMatch(/Right knee/);
    expect(text).toMatch(/Lightweight/);
    expect(text).toMatch(/2026-12-01/);
    expect(text).toMatch(/Fight camp:/);
    expect(text).not.toMatch(/calorie/i);
    expect(text).not.toMatch(/\d+\s*lb/i);
  });

  it("still injects the block when the profile is empty", () => {
    const text = formatMemberContext({});
    expect(text).toMatch(/Level: unknown/);
    expect(text).toMatch(/Fight camp: none on file/);
    const route = classifyQuestion("How do I throw a jab?", {
      topic: "martial_art",
      art: "boxing",
    });
    const prompt = buildCoachSystemPrompt({
      topic: "martial_art",
      art: "boxing",
      route,
      ownSummary: "Only this user.",
      memberProfile: text,
      message: "How do I throw a jab?",
      experienceLevel: "beginner",
    });
    expect(prompt).toMatch(/Level: unknown/);
    expect(prompt).toMatch(/Core coaching guide/);
    expect(prompt).toMatch(/coach-kb\//);
  });
});

describe("offline domain fallbacks", () => {
  it("has a solid fallback for every question type", () => {
    for (const type of QUESTION_TYPES) {
      if (type === "general") continue;
      const answer = domainOfflineFallback(type);
      expect(answer.length, type).toBeGreaterThan(80);
    }
  });

  it("answers a recovery sauna and a water-cut explanation offline", () => {
    const sauna = offlineReply("Is sauna ok for recovery?", "intermediate");
    expect(sauna).toMatch(/recovery/i);
    expect(sauna).toMatch(/fluid|replac/i);
    expect(sauna).not.toMatch(/protocol for sweating|minutes at/i);
    const why = offlineReply("Why are water cuts dangerous?", "intermediate");
    expect(why).toMatch(/blood volume|heart rate|dangerous/i);
    expect(why).toMatch(/will not explain how/i);
  });
});
