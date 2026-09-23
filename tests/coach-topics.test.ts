import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendCoachMessage } from "@/lib/coach/chat";
import {
  COACH_PUBLIC_NAME,
  buildCoachHref,
  coachLaneLabel,
  coachTopicContext,
  resolveCoachArt,
  resolveCoachTopic,
} from "@/lib/coach/topics";
import { safetyPreamble } from "@/lib/coach/safety";
import { AI_DISCLAIMER } from "@/lib/plans";
import { makeUser, resetDatabase } from "./helpers";

describe("SVG Coach topics", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("resolves topic and art filters together", () => {
    expect(resolveCoachTopic("mental")).toBe("mental");
    expect(resolveCoachTopic("savage")).toBeUndefined();
    expect(resolveCoachArt("boxing")).toBe("boxing");
    expect(resolveCoachArt("kickboxing")).toBeUndefined();
    expect(coachLaneLabel("martial_art", "jiu-jitsu")).toBe("Martial art · Jiu-Jitsu");
    expect(coachLaneLabel("conditioning")).toBe("Conditioning");
    expect(buildCoachHref({ topic: "martial_art", art: "boxing" })).toBe(
      "/coach?topic=martial_art&art=boxing",
    );
  });

  it("keeps member-facing copy on SVG Coach", () => {
    expect(COACH_PUBLIC_NAME).toBe("SVG Coach");
    expect(AI_DISCLAIMER).toMatch(/SVG Coach/);
    expect(AI_DISCLAIMER).not.toMatch(/Savage/i);
    expect(safetyPreamble()).toMatch(/SVG Coach/);
    expect(safetyPreamble()).not.toMatch(/Savage/i);
    expect(coachTopicContext("martial_art", "boxing")).toMatch(/Boxing/);
    expect(coachTopicContext("martial_art", "boxing")).toMatch(/never claim they are SVG-produced/);
  });

  it("opens a separate thread per topic and stays on-lane offline", async () => {
    const user = await makeUser("lanes@example.com");
    const boxing = await sendCoachMessage({
      userId: user.id,
      message: "How do I throw a jab?",
      experienceLevel: "beginner",
      topic: "martial_art",
      art: "boxing",
    });
    const mental = await sendCoachMessage({
      userId: user.id,
      message: "I get nerves the night before class.",
      experienceLevel: "beginner",
      topic: "mental",
    });
    expect(boxing.threadId).not.toBe(mental.threadId);
    expect(boxing.assistant.content).toMatch(/Martial art · Boxing/);
    expect(boxing.assistant.content).toMatch(/SVG Coach/);
    expect(boxing.assistant.content).not.toMatch(/Savage/i);
    expect(mental.assistant.content).toMatch(/Mental/);

    const threads = await prisma.chatThread.findMany({ where: { userId: user.id } });
    expect(threads).toHaveLength(2);
    expect(threads.map((row) => `${row.topic}:${row.art}`).sort()).toEqual([
      "martial_art:boxing",
      "mental:",
    ]);
  });
});
