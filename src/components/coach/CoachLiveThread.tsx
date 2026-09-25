"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { EmptyState } from "@/components/EmptyState";
import { useCoachStream } from "@/components/coach/useCoachStream";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  refused?: boolean;
  offline?: boolean;
  live?: boolean;
};

export function CoachLiveThread({
  topic,
  art,
  lane,
  initialMessages,
}: {
  topic: string;
  art?: string;
  lane: string;
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
  const { streaming, partial, error, offline, start, stop } = useCoachStream();

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
    const content = await start({ kind: "chat", message, topic, art });
    const reply = content || partial;
    if (reply) {
      setMessages((current) => [
        ...current,
        {
          id: `local-assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          offline,
        },
      ]);
    }
  }

  return (
    <div className="space-y-3" data-coach-thread>
      {messages.length === 0 && !streaming && !partial ? (
        <EmptyState title={`Ask about ${lane}`}>
          Stay in this lane. For live eyes, talk to a coach on the floor. Safety
          rails still refuse pain, medical, and weight-cut asks — even offline.
        </EmptyState>
      ) : (
        messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-2xl border p-4 text-sm ${
              message.role === "user" ? "border-line bg-background" : "border-line bg-card"
            }`}
          >
            <p className="text-xs uppercase text-muted">
              {message.role === "user" ? "You" : COACH_PUBLIC_NAME}
              {message.refused ? " · safety refusal" : ""}
              {message.offline ? " · offline" : ""}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
          </article>
        ))
      )}

      {streaming ? (
        <article
          data-coach-stream
          className="rounded-2xl border border-line bg-card p-4 text-sm"
        >
          <p className="text-xs uppercase text-muted">
            {COACH_PUBLIC_NAME}
            {offline ? " · offline" : ""}
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
            className="touch-target flex-1 rounded-full bg-accent font-semibold text-black disabled:opacity-60"
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
