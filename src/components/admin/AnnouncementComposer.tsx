"use client";

import { useActionState, useState } from "react";
import {
  sendAnnouncementAction,
  type AnnouncementActionState,
} from "@/app/actions/announcements";
import { StatusBanner } from "@/components/StatusBanner";

const AUDIENCES = [
  { value: "members", label: "All members" },
  { value: "academy", label: "Academy members" },
  { value: "pro", label: "Active Pro" },
  { value: "coaching", label: "Coaching clients" },
] as const;

const CHANNELS = [
  { value: "both", label: "Push and email" },
  { value: "push", label: "Push only" },
  { value: "email", label: "Email only" },
] as const;

export function AnnouncementComposer({
  emailReady,
  pushReady,
}: {
  emailReady: boolean;
  pushReady: boolean;
}) {
  const [state, action, pending] = useActionState(
    sendAnnouncementAction,
    {} as AnnouncementActionState,
  );
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["value"]>("members");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("both");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const wantsEmail = channel !== "push";
  const wantsPush = channel !== "email";
  const blocked =
    (wantsEmail && !emailReady && wantsPush && !pushReady) ||
    (wantsEmail && !emailReady && !wantsPush) ||
    (wantsPush && !pushReady && !wantsEmail);
  const audienceLabel = AUDIENCES.find((item) => item.value === audience)?.label ?? "Members";
  const channelLabel = CHANNELS.find((item) => item.value === channel)?.label ?? "Push and email";

  if (reviewing) {
    return (
      <form action={action} className="space-y-4" data-announcement-confirm="1">
        <StatusBanner error={state.error} success={state.success} />
        <input type="hidden" name="confirm" value="send" />
        <input type="hidden" name="audience" value={audience} />
        <input type="hidden" name="channel" value={channel} />
        <input type="hidden" name="subject" value={subject} />
        <input type="hidden" name="body" value={body} />
        <section className="hc-panel space-y-3 px-4 py-4">
          <p className="hc-kicker">Confirm</p>
          <p className="text-sm text-muted">
            {audienceLabel} · {channelLabel}
          </p>
          <h2 className="text-2xl">{subject}</h2>
          <p className="whitespace-pre-wrap text-sm">{body}</p>
        </section>
        {blocked ? (
          <p className="rounded-2xl border border-[#FF3B3B]/50 px-4 py-3 text-sm text-[#FF3B3B]">
            Nothing can send yet. Push and email aren&apos;t set up. This stays a draft.
          </p>
        ) : (
          <p className="text-sm text-muted">
            This sends when you tap Send now.
            {!emailReady && wantsEmail ? " Email isn't set up, so only push goes out." : ""}
            {!pushReady && wantsPush ? " Push isn't set up, so only email goes out." : ""}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || blocked}
          className="touch-target w-full rounded-full bg-[#CBF805] text-black disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send now"}
        </button>
        <button
          type="button"
          onClick={() => setReviewing(false)}
          className="min-h-11 w-full text-sm text-[#CBF805]"
        >
          Back to draft
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      data-announcement-draft="1"
      onSubmit={(event) => {
        event.preventDefault();
        if (subject.trim().length < 2 || body.trim().length < 2) return;
        setReviewing(true);
      }}
    >
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Who
        <select
          value={audience}
          onChange={(event) => setAudience(event.target.value as typeof audience)}
          className="mt-1 w-full rounded-2xl border border-[#2a3124] bg-black px-4 py-3 text-base"
        >
          {AUDIENCES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Channel
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
          className="mt-1 w-full rounded-2xl border border-[#2a3124] bg-black px-4 py-3 text-base"
        >
          {CHANNELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">
        Email {emailReady ? "is ready" : "isn't set up"}. Push {pushReady ? "is ready" : "isn't set up"}.
      </p>
      <label className="block text-sm">
        Subject
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={80}
          required
          className="mt-1 w-full rounded-2xl border border-[#2a3124] bg-black px-4 py-3 text-base"
        />
      </label>
      <label className="block text-sm">
        Message
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          required
          rows={5}
          className="mt-1 w-full rounded-2xl border border-[#2a3124] bg-black px-4 py-3 text-base"
        />
      </label>
      <button type="submit" className="touch-target w-full rounded-full bg-[#CBF805] text-black">
        Review draft
      </button>
    </form>
  );
}
