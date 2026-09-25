import { prisma } from "@/lib/prisma";
import { AppError, AuthError } from "@/lib/errors";
import { canUseMemberTools } from "@/lib/access";
import { detectSafetyRefusal } from "@/lib/coach/safety";
import { safetyPreamble } from "@/lib/coach/safety";
import { loadKnowledgeBase } from "@/lib/coach/knowledge";
import {
  COACH_PUBLIC_NAME,
  coachLaneLabel,
  coachTopicContext,
} from "@/lib/coach/topics";
import {
  getOrCreateThread,
  isOpenAiConfigured,
  offlineReply,
} from "@/lib/coach/chat";
import { coachLaneForExercise, upsertExerciseNoteForUser } from "@/lib/exercise-notes";
import { plannedSetLine, resolveLogMode } from "@/lib/exercise-log-mode";
import type { PublicUser } from "@/lib/auth";
import {
  STREAM_FAIL_COPY,
  STREAM_STOPPED_MARKER,
  type CoachStreamEvent,
  type CoachStreamKind,
  type CoachStreamRequest,
} from "@/lib/coach/stream-types";

export {
  STREAM_FAIL_COPY,
  STREAM_STOPPED_MARKER,
  type CoachStreamEvent,
  type CoachStreamKind,
  type CoachStreamRequest,
} from "@/lib/coach/stream-types";

export class StreamAbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "StreamAbortError";
  }
}

function chunkDelayMs() {
  const raw = Number(process.env.COACH_STREAM_DELAY_MS ?? "12");
  return Number.isFinite(raw) && raw >= 0 ? raw : 12;
}

function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new StreamAbortError());
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(new StreamAbortError());
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function* iterateTextChunks(
  text: string,
  options?: { chunkSize?: number; delayMs?: number; signal?: AbortSignal },
) {
  const size = Math.max(1, options?.chunkSize ?? 18);
  const delay = options?.delayMs ?? chunkDelayMs();
  for (let index = 0; index < text.length; index += size) {
    if (options?.signal?.aborted) {
      throw new StreamAbortError();
    }
    await sleep(delay, options?.signal);
    yield text.slice(index, index + size);
  }
}

function encodeSse(event: CoachStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function ownSummary(input: {
  userId: string;
  experienceLevel?: string;
  coachingTone?: string;
  topic?: string;
  art?: string;
  notepad?: boolean;
}) {
  return [
    `Experience: ${input.experienceLevel || "unknown"}.`,
    input.coachingTone ? `Preferred coaching tone: ${input.coachingTone}.` : "",
    coachLaneLabel(input.topic, input.art)
      ? `Selected topic: ${coachLaneLabel(input.topic, input.art)}.`
      : "",
    `Only this user id ${input.userId} may be discussed.`,
    input.notepad
      ? "This is a Train notepad question on one exercise. Stay practical."
      : "",
    "Do not invent a medical or calorie plan from any stored weight.",
    "Do not invent SVG-produced videos.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function* streamOpenAiTokens(
  input: {
    message: string;
    experienceLevel: string;
    coachingTone?: string;
    ownSummary: string;
    topic?: string;
    art?: string;
  },
  signal?: AbortSignal,
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const fallback = offlineReply(
      input.message,
      input.experienceLevel,
      input.coachingTone,
      input.topic,
      input.art,
    );
    yield* iterateTextChunks(fallback, { signal });
    return { offline: true };
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
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input.message },
      ],
    }),
    signal,
  }).catch((error: unknown) => {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new StreamAbortError();
    }
    return null;
  });

  if (!response || !response.ok || !response.body) {
    const fallback = `${offlineReply(
      input.message,
      input.experienceLevel,
      input.coachingTone,
      input.topic,
      input.art,
    )} (Live model request failed, so you are seeing the offline answer.)`;
    yield* iterateTextChunks(fallback, { signal });
    return { offline: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw new StreamAbortError();
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        return { offline: false };
      }
      try {
        const payload = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = payload.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip a broken SSE line
      }
    }
  }
  return { offline: false };
}

async function drainCoachTokens(
  input: {
    message: string;
    experienceLevel: string;
    coachingTone?: string;
    ownSummary: string;
    topic?: string;
    art?: string;
  },
  signal: AbortSignal | undefined,
  onDelta: (text: string) => void,
) {
  const generator = streamOpenAiTokens(input, signal);
  let next = await generator.next();
  let offline = !isOpenAiConfigured();
  while (!next.done) {
    onDelta(next.value);
    next = await generator.next();
  }
  if (next.value && typeof next.value === "object" && "offline" in next.value) {
    offline = next.value.offline;
  }
  return { offline };
}

function finalizeContent(received: string, cutoff: boolean) {
  const text = received.trim();
  if (cutoff) {
    return text
      ? `${text}${STREAM_STOPPED_MARKER}`
      : `SVG Coach stopped before a reply came through. Send again if you still want an answer.${STREAM_STOPPED_MARKER}`;
  }
  return (
    text ||
    "I do not have a clear answer from the DEMO notes. Ask a coach on the floor."
  );
}

export async function runCoachChatStream(input: {
  user: PublicUser | null;
  body: CoachStreamRequest;
  signal?: AbortSignal;
  onEvent?: (event: CoachStreamEvent) => void;
  chunkSize?: number;
  delayMs?: number;
}) {
  const user = input.user;
  if (!user) {
    throw new AuthError("Sign in to talk to SVG Coach.");
  }
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    throw new AppError(
      "PAYWALL",
      `${COACH_PUBLIC_NAME} is locked until your plan includes it.`,
    );
  }
  const message = String(input.body.message ?? "").trim().slice(0, 2000);
  if (!message) {
    throw new AppError("VALIDATION", "Type a message first.");
  }
  const topic = String(input.body.topic ?? "");
  const art = topic === "martial_art" ? String(input.body.art ?? "") : "";
  const thread = await getOrCreateThread(user.id, { topic, art });
  const refusal = detectSafetyRefusal(message, {
    currentUserId: user.id,
    mentionedUserId: input.body.mentionedUserId,
  });

  await prisma.chatMessage.create({
    data: { threadId: thread.id, role: "user", content: message },
  });

  const emit = (event: CoachStreamEvent) => input.onEvent?.(event);

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
    emit({
      type: "meta",
      threadId: thread.id,
      messageId: saved.id,
      offline: saved.offline,
      refused: true,
    });
    emit({ type: "delta", text: refusal.message });
    emit({
      type: "done",
      content: refusal.message,
      offline: saved.offline,
      refused: true,
    });
    return {
      status: 200,
      threadId: thread.id,
      messageId: saved.id,
      content: refusal.message,
      offline: saved.offline,
      refused: true,
    };
  }

  const draft = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: "",
      refused: false,
      offline: !isOpenAiConfigured(),
    },
  });
  emit({
    type: "meta",
    threadId: thread.id,
    messageId: draft.id,
    offline: draft.offline,
    refused: false,
  });

  let received = "";
  let offline = draft.offline;
  let cutoff = false;
  try {
    const drained = await drainCoachTokens(
      {
        message,
        experienceLevel: input.body.experienceLevel || "beginner",
        coachingTone: input.body.coachingTone,
        ownSummary: ownSummary({
          userId: user.id,
          experienceLevel: input.body.experienceLevel,
          coachingTone: input.body.coachingTone,
          topic,
          art,
        }),
        topic,
        art,
      },
      input.signal,
      (delta) => {
        received += delta;
        emit({ type: "delta", text: delta });
      },
    );
    offline = drained.offline;
  } catch (error) {
    if (error instanceof StreamAbortError || input.signal?.aborted) {
      cutoff = true;
    } else {
      const content = received
        ? `${received.trim()}\n\n${STREAM_FAIL_COPY}`
        : STREAM_FAIL_COPY;
      await prisma.chatMessage.update({
        where: { id: draft.id },
        data: { content, offline: true },
      });
      emit({ type: "error", message: STREAM_FAIL_COPY });
      throw error instanceof AppError
        ? error
        : new AppError("COACH", STREAM_FAIL_COPY);
    }
  }

  const content = finalizeContent(received, cutoff);
  const saved = await prisma.chatMessage.update({
    where: { id: draft.id },
    data: { content, offline },
  });
  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
  emit({
    type: "done",
    content: saved.content,
    offline: saved.offline,
    refused: false,
  });
  return {
    status: 200,
    threadId: thread.id,
    messageId: saved.id,
    content: saved.content,
    offline: saved.offline,
    refused: false,
    cutoff,
  };
}

export async function runCoachNoteStream(input: {
  user: PublicUser | null;
  body: CoachStreamRequest;
  signal?: AbortSignal;
  onEvent?: (event: CoachStreamEvent) => void;
}) {
  const user = input.user;
  if (!user) {
    throw new AuthError("Sign in to talk to SVG Coach.");
  }
  const body = String(input.body.message ?? "").trim().slice(0, 2000);
  if (!body) {
    throw new AppError("VALIDATION", "Type a note or question first.");
  }
  const note = await upsertExerciseNoteForUser({
    userId: user.id,
    exerciseName: String(input.body.exerciseName ?? ""),
    programDayId: input.body.programDayId,
    body,
  });
  const mode = resolveLogMode({
    logMode: input.body.logMode,
    name: note.exerciseName,
  });
  const planned =
    input.body.plannedLine?.trim() ||
    plannedSetLine({
      sets: 0,
      reps: "",
      restSeconds: 0,
      logMode: mode,
      name: note.exerciseName,
    });
  const lane = coachLaneForExercise(note.exerciseName);
  const message = [
    `Exercise: ${note.exerciseName}.`,
    `Log mode: ${mode}. load_reps is reps + lbs. load_timed is seconds + lbs (loaded carry / hold), never reps. Do not invent pounds on bodyweight or skill work.`,
    planned ? `Planned work: ${planned}.` : "",
    `Member note or question: ${note.body}`,
    "Give one or two practical cues. YouTube / Learn clips are external references, not SVG-produced film.",
  ]
    .filter(Boolean)
    .join(" ");

  const emit = (event: CoachStreamEvent) => input.onEvent?.(event);
  const refusal = detectSafetyRefusal(message, { currentUserId: user.id });
  if (refusal) {
    const saved = await prisma.exerciseNote.update({
      where: {
        userId_exerciseName_programDayId: {
          userId: user.id,
          exerciseName: note.exerciseName,
          programDayId: note.programDayId,
        },
      },
      data: { aiReply: refusal.message, aiOffline: !isOpenAiConfigured() },
    });
    emit({
      type: "meta",
      exerciseName: note.exerciseName,
      offline: saved.aiOffline,
      refused: true,
    });
    emit({ type: "delta", text: refusal.message });
    emit({
      type: "done",
      content: refusal.message,
      offline: saved.aiOffline,
      refused: true,
    });
    return {
      status: 200,
      content: refusal.message,
      offline: saved.aiOffline,
      refused: true,
    };
  }

  emit({
    type: "meta",
    exerciseName: note.exerciseName,
    offline: !isOpenAiConfigured(),
    refused: false,
  });

  let received = "";
  let offline = !isOpenAiConfigured();
  let cutoff = false;
  try {
    const drained = await drainCoachTokens(
      {
        message,
        experienceLevel: input.body.experienceLevel || "beginner",
        coachingTone: input.body.coachingTone,
        ownSummary: ownSummary({
          userId: user.id,
          experienceLevel: input.body.experienceLevel,
          coachingTone: input.body.coachingTone,
          topic: lane.topic,
          art: lane.art,
          notepad: true,
        }),
        topic: lane.topic,
        art: lane.art,
      },
      input.signal,
      (delta) => {
        received += delta;
        emit({ type: "delta", text: delta });
      },
    );
    offline = drained.offline;
  } catch (error) {
    if (error instanceof StreamAbortError || input.signal?.aborted) {
      cutoff = true;
    } else {
      const content = received
        ? `${received.trim()}\n\n${STREAM_FAIL_COPY}`
        : STREAM_FAIL_COPY;
      await prisma.exerciseNote.update({
        where: {
          userId_exerciseName_programDayId: {
            userId: user.id,
            exerciseName: note.exerciseName,
            programDayId: note.programDayId,
          },
        },
        data: { aiReply: content, aiOffline: true },
      });
      emit({ type: "error", message: STREAM_FAIL_COPY });
      throw error instanceof AppError
        ? error
        : new AppError("COACH", STREAM_FAIL_COPY);
    }
  }

  const content = finalizeContent(received, cutoff);
  await prisma.exerciseNote.update({
    where: {
      userId_exerciseName_programDayId: {
        userId: user.id,
        exerciseName: note.exerciseName,
        programDayId: note.programDayId,
      },
    },
    data: { aiReply: content, aiOffline: offline },
  });
  emit({ type: "done", content, offline, refused: false });
  return { status: 200, content, offline, refused: false, cutoff };
}

export async function handleCoachStreamRequest(input: {
  user: PublicUser | null;
  body: CoachStreamRequest;
  signal?: AbortSignal;
  onEvent?: (event: CoachStreamEvent) => void;
}) {
  const kind = input.body.kind === "note" ? "note" : "chat";
  if (kind === "note") {
    return runCoachNoteStream(input);
  }
  return runCoachChatStream(input);
}

export function coachStreamResponse(
  user: PublicUser | null,
  body: CoachStreamRequest,
  signal?: AbortSignal,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await handleCoachStreamRequest({
          user,
          body,
          signal,
          onEvent: (event) => {
            controller.enqueue(encoder.encode(encodeSse(event)));
          },
        });
      } catch (error) {
        if (error instanceof AuthError) {
          controller.enqueue(
            encoder.encode(encodeSse({ type: "error", message: error.message })),
          );
        } else if (error instanceof AppError) {
          controller.enqueue(
            encoder.encode(encodeSse({ type: "error", message: error.message })),
          );
        } else if (!(error instanceof StreamAbortError)) {
          controller.enqueue(
            encoder.encode(encodeSse({ type: "error", message: STREAM_FAIL_COPY })),
          );
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: user ? 200 : 401,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
