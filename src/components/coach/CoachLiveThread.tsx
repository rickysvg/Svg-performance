"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { EmptyState } from "@/components/EmptyState";
import { useCoachStream } from "@/components/coach/useCoachStream";
import type { UserRole } from "@/lib/auth";
import type { FallbackReason } from "@/lib/coach/stream-types";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";

export const QUICK_ANSWER_NOTE =
  "Live coach is unavailable right now, so this is a short built-in answer. Try again in a bit.";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  refused?: boolean;
  offline?: boolean;
  fallbackReason?: FallbackReason;
  live?: boolean;
};

export function CoachBubble({
  speaker,
  content,
  refused,
  offline,
  fallbackReason,
  viewerRole,
}: {
  speaker: "user" | "assistant";
  content: string;
  refused?: boolean;
  offline?: boolean;
  fallbackReason?: FallbackReason;
  viewerRole?: UserRole;
}) {
  const quick = speaker === "assistant" && Boolean(offline);
  const showReason = quick && viewerRole === "admin" && Boolean(fallbackReason);
  return (
    <article
      className={`rounded-2xl border p-4 text-sm ${
        speaker === "user" ? "border-line bg-background" : "border-line bg-card"
      }`}
    >
      <p className="text-xs uppercase text-muted">
        {speaker === "user" ? "You" : COACH_PUBLIC_NAME}
        {refused ? " · safety refusal" : ""}
        {quick ? " · quick answer" : ""}
        {showReason ? ` · ${fallbackReason}` : ""}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{content}</p>
      {quick ? (
        <p className="mt-2 text-xs text-muted" data-coach-quick-note>
          {QUICK_ANSWER_NOTE}
        </p>
      ) : null}
    </article>
  );
}

export function CoachLiveThread({
  topic,
  art,
  lane,
  viewerRole = "member",
  initialMessages,
}: {
  topic: string;
  art?: string;
  lane: string;
  viewerRole?: UserRole;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    refused: boolean;
    offline: boolean;
  }>;
}) {
  const [messages, setMessages] = useState<ChatBubble[]>(
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
      refused: message.refused,
      offline: message.offline,
    })),
  );
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { streaming, partial, error, offline, fallbackReason, start, stop } = useCoachStream();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partial, streaming]);

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming) return;
    setDraft("");
    const userId = `local-user-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message },
    ]);
    const result = await start({ kind: "chat", message, topic, art });
    const reply = result.content || partial;
    if (reply) {
      setMessages((current) => [
        ...current,
          {
            id: `local-assistant-${Date.now()}`,
            role: "assistant",
            content: reply,
            offline: result.offline || offline,
            fallbackReason: result.fallbackReason || fallbackReason,
          },
      ]);
    }
  }

  return (
    <div className="space-y-3" data-coach-thread>
      {messages.length === 0 && !streaming && !partial ? (
        <EmptyState title={`Ask about ${lane}`}>
          Stay in this lane. For live eyes, talk to a coach on the floor. Safety
          rails still refuse pain, medical, and weight-cut asks.
        </EmptyState>
      ) : (
        messages.map((message) => (
          <CoachBubble
            key={message.id}
            speaker={message.role}
            content={message.content}
            refused={message.refused}
            offline={message.offline}
            fallbackReason={message.fallbackReason}
            viewerRole={viewerRole}
          />
        ))
      )}

      {streaming ? (
        <article
          data-coach-stream
          className="rounded-2xl border border-line bg-card p-4 text-sm"
        >
          <p className="text-xs uppercase text-muted">
            {COACH_PUBLIC_NAME}
            {offline ? " · quick answer" : ""}
            {offline && viewerRole === "admin" && fallbackReason ? ` · ${fallbackReason}` : ""}
            {streaming && !partial ? " · typing" : ""}
          </p>
          {streaming && !partial ? (
            <p data-coach-typing className="mt-3 font-display text-sm uppercase tracking-wide text-accent">
              Typing
              <span className="ml-1 inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
              </span>
            </p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap">{partial}</p>
          )}
          {offline ? (
            <p className="mt-2 text-xs text-muted" data-coach-quick-note>
              {QUICK_ANSWER_NOTE}
            </p>
          ) : null}
        </article>
      ) : null}
      <div ref={bottomRef} />

      <form onSubmit={onSend} className="space-y-3">
        <StatusBanner error={error} />
        <label className="block text-sm">
          Message
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
            rows={4}
            disabled={streaming}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
            placeholder="Ask about this topic."
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            data-coach-send
            className="touch-target flex-1 rounded-full bg-accent text-black disabled:opacity-60"
          >
            {streaming ? "Sending…" : "Send"}
          </button>
          {streaming ? (
            <button
              type="button"
              data-coach-stop
              onClick={stop}
              className="touch-target flex-1 rounded-full border border-line font-semibold"
            >
              Stop
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
