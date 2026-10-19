"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { EmptyState } from "@/components/EmptyState";
import { AiPaywallPrompt } from "@/components/upgrade/AiPaywallPrompt";
import { useCoachStream, type PaywallReason } from "@/components/coach/useCoachStream";
import type { UserRole } from "@/lib/auth";
import type { FallbackReason } from "@/lib/coach/stream-types";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";
import { CoachSpeakButton } from "@/components/coach/CoachSpeakButton";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";

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
  coachName = COACH_PUBLIC_NAME,
  coachThumb,
  coachId,
  audioRef,
}: {
  speaker: "user" | "assistant";
  content: string;
  refused?: boolean;
  offline?: boolean;
  fallbackReason?: FallbackReason;
  viewerRole?: UserRole;
  coachName?: string;
  coachThumb?: string;
  coachId?: string;
  audioRef?: RefObject<HTMLAudioElement | null>;
}) {
  const quick = speaker === "assistant" && Boolean(offline);
  const label = speaker === "user" ? "You" : coachName;
  return (
    <article
      className={`rounded-2xl border p-4 text-sm ${
        speaker === "user" ? "border-line bg-background" : "border-line bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        {speaker === "assistant" && coachThumb ? (
          <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coachThumb}
            alt=""
            width={96}
            height={96}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-accent"
          />
          </>
        ) : null}
        <p className="text-xs uppercase text-muted" data-coach-speaker={label}>
          {label}
          {refused ? " · safety refusal" : ""}
          {quick ? " · quick answer" : ""}
        </p>
        {speaker === "assistant" && coachId && audioRef ? (
          <CoachSpeakButton text={content} coachId={coachId} audioRef={audioRef} />
        ) : null}
      </div>
      {speaker === "assistant" ? (
        <CoachMarkdown text={content} />
      ) : (
        <p className="mt-2 whitespace-pre-wrap">{content}</p>
      )}
    </article>
  );
}

export function CoachLiveThread({
  topic,
  art,
  lane,
  viewerRole = "member",
  coachName = COACH_PUBLIC_NAME,
  coachId = "skye",
  coachThumb,
  initialMessages,
  remainingLabel = null,
  messagesLeft = 1,
  sendBlockedReason = null,
}: {
  topic: string;
  art?: string;
  lane: string;
  viewerRole?: UserRole;
  coachName?: string;
  coachId?: string;
  coachThumb?: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    refused: boolean;
    offline: boolean;
  }>;
  remainingLabel?: string | null;
  messagesLeft?: number;
  /** Shown instead of sending when the allowance is already 0. */
  sendBlockedReason?: PaywallReason | null;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { streaming, partial, error, offline, fallbackReason, paywall, setPaywall, start, stop } = useCoachStream();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partial, streaming]);

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming) return;
    if (messagesLeft < 1) {
      setPaywall(sendBlockedReason ?? "ai_daily_cap");
      return;
    }
    setDraft("");
    const userId = `local-user-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message },
    ]);
    const result = await start({ kind: "chat", message, topic, art });
    if (result.paywall) return;
    const reply = result.content;
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
      <audio ref={audioRef} data-coach-audio playsInline preload="auto" className="hidden" />
      {messages.length === 0 && !streaming && !partial ? (
        <EmptyState title={`Ask ${coachName} about ${lane}`}>
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
            coachName={coachName}
            coachId={coachId}
            coachThumb={coachThumb}
            audioRef={audioRef}
          />
        ))
      )}

      {streaming ? (
        <article
          data-coach-stream
          className="rounded-2xl border border-line bg-card p-4 text-sm"
        >
          <div className="flex items-center gap-2">
            {coachThumb ? (
              <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coachThumb}
                alt=""
                width={96}
                height={96}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-accent"
              />
              </>
            ) : null}
            <p className="text-xs uppercase text-muted" data-coach-speaker={coachName}>
            {coachName}
            {offline ? " · quick answer" : ""}
            {streaming && !partial ? " · typing" : ""}
            </p>
          </div>
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
            <CoachMarkdown text={partial} />
          )}
        </article>
      ) : null}
      <div ref={bottomRef} />

      <form onSubmit={onSend} className="space-y-3">
        {remainingLabel ? (
          <p data-ai-remaining className="text-xs text-muted">
            {remainingLabel}
          </p>
        ) : null}
        <StatusBanner error={error} />
        {paywall ? (
          <AiPaywallPrompt reason={paywall} onDismiss={() => setPaywall(null)} />
        ) : null}
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
            disabled={streaming || !draft.trim() || messagesLeft < 1}
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
