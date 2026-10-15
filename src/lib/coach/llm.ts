import { loadKnowledgeBase } from "@/lib/coach/knowledge";
import { offlineReply } from "@/lib/coach/offline";
import type { CoachRoute } from "@/lib/coach/router";
import { coachingStyleVoice } from "@/lib/coaches";
import { styleInstructions, STYLE_LIMITS } from "@/lib/coach/styles";
import { safetyPreamble } from "@/lib/coach/safety";
import type { FallbackReason } from "@/lib/coach/stream-types";
import { coachLaneLabel, coachTopicContext } from "@/lib/coach/topics";

export type { FallbackReason } from "@/lib/coach/stream-types";

export class StreamAbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "StreamAbortError";
  }
}

const HISTORY_LIMIT = 8;
const HISTORY_CAP = 1500;

export type CoachHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CoachCompletionResult = {
  offline: boolean;
  reason?: FallbackReason;
  fallbackText?: string;
};

export function openAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function openAiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function isOpenAiConfigured() {
  return Boolean(openAiApiKey());
}

export function coachLlmTimeoutMs() {
  const raw = Number(process.env.COACH_LLM_TIMEOUT_MS ?? "20000");
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
}

export function coachMaxTokens(route: CoachRoute) {
  return STYLE_LIMITS[route.primary].maxTokens;
}

export function buildOwnSummary(input: {
  userId: string;
  experienceLevel?: string;
  coachingTone?: string;
  topic?: string;
  art?: string;
  notepad?: boolean;
  localDay?: string;
}) {
  return [
    `Experience: ${input.experienceLevel || "unknown"}.`,
    input.coachingTone ? `Preferred coaching tone: ${input.coachingTone}.` : "",
    coachLaneLabel(input.topic, input.art)
      ? `Selected topic: ${coachLaneLabel(input.topic, input.art)}.`
      : "",
    input.localDay ?? "",
    `Only this user id ${input.userId} may be discussed.`,
    input.notepad ? "This is a Train notepad question on one exercise. Stay practical." : "",
    "Do not invent a medical or calorie plan from any stored weight.",
    "Do not invent SVG-produced videos.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCoachSystemPrompt(input: {
  topic?: string;
  art?: string;
  route: CoachRoute;
  ownSummary: string;
  planContext?: string;
  coachingStyle?: string;
  coachName?: string;
}) {
  const wantsPlan =
    input.route.primary === "programming" || input.route.secondary.includes("programming");
  const planBlock = !wantsPlan
    ? ""
    : input.planContext?.trim()
      ? `Member plan (this member only):\n${input.planContext.trim()}`
      : "No plan data available. Don't invent numbers.";
  return [
    safetyPreamble(),
    coachTopicContext(input.topic, input.art),
    styleInstructions(input.route, { topic: input.topic, art: input.art }),
    coachingStyleVoice(input.coachingStyle, input.coachName),
    "Approved DEMO knowledge:",
    loadKnowledgeBase(),
    "Member context (current user only):",
    input.ownSummary,
    planBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function coachThreadHistory(
  messages: Array<{ role: string; content: string; refused?: boolean }>,
): CoachHistoryMessage[] {
  const usable = messages.filter((row) => {
    if (row.refused) return false;
    if (row.role !== "user" && row.role !== "assistant") return false;
    return row.content.trim().length > 0;
  });
  return usable.slice(-HISTORY_LIMIT).map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content.slice(0, HISTORY_CAP),
  }));
}

function logFallback(input: {
  reason: FallbackReason;
  status?: number;
  userId?: string;
}) {
  console.warn("[coach] live model unavailable", {
    reason: input.reason,
    status: input.status,
    model: openAiModel(),
    ...(input.userId ? { userId: input.userId } : {}),
  });
}

function reasonForStatus(status: number): FallbackReason {
  if (status === 401) return "http_401";
  if (status === 403) return "http_403";
  if (status === 404) return "http_404";
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return "http_4xx";
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error && (error.name === "AbortError" || error.name === "StreamAbortError")
  );
}

/**
 * One OpenAI streaming client. Question type never skips this call.
 * A missing key, a non-2xx status, a timeout, or a network error is logged
 * once (status and reason only) and then the built-in answer is returned.
 */
export async function* streamCoachCompletion(input: {
  system: string;
  history: CoachHistoryMessage[];
  message: string;
  signal?: AbortSignal;
  maxTokens: number;
  userId?: string;
  experienceLevel?: string;
  coachingTone?: string;
  topic?: string;
  art?: string;
}): AsyncGenerator<string, CoachCompletionResult> {
  const fallbackText = () =>
    offlineReply(
      input.message,
      input.experienceLevel || "beginner",
      input.coachingTone,
      input.topic,
      input.art,
    );

  const fail = (reason: FallbackReason, status?: number): CoachCompletionResult => {
    logFallback({ reason, status, userId: input.userId });
    return { offline: true, reason, fallbackText: fallbackText() };
  };

  const key = openAiApiKey();
  if (!key) {
    return fail("no_key");
  }

  const timeoutMs = coachLlmTimeoutMs();
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = input.signal
    ? AbortSignal.any([input.signal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response | null = null;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel(),
        temperature: 0.4,
        max_tokens: input.maxTokens,
        stream: true,
        messages: [
          { role: "system", content: input.system },
          ...input.history,
          { role: "user", content: input.message },
        ],
      }),
      signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (input.signal?.aborted) throw new StreamAbortError();
    if (timeoutController.signal.aborted) return fail("timeout");
    if (isAbortError(error) && input.signal?.aborted) throw new StreamAbortError();
    return fail("network");
  }

  clearTimeout(timer);

  if (!response.ok) {
    return fail(reasonForStatus(response.status), response.status);
  }
  if (!response.body) {
    return fail("empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let yielded = "";
  try {
    while (true) {
      if (input.signal?.aborted) {
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
          if (!yielded.trim()) return fail("empty");
          return { offline: false };
        }
        try {
          const payload = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = payload.choices?.[0]?.delta?.content;
          if (delta) {
            yielded += delta;
            yield delta;
          }
        } catch {
          // skip a broken SSE line
        }
      }
    }
  } catch (error) {
    if (error instanceof StreamAbortError || input.signal?.aborted) {
      throw new StreamAbortError();
    }
    if (!yielded.trim()) return fail("network");
    throw error;
  }

  if (!yielded.trim()) return fail("empty");
  return { offline: false };
}

export async function collectCoachCompletion(
  input: Parameters<typeof streamCoachCompletion>[0],
): Promise<{ content: string; offline: boolean; reason?: FallbackReason }> {
  const generator = streamCoachCompletion(input);
  let live = "";
  let next = await generator.next();
  while (!next.done) {
    live += next.value;
    next = await generator.next();
  }
  const result = next.value ?? { offline: true, reason: "empty" as const, fallbackText: "" };
  if (result.offline) {
    return {
      content: (result.fallbackText || live).trim(),
      offline: true,
      reason: result.reason,
    };
  }
  return { content: live.trim(), offline: false };
}
