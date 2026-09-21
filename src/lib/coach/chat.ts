import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { detectSafetyRefusal, safetyPreamble } from "@/lib/coach/safety";
import { loadKnowledgeBase } from "@/lib/coach/knowledge";

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function offlineReply(message: string, experienceLevel: string) {
  const text = message.toLowerCase();
  const kb = loadKnowledgeBase();
  const hasGuide = kb.includes("COACHING_GUIDE.md");
  const guideNote = hasGuide
    ? "I am using the DEMO coaching guide and seed answers."
    : "I only have the small DEMO knowledge stubs.";
  const levelNote =
    experienceLevel === "beginner"
      ? "You marked yourself new to lifting, so keep loads you can control."
      : experienceLevel === "advanced"
        ? "You have a consistent lifting base — stay honest, do not add junk volume."
        : "Match the work to how you actually recover this week.";

  if (/missed|skip(ped)?|fell off|inconsistent/.test(text)) {
    return `${levelNote} ${guideNote} Missing a session is not a verdict (COACHING_GUIDE.md / DEMO-seeds.md). Pick the next date you will train and do that one session. Do not stack a punishment workout. This is Coach Savage AI in DEMO / offline mode — not Ricky typing.`;
  }
  if (/technique|jab|takedown|guard|stance|how do i/.test(text)) {
    return `${levelNote} ${guideNote} One simple cue from the DEMO notes, then live eyes on the floor. I do not invent a full paid curriculum. This is Coach Savage AI in DEMO / offline mode — not Ricky typing.`;
  }
  if (/discourag|fail|setback|plateau/.test(text)) {
    return `${levelNote} ${guideNote} Setbacks happen. Shrink the next session so you can finish it. I will not pile shame on you. This is Coach Savage AI in DEMO / offline mode — not Ricky typing.`;
  }
  return `${levelNote} ${guideNote} If the notes do not cover this, I will not guess gym-specific policy. Ask a coach on the floor. This is Coach Savage AI in DEMO / offline mode — not Ricky typing.`;
}

async function liveReply(input: {
  message: string;
  experienceLevel: string;
  ownSummary: string;
}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { content: offlineReply(input.message, input.experienceLevel), offline: true };
  }
  const system = [
    safetyPreamble(),
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
      content: `${offlineReply(input.message, input.experienceLevel)} (Live model request failed, so you are seeing the offline answer.)`,
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
      "I do not have a clear answer from the DEMO notes. Ask a coach on the floor.",
    offline: false,
  };
}

export async function getOrCreateThread(userId: string) {
  const existing = await prisma.chatThread.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (existing) {
    return existing;
  }
  return prisma.chatThread.create({
    data: { userId },
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
  mentionedUserId?: string;
}) {
  const message = input.message.trim().slice(0, 2000);
  if (!message) {
    throw new Error("Type a message first.");
  }
  const thread = await getOrCreateThread(input.userId);
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

  const ownSummary = `Experience: ${input.experienceLevel || "unknown"}. Only this user id ${input.userId} may be discussed.`;
  const reply = await liveReply({
    message,
    experienceLevel: input.experienceLevel || "beginner",
    ownSummary,
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
