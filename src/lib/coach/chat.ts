import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { detectSafetyRefusal, safetyPreamble } from "@/lib/coach/safety";
import { loadKnowledgeBase } from "@/lib/coach/knowledge";
import {
  EMPTY_COACH_FALLBACK,
  liveModelUnavailableReply,
  offlineReply,
} from "@/lib/coach/offline";
import { coachLaneLabel, coachTopicContext } from "@/lib/coach/topics";

export { offlineReply } from "@/lib/coach/offline";

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function liveReply(input: {
  message: string;
  experienceLevel: string;
  coachingTone?: string;
  ownSummary: string;
  topic?: string;
  art?: string;
}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      content: offlineReply(
        input.message,
        input.experienceLevel,
        input.coachingTone,
        input.topic,
        input.art,
      ),
      offline: true,
    };
  }
  const system = [
    safetyPreamble(),
    coachTopicContext(input.topic, input.art),
    "Approved DEMO knowledge:",
    loadKnowledgeBase(),
    "Member context (current user only):",
    input.ownSummary,
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input.message },
      ],
    }),
  });
  if (!response.ok) {
    return {
      content: liveModelUnavailableReply(
        input.message,
        input.experienceLevel,
        input.coachingTone,
        input.topic,
        input.art,
      ),
      offline: true,
    };
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  return {
    content:
      content ||
      EMPTY_COACH_FALLBACK,
    offline: false,
  };
}

export async function getOrCreateThread(
  userId: string,
  lane?: { topic?: string; art?: string },
) {
  const topic = lane?.topic ?? "";
  const art = lane?.art ?? "";
  const existing = await prisma.chatThread.findFirst({
    where: { userId, topic, art },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (existing) {
    return existing;
  }
  return prisma.chatThread.create({
    data: { userId, topic, art },
    include: { messages: true },
  });
}

export async function getThreadForUser(threadId: string, userId: string) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) {
    throw new NotFoundError("Chat not found.");
  }
  if (thread.userId !== userId) {
    throw new ForbiddenError("You cannot open another member's chat.");
  }
  return thread;
}

export async function sendCoachMessage(input: {
  userId: string;
  message: string;
  experienceLevel?: string;
  coachingTone?: string;
  mentionedUserId?: string;
  topic?: string;
  art?: string;
}) {
  const message = input.message.trim().slice(0, 2000);
  if (!message) {
    throw new Error("Type a message first.");
  }
  const thread = await getOrCreateThread(input.userId, {
    topic: input.topic,
    art: input.topic === "martial_art" ? input.art : "",
  });
  const refusal = detectSafetyRefusal(message, {
    currentUserId: input.userId,
    mentionedUserId: input.mentionedUserId,
  });

  await prisma.chatMessage.create({
    data: { threadId: thread.id, role: "user", content: message },
  });

  if (refusal) {
    const saved = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: refusal.message,
        refused: true,
        refusalCode: refusal.code,
        offline: !isOpenAiConfigured(),
      },
    });
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
    return { threadId: thread.id, assistant: saved, refused: true };
  }

  const ownSummary = [
    `Experience: ${input.experienceLevel || "unknown"}.`,
    input.coachingTone ? `Preferred coaching tone: ${input.coachingTone}.` : "",
    coachLaneLabel(input.topic, input.art)
      ? `Selected topic: ${coachLaneLabel(input.topic, input.art)}.`
      : "",
    `Only this user id ${input.userId} may be discussed.`,
    "Do not invent a medical or calorie plan from any stored weight.",
  ]
    .filter(Boolean)
    .join(" ");
  const reply = await liveReply({
    message,
    experienceLevel: input.experienceLevel || "beginner",
    coachingTone: input.coachingTone,
    ownSummary,
    topic: input.topic,
    art: input.topic === "martial_art" ? input.art : "",
  });
  const saved = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: reply.content,
      refused: false,
      offline: reply.offline,
    },
  });
  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
  return { threadId: thread.id, assistant: saved, refused: false };
}

/** One-off SVG Coach answer for a Train notepad. Does not write a chat thread. */
export async function answerScopedCoachQuestion(input: {
  userId: string;
  message: string;
  experienceLevel?: string;
  coachingTone?: string;
  topic?: string;
  art?: string;
}) {
  const message = input.message.trim().slice(0, 2000);
  if (!message) {
    throw new AppError("VALIDATION", "Type a note or question first.");
  }
  const refusal = detectSafetyRefusal(message, { currentUserId: input.userId });
  if (refusal) {
    return {
      content: refusal.message,
      offline: !isOpenAiConfigured(),
      refused: true,
      refusalCode: refusal.code,
    };
  }
  const ownSummary = [
    `Experience: ${input.experienceLevel || "unknown"}.`,
    input.coachingTone ? `Preferred coaching tone: ${input.coachingTone}.` : "",
    coachLaneLabel(input.topic, input.art)
      ? `Selected topic: ${coachLaneLabel(input.topic, input.art)}.`
      : "",
    `Only this user id ${input.userId} may be discussed.`,
    "This is a Train notepad question on one exercise. Stay practical.",
    "Do not invent SVG-produced videos or a medical plan.",
  ]
    .filter(Boolean)
    .join(" ");
  const reply = await liveReply({
    message,
    experienceLevel: input.experienceLevel || "beginner",
    coachingTone: input.coachingTone,
    ownSummary,
    topic: input.topic,
    art: input.topic === "martial_art" ? input.art : "",
  });
  return {
    content: reply.content,
    offline: reply.offline,
    refused: false,
  };
}
