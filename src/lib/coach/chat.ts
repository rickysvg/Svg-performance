import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { detectSafetyRefusal } from "@/lib/coach/safety";
import { EMPTY_COACH_FALLBACK } from "@/lib/coach/offline";
import { buildPlanContext } from "@/lib/coach/plan-context";
import { classifyQuestion } from "@/lib/coach/router";
import {
  buildCoachSystemPrompt,
  buildOwnSummary,
  coachMaxTokens,
  coachThreadHistory,
  collectCoachCompletion,
  isOpenAiConfigured,
} from "@/lib/coach/llm";
import { timeZoneForUser } from "@/lib/profile";
import { athleteLocalDayLine } from "@/lib/timezone";

export { offlineReply } from "@/lib/coach/offline";
export { isOpenAiConfigured } from "@/lib/coach/llm";

async function replyWithCoach(input: {
  userId: string;
  message: string;
  experienceLevel?: string;
  coachingTone?: string;
  topic?: string;
  art?: string;
  notepad?: boolean;
  history: { role: "user" | "assistant"; content: string }[];
  localDay?: string;
}) {
  const lane = {
    topic: input.topic,
    art: input.art,
    notepad: input.notepad,
  };
  const route = classifyQuestion(input.message, lane);
  const wantsPlan =
    route.primary === "programming" || route.secondary.includes("programming");
  const planContext = wantsPlan ? await buildPlanContext(input.userId, input.message) : "";
  const ownSummary = buildOwnSummary({
    userId: input.userId,
    experienceLevel: input.experienceLevel,
    coachingTone: input.coachingTone,
    topic: input.topic,
    art: input.art,
    notepad: input.notepad,
    localDay: input.localDay,
  });
  const system = buildCoachSystemPrompt({
    topic: input.topic,
    art: input.art,
    route,
    ownSummary,
    planContext,
  });
  const reply = await collectCoachCompletion({
    system,
    history: input.history,
    message: input.message,
    maxTokens: coachMaxTokens(route),
    userId: input.userId,
    experienceLevel: input.experienceLevel || "beginner",
    coachingTone: input.coachingTone,
    topic: input.topic,
    art: input.art,
  });
  return {
    content: reply.content || EMPTY_COACH_FALLBACK,
    offline: reply.offline,
    reason: reply.reason,
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
  const topic = input.topic;
  const art = input.topic === "martial_art" ? input.art : "";
  const thread = await getOrCreateThread(input.userId, { topic, art });
  const history = coachThreadHistory(thread.messages);
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

  const reply = await replyWithCoach({
    userId: input.userId,
    message,
    experienceLevel: input.experienceLevel || "beginner",
    coachingTone: input.coachingTone,
    topic,
    art,
    history,
    localDay: athleteLocalDayLine(new Date(), await timeZoneForUser(input.userId)),
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
  const reply = await replyWithCoach({
    userId: input.userId,
    message,
    experienceLevel: input.experienceLevel || "beginner",
    coachingTone: input.coachingTone,
    topic: input.topic,
    art: input.topic === "martial_art" ? input.art : "",
    notepad: true,
    history: [],
    localDay: athleteLocalDayLine(new Date(), await timeZoneForUser(input.userId)),
  });
  return {
    content: reply.content,
    offline: reply.offline,
    refused: false,
  };
}
