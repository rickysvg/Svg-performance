import { prisma } from "@/lib/prisma";
import { AppError, AuthError } from "@/lib/errors";
import { AiCapError, consumeAiUse } from "@/lib/ai-usage";
import { canUseCoachChat, COACH_CHAT_LOCKED } from "@/lib/coach-access";
import { detectSafetyRefusal, logCoachRefusal } from "@/lib/coach/safety";
import { loadMemberContext } from "@/lib/coach/member-context";
import {
  getMemberCoachThread,
  getOrCreateThread,
  getThreadForUser,
  isOpenAiConfigured,
} from "@/lib/coach/chat";
import { timeZoneForUser } from "@/lib/profile";
import { authoringCoachId } from "@/lib/coach/author";
import { athleteLocalDayLine } from "@/lib/timezone";
import { EMPTY_COACH_FALLBACK } from "@/lib/coach/offline";
import { loadOfflineMemberFacts } from "@/lib/coach/member-facts";
import { buildPlanContext } from "@/lib/coach/plan-context";
import { classifyQuestion } from "@/lib/coach/router";
import {
  StreamAbortError,
  buildCoachSystemPrompt,
  buildOwnSummary,
  coachMaxTokens,
  coachThreadHistory,
  streamCoachCompletion,
} from "@/lib/coach/llm";
import { coachLaneForExercise, upsertExerciseNoteForUser } from "@/lib/exercise-notes";
import { plannedSetLine, resolveLogMode } from "@/lib/exercise-log-mode";
import type { PublicUser } from "@/lib/auth";
import {
  STREAM_FAIL_COPY,
  STREAM_STOPPED_MARKER,
  type CoachStreamEvent,
  type CoachStreamRequest,
  type FallbackReason,
} from "@/lib/coach/stream-types";

export {
  STREAM_FAIL_COPY,
  STREAM_STOPPED_MARKER,
  type CoachStreamEvent,
  type CoachStreamKind,
  type CoachStreamRequest,
} from "@/lib/coach/stream-types";

export { StreamAbortError } from "@/lib/coach/llm";

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

async function drainCoachTokens(
  input: {
    message: string;
    experienceLevel: string;
    coachingTone?: string;
    coachingStyle?: string;
    coachName?: string;
    topic?: string;
    art?: string;
    notepad?: boolean;
    userId: string;
    history: { role: "user" | "assistant"; content: string }[];
    localDay?: string;
  },
  signal: AbortSignal | undefined,
  onDelta: (text: string) => void,
) {
  const route = classifyQuestion(input.message, {
    topic: input.topic,
    art: input.art,
    notepad: input.notepad,
  });
  const wantsPlan =
    route.primary === "programming" || route.secondary.includes("programming");
  const [planContext, memberProfile, memberFacts] = await Promise.all([
    wantsPlan ? buildPlanContext(input.userId, input.message) : Promise.resolve(""),
    loadMemberContext(input.userId, { topic: input.topic, art: input.art }),
    loadOfflineMemberFacts(input.userId),
  ]);
  const system = buildCoachSystemPrompt({
    topic: input.topic,
    art: input.art,
    route,
    ownSummary: buildOwnSummary({
      userId: input.userId,
      experienceLevel: input.experienceLevel,
      coachingTone: input.coachingTone,
      topic: input.topic,
      art: input.art,
      notepad: input.notepad,
      localDay: input.localDay,
    }),
    planContext,
    coachingStyle: input.coachingStyle,
    coachName: input.coachName,
    message: input.message,
    experienceLevel: input.experienceLevel,
    memberProfile,
  });
  const generator = streamCoachCompletion({
    system,
    history: input.history,
    message: input.message,
    signal,
    maxTokens: coachMaxTokens(route),
    userId: input.userId,
    experienceLevel: input.experienceLevel,
    coachingTone: input.coachingTone,
    topic: input.topic,
    art: input.art,
    coachName: input.coachName,
    coachingStyle: input.coachingStyle,
    memberFacts,
  });
  let next = await generator.next();
  let live = "";
  while (!next.done) {
    live += next.value;
    onDelta(next.value);
    next = await generator.next();
  }
  const result = next.value ?? { offline: !isOpenAiConfigured() };
  if (result.offline) {
    const text = result.fallbackText || live;
    if (!live && text) {
      for await (const chunk of iterateTextChunks(text, { signal })) {
        onDelta(chunk);
      }
    }
    return { offline: true, reason: result.reason, route };
  }
  return { offline: false, reason: undefined, route };
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
    EMPTY_COACH_FALLBACK
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
  if (!(await canUseCoachChat(user))) {
    throw new AiCapError("locked", COACH_CHAT_LOCKED);
  }
  const message = String(input.body.message ?? "").trim().slice(0, 2000);
  if (!message) {
    throw new AppError("VALIDATION", "Type a message first.");
  }
  await consumeAiUse({ userId: user.id, kind: "message", surface: "chat" });
  const requestedTopic = String(input.body.topic ?? "");
  const art = requestedTopic === "martial_art" ? String(input.body.art ?? "") : "";
  const thread = input.body.threadId
    ? await getThreadForUser(String(input.body.threadId), user.id)
    : requestedTopic
      ? await getOrCreateThread(user.id, { topic: requestedTopic, art })
      : await getMemberCoachThread(user.id);
  const topic = requestedTopic || undefined;
  const refusal = detectSafetyRefusal(message, {
    currentUserId: user.id,
    mentionedUserId: input.body.mentionedUserId,
  });

  const coachId = await authoringCoachId(user.id, input.body.coachName);
  await prisma.chatMessage.create({
    data: { threadId: thread.id, role: "user", content: message },
  });

  const emit = (event: CoachStreamEvent) => input.onEvent?.(event);

  if (refusal) {
    logCoachRefusal({ code: refusal.code, userId: user.id, surface: "stream" });
    const saved = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: refusal.message,
        coachId,
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

  const history = coachThreadHistory(thread.messages);
  const draft = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: "",
      coachId,
      refused: false,
      offline: !isOpenAiConfigured(),
    },
  });
  let fallbackReason: FallbackReason | undefined = draft.offline ? "no_key" : undefined;
  emit({
    type: "meta",
    threadId: thread.id,
    messageId: draft.id,
    offline: draft.offline,
    refused: false,
    fallbackReason,
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
        coachingStyle: input.body.coachingStyle,
        coachName: input.body.coachName,
        topic,
        art,
        userId: user.id,
        history,
        localDay: athleteLocalDayLine(new Date(), await timeZoneForUser(user.id)),
      },
      input.signal,
      (delta) => {
        received += delta;
        emit({ type: "delta", text: delta });
      },
    );
    offline = drained.offline;
    fallbackReason = drained.reason;
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
    fallbackReason,
  });
  return {
    status: 200,
    threadId: thread.id,
    messageId: saved.id,
    content: saved.content,
    offline: saved.offline,
    refused: false,
    cutoff,
    fallbackReason,
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
  // The note is always saved (logging is never locked). The AI reply uses the same cap as chat.
  try {
    await consumeAiUse({ userId: user.id, kind: "message", surface: "note" });
  } catch (error) {
    if (error instanceof AiCapError) {
      input.onEvent?.({ type: "paywall", reason: error.reason, message: error.message });
      return {
        status: 402,
        content: "",
        offline: !isOpenAiConfigured(),
        refused: false,
        paywall: error.reason,
        error: error.message,
      };
    }
    throw error;
  }
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
    logCoachRefusal({ code: refusal.code, userId: user.id, surface: "note" });
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

  let fallbackReason: FallbackReason | undefined = isOpenAiConfigured() ? undefined : "no_key";
  emit({
    type: "meta",
    exerciseName: note.exerciseName,
    offline: !isOpenAiConfigured(),
    refused: false,
    fallbackReason,
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
        coachingStyle: input.body.coachingStyle,
        coachName: input.body.coachName,
        topic: lane.topic,
        art: lane.art,
        notepad: true,
        userId: user.id,
        history: [],
        localDay: athleteLocalDayLine(new Date(), await timeZoneForUser(user.id)),
      },
      input.signal,
      (delta) => {
        received += delta;
        emit({ type: "delta", text: delta });
      },
    );
    offline = drained.offline;
    fallbackReason = drained.reason;
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
  emit({ type: "done", content, offline, refused: false, fallbackReason });
  return { status: 200, content, offline, refused: false, cutoff, fallbackReason };
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

export async function coachStreamResponse(
  user: PublicUser | null,
  body: CoachStreamRequest,
  signal?: AbortSignal,
) {
  if (!user) {
    return Response.json({ error: "Sign in to talk to SVG Coach." }, { status: 401 });
  }
  const kind = body.kind === "note" ? "note" : "chat";
  if (kind === "chat" && !(await canUseCoachChat(user))) {
    return Response.json({ error: COACH_CHAT_LOCKED, paywall: "locked" }, { status: 402 });
  }
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
        } else if (error instanceof AiCapError) {
          controller.enqueue(
            encoder.encode(
              encodeSse({ type: "paywall", reason: error.reason, message: error.message }),
            ),
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
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
