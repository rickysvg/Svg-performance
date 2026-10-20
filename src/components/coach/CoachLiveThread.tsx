"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { AiPaywallPrompt } from "@/components/upgrade/AiPaywallPrompt";
import { useCoachStream } from "@/components/coach/useCoachStream";
import type { UserRole } from "@/lib/auth";
import type { FallbackReason } from "@/lib/coach/stream-types";
import { COACH_PUBLIC_NAME } from "@/lib/coach/topics";
import { COACH_SUGGESTIONS, COACH_WELCOME } from "@/lib/coach/welcome";
import { CoachSpeakButton } from "@/components/coach/CoachSpeakButton";
import { CoachMarkdown } from "@/components/coach/CoachMarkdown";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  refused?: boolean;
  offline?: boolean;
  fallbackReason?: FallbackReason;
  live?: boolean;
};

function formatStamp(value: string | undefined, timeZone: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || undefined,
  }).format(date);
}

export function CoachBubble({
  speaker,
  content,
  createdAt,
  timeZone = "",
  refused,
  offline,
  coachName = COACH_PUBLIC_NAME,
  coachThumb,
  coachId,
  audioRef,
}: {
  speaker: "user" | "assistant";
  content: string;
  createdAt?: string;
  timeZone?: string;
  refused?: boolean;
  offline?: boolean;
  fallbackReason?: FallbackReason;
  viewerRole?: UserRole;
  coachName?: string;
  coachThumb?: string;
  coachId?: string;
  audioRef?: RefObject<HTMLAudioElement | null>;
}) {
  const mine = speaker === "user";
  const quick = speaker === "assistant" && Boolean(offline);
  const label = speaker === "user" ? "You" : coachName;
  const stamp = formatStamp(createdAt, timeZone);
  return (
    <article
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
      data-coach-speak={mine ? undefined : "reply"}
    >
      <div className={`flex max-w-[82%] items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {speaker === "assistant" && coachThumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coachThumb}
              alt=""
              width={96}
              height={96}
              className="mb-4 h-7 w-7 shrink-0 rounded-full object-cover ring-2 ring-accent"
            />
          </>
        ) : null}
        <div className={mine ? "text-right" : ""}>
          <p className="sr-only" data-coach-speaker={label}>
            {label}
            {refused ? " · safety refusal" : ""}
            {quick ? " · quick answer" : ""}
          </p>
          <div
            className={`rounded-2xl px-3 py-2 text-sm ${
              mine
                ? "rounded-br-md bg-[#CBF805] text-black"
                : "rounded-bl-md bg-[#101216] text-white ring-1 ring-white/10"
            }`}
          >
            {speaker === "assistant" && coachId && audioRef ? (
              <div className="mb-1 flex justify-end">
                <CoachSpeakButton text={content} coachId={coachId} audioRef={audioRef} />
              </div>
            ) : null}
            {speaker === "assistant" ? (
              <CoachMarkdown text={content} />
            ) : (
              <p className="whitespace-pre-wrap">{content}</p>
            )}
          </div>
          {stamp ? (
            <p className="mt-1 text-[10px] text-white/45" data-coach-time>
              {stamp}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CoachLiveThread({
  threadId,
  viewerRole = "member",
  coachName = COACH_PUBLIC_NAME,
  coachId = "skye",
  coachThumb,
  timeZone = "",
  initialMessages,
  remainingLabel = null,
}: {
  threadId: string;
  viewerRole?: UserRole;
  coachName?: string;
  coachId?: string;
  coachThumb?: string;
  timeZone?: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
    refused: boolean;
    offline: boolean;
  }>;
  remainingLabel?: string | null;
}) {
  const [messages, setMessages] = useState<ChatBubble[]>(
    initialMessages.map((message) => ({
      id: message.id,
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
      createdAt: message.createdAt,
      refused: message.refused,
      offline: message.offline,
    })),
  );
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { streaming, partial, error, offline, fallbackReason, paywall, setPaywall, start, stop } =
    useCoachStream();
  const empty = messages.length === 0 && !streaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partial, streaming]);

  async function sendText(raw: string) {
    const message = raw.trim();
    if (!message || streaming) return;
    setDraft("");
    const userId = `local-user-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);
    const result = await start({ kind: "chat", message, threadId });
    if (result.paywall) return;
    const reply = result.content;
    if (reply) {
      setMessages((current) => [
        ...current,
        {
          id: `local-assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
          offline: result.offline || offline,
          fallbackReason: result.fallbackReason || fallbackReason,
        },
      ]);
    }
  }

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    await sendText(draft);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" data-coach-thread>
        <audio ref={audioRef} data-coach-audio playsInline preload="auto" className="hidden" />
        {empty ? (
          <CoachBubble
            speaker="assistant"
            content={COACH_WELCOME}
            coachName={coachName}
            coachId={coachId}
            coachThumb={coachThumb}
            audioRef={audioRef}
            viewerRole={viewerRole}
          />
        ) : (
          messages.map((message) => (
            <CoachBubble
              key={message.id}
              speaker={message.role}
              content={message.content}
              createdAt={message.createdAt}
              timeZone={timeZone}
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
          <article data-coach-stream className="flex justify-start">
            <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-[#101216] px-3 py-2 text-sm text-white ring-1 ring-white/10">
              <p className="sr-only" data-coach-speaker={coachName}>
                {coachName}
                {offline ? " · quick answer" : ""}
                {streaming && !partial ? " · typing" : ""}
              </p>
              {streaming && !partial ? (
                <p data-coach-typing className="flex items-center gap-1 py-1" aria-label="Typing">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#CBF805]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#CBF805] [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#CBF805] [animation-delay:240ms]" />
                </p>
              ) : (
                <CoachMarkdown text={partial} />
              )}
            </div>
          </article>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSend}
        className="shrink-0 border-t border-[#cbf805]/30 bg-[#0b0c0e] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {empty ? (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1" data-coach-suggestions>
            {COACH_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="shrink-0 rounded-full border border-[#cbf805]/45 px-3 py-1.5 text-xs text-white"
                onClick={() => void sendText(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {remainingLabel ? (
          <p data-ai-remaining className="mb-1 text-[10px] text-white/45">
            {remainingLabel}
          </p>
        ) : null}
        <StatusBanner error={error} />
        {paywall ? <AiPaywallPrompt reason={paywall} onDismiss={() => setPaywall(null)} /> : null}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="coach-message">
            Message
          </label>
          <textarea
            id="coach-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            disabled={streaming}
            enterKeyHint="send"
            className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-[#101216] px-3 py-2.5 text-base text-white placeholder:text-white/40"
            placeholder="Message"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendText(draft);
              }
            }}
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            data-coach-send
            className="touch-target h-11 shrink-0 rounded-full bg-[#CBF805] px-4 text-sm font-semibold text-black disabled:opacity-60"
          >
            Send
          </button>
          {streaming ? (
            <button
              type="button"
              data-coach-stop
              onClick={stop}
              className="touch-target h-11 shrink-0 rounded-full border border-white/20 px-3 text-sm font-semibold text-white"
            >
              Stop
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
