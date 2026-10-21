"use client";

import { useActionState } from "react";
import { coachCheckInAction, type CheckInActionState } from "@/app/actions/weekly-checkin";
import { StatusBanner } from "@/components/StatusBanner";
import { formatOneDecimal } from "@/lib/body-metrics";
import { regionLabel, type CheckInFlag } from "@/lib/weekly-checkin-shared";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { deskSurfaceClass, queueItemTone } from "@/lib/admin-desk-status";

export type CoachCheckInCard = {
  id: string;
  name: string;
  email: string;
  weekKey: string;
  submittedLabel: string;
  bodyweightLb: number | null;
  sleepQuality: number;
  energy: number;
  stress: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  sparringSummary: string;
  wins: string;
  struggles: string;
  sorenessNotes: string;
  regions: string[];
  summary: string;
  flags: CheckInFlag[];
  tweaks: string;
  aiSource: string;
  coachStatus: string;
  reply: string;
  hasVideo: boolean;
};

export function CoachCheckInList({ cards }: { cards: CoachCheckInCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
        No check-ins yet. Coaching members send one from Check-in.
      </p>
    );
  }
  return (
    <ul className="grid gap-4">
      {cards.map((card) => (
        <li key={card.id}>
          <CoachCard card={card} />
        </li>
      ))}
    </ul>
  );
}

function CoachCard({ card }: { card: CoachCheckInCard }) {
  const [state, action, pending] = useActionState(coachCheckInAction, {} as CheckInActionState);
  const flagged = card.flags.length > 0;
  const tone = queueItemTone(card.coachStatus !== "pending");
  return (
    <article
      data-desk-tone={tone}
      className={`hc-panel flex h-full flex-col p-4 text-white ${deskSurfaceClass(tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-wide ${flagged ? "text-[#FF3B3B]" : "text-muted"}`}>
            Week of {card.weekKey}
          </p>
          <h2 className="mt-1 text-2xl">{card.name}</h2>
          <p className="text-sm text-white/70">
            {card.email} · {card.submittedLabel}
          </p>
        </div>
        <DeskBadge tone={tone} label={card.coachStatus === "pending" ? "Waiting" : "Done"} />
      </div>

      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{card.summary}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {card.flags.length === 0 ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            No flags
          </span>
        ) : (
          card.flags.map((flag) => (
            <span key={flag.code} className="rounded-full bg-[#FF3B3B] px-3 py-1 text-xs text-white" title={flag.detail}>
              {flag.label}
            </span>
          ))
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat
          label="Weight"
          value={card.bodyweightLb != null ? `${formatOneDecimal(card.bodyweightLb)} lb` : "—"}
        />
        <Stat label="Sleep" value={`${card.sleepQuality}/5`} />
        <Stat label="Energy" value={`${card.energy}/5`} />
        <Stat label="Stress" value={`${card.stress}/5`} />
        <Stat
          label="Sessions"
          value={`${card.sessionsCompleted} of ${card.sessionsPlanned}`}
        />
        <Stat label="Sparring" value={card.sparringSummary || "None logged"} />
      </dl>

      {card.regions.length > 0 || card.sorenessNotes ? (
        <p className="mt-3 text-sm text-white/80">
          {card.regions.map(regionLabel).join(", ")}
          {card.sorenessNotes ? ` — ${card.sorenessNotes}` : ""}
        </p>
      ) : null}
      {card.wins ? <p className="mt-2 text-sm">Win: {card.wins}</p> : null}
      {card.struggles ? <p className="mt-1 text-sm">Struggle: {card.struggles}</p> : null}
      {card.tweaks ? (
        <p className="mt-3 text-sm text-[#CBF805]">Tweak: {card.tweaks}</p>
      ) : null}
      <p className="mt-2 text-xs text-white/60">
        {card.aiSource === "openai" ? "Live model draft." : "Template summary. Live model is off."}
      </p>

      {card.hasVideo ? (
        <a
          href={`/api/checkins/${card.id}/video`}
          className="mt-3 inline-flex min-h-11 items-center text-sm text-[#CBF805] underline"
        >
          Watch form video
        </a>
      ) : (
        <p className="mt-3 text-sm text-white/60">No form video</p>
      )}

      <form action={action} className="mt-4 space-y-3">
        <StatusBanner error={state.error} success={state.success} />
        <input type="hidden" name="checkInId" value={card.id} />
        <label className="block text-sm">
          Reply in Ricky&apos;s voice
          <textarea
            name="reply"
            rows={5}
            maxLength={2000}
            defaultValue={card.reply}
            className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-black"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="submit"
            name="intent"
            value="send"
            disabled={pending}
            className="min-h-11 rounded-full bg-accent px-3 text-black disabled:opacity-60"
          >
            Approve &amp; send
          </button>
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="min-h-11 rounded-full border border-white px-3 text-white disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="submit"
            name="intent"
            value="review"
            disabled={pending}
            className="min-h-11 rounded-full border border-white/40 px-3 text-white/80 disabled:opacity-60"
          >
            Mark reviewed
          </button>
        </div>
      </form>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-white/60">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
