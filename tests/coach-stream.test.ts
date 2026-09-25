import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  STREAM_STOPPED_MARKER,
  handleCoachStreamRequest,
  runCoachChatStream,
  runCoachNoteStream,
} from "@/lib/coach/stream";
import { coachStreamForTest } from "@/app/api/coach/stream/route";

describe("SVG Coach streaming", () => {
  const previousDelay = process.env.COACH_STREAM_DELAY_MS;

  beforeEach(async () => {
    await resetDatabase();
    process.env.COACH_STREAM_DELAY_MS = "0";
  });

  afterAll(async () => {
    if (previousDelay === undefined) delete process.env.COACH_STREAM_DELAY_MS;
    else process.env.COACH_STREAM_DELAY_MS = previousDelay;
    await prisma.$disconnect();
  });

  it("rejects unauthenticated stream requests", async () => {
    await expect(
      handleCoachStreamRequest({
        user: null,
        body: { kind: "chat", message: "How should I jab?" },
      }),
    ).rejects.toBeInstanceOf(AuthError);

    const rejected = await coachStreamForTest(null, {
      kind: "chat",
      message: "How should I jab?",
    });
    expect(rejected).toMatchObject({ status: 401 });
    expect("error" in rejected && rejected.error).toMatch(/sign in/i);
  });

  it("persists the full assistant message after the stream finishes", async () => {
    const user = await makeUser("stream-full@example.com");
    const events: string[] = [];
    const result = await runCoachChatStream({
      user,
      body: {
        kind: "chat",
        message: "I skipped two classes. What should I do this week?",
        topic: "mental",
        experienceLevel: "beginner",
      },
      onEvent: (event) => {
        if (event.type === "delta") events.push(event.text);
      },
    });

    expect(result.refused).toBe(false);
    expect(result.content).toMatch(/next session|punishment/i);
    expect(result.content).not.toMatch(/COACHING_GUIDE|demo mode|Topic:|API key/i);
    expect(result.content).not.toContain("[Stopped");
    expect(events.join("")).toBe(result.content);
    const stored = await prisma.chatMessage.findUnique({
      where: { id: result.messageId },
    });
    expect(stored?.role).toBe("assistant");
    expect(stored?.content).toBe(result.content);
    expect(stored?.offline).toBe(true);
    const userRow = await prisma.chatMessage.findFirst({
      where: { threadId: result.threadId, role: "user" },
    });
    expect(userRow?.content).toMatch(/skipped two classes/);
  });

  it("keeps partial text when the stream is aborted", async () => {
    process.env.COACH_STREAM_DELAY_MS = "40";
    const user = await makeUser("stream-abort@example.com");
    const controller = new AbortController();
    const pending = runCoachChatStream({
      user,
      body: {
        kind: "chat",
        message: "I skipped two classes. What should I do this week?",
        topic: "mental",
      },
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 90));
    controller.abort();
    const result = await pending;
    expect(result.cutoff).toBe(true);
    expect(result.content).toContain(STREAM_STOPPED_MARKER.trim());
    expect(result.content.length).toBeGreaterThan(STREAM_STOPPED_MARKER.length);
    const stored = await prisma.chatMessage.findUnique({
      where: { id: result.messageId },
    });
    expect(stored?.content).toBe(result.content);
    expect(stored?.content).not.toEqual(STREAM_STOPPED_MARKER);
  });

  it("persists a notepad stream and keeps a partial after abort", async () => {
    const user = await makeUser("stream-note@example.com");
    const full = await runCoachNoteStream({
      user,
      body: {
        kind: "note",
        message: "How long should I hold this if I am new?",
        exerciseName: "Front plank",
        logMode: "timed",
        plannedLine: "3 holds × 30–45 sec, 60s rest",
        experienceLevel: "beginner",
      },
    });
    expect(full.content).toMatch(/Front plank/i);
    expect(full.content).not.toMatch(/demo mode|COACHING_GUIDE|Topic:/i);
    const saved = await prisma.exerciseNote.findFirst({
      where: { userId: user.id, exerciseName: "Front plank" },
    });
    expect(saved?.aiReply).toBe(full.content);

    process.env.COACH_STREAM_DELAY_MS = "40";
    const controller = new AbortController();
    const pending = runCoachNoteStream({
      user,
      body: {
        kind: "note",
        message: "I skipped last session. What should I do on this plank?",
        exerciseName: "Front plank",
        logMode: "timed",
      },
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 90));
    controller.abort();
    const cut = await pending;
    expect(cut.cutoff).toBe(true);
    expect(cut.content).toContain("[Stopped");
    const after = await prisma.exerciseNote.findFirst({
      where: { userId: user.id, exerciseName: "Front plank" },
    });
    expect(after?.aiReply).toBe(cut.content);
  });
});
