"use client";

import { useActionState } from "react";
import { coachCheckInAction, type CheckInActionState } from "@/app/actions/weekly-checkin";
import { StatusBanner } from "@/components/StatusBanner";
import { regionLabel, type CheckInFlag } from "@/lib/weekly-checkin-shared";

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
    <ul className="grid gap-4 lg:grid-cols-2">
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
  return (
    <article
      className={`flex h-full flex-col rounded-3xl border p-4 ${
        flagged ? "border-black bg-black text-white" : "border-line bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-wide ${flagged ? "text-accent" : "text-muted"}`}>
            Week of {card.weekKey}
          </p>
          <h2 className="mt-1 text-2xl">{card.name}</h2>
          <p className={`text-sm ${flagged ? "text-white/70" : "text-muted"}`}>
            {card.email} · {card.submittedLabel}
          </p>
        </div>
        <p
          className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
            flagged ? "bg-accent text-black" : "bg-card text-muted"
          }`}
        >
          {card.coachStatus}
        </p>
      </div>

      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{card.summary}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {card.flags.length === 0 ? (
          <span className={`rounded-full px-3 py-1 text-xs ${flagged ? "bg-white/10" : "bg-card text-muted"}`}>
            No flags
          </span>
        ) : (
          card.flags.map((flag) => (
            <span key={flag.code} className="rounded-full bg-accent px-3 py-1 text-xs text-black" title={flag.detail}>
              {flag.label}
            </span>
          ))
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Weight" value={card.bodyweightLb != null ? `${card.bodyweightLb} lb` : "—"} light={flagged} />
        <Stat label="Sleep" value={`${card.sleepQuality}/5`} light={flagged} />
        <Stat label="Energy" value={`${card.energy}/5`} light={flagged} />
        <Stat label="Stress" value={`${card.stress}/5`} light={flagged} />
        <Stat
          label="Sessions"
          value={`${card.sessionsCompleted} of ${card.sessionsPlanned}`}
          light={flagged}
        />
        <Stat label="Sparring" value={card.sparringSummary || "None logged"} light={flagged} />
      </dl>

      {card.regions.length > 0 || card.sorenessNotes ? (
        <p className={`mt-3 text-sm ${flagged ? "text-white/80" : "text-muted"}`}>
          {card.regions.map(regionLabel).join(", ")}
          {card.sorenessNotes ? ` — ${card.sorenessNotes}` : ""}
        </p>
      ) : null}
      {card.wins ? <p className="mt-2 text-sm">Win: {card.wins}</p> : null}
      {card.struggles ? <p className="mt-1 text-sm">Struggle: {card.struggles}</p> : null}
      {card.tweaks ? (
        <p className={`mt-3 text-sm ${flagged ? "text-accent" : "text-muted"}`}>Tweak: {card.tweaks}</p>
      ) : null}
      {card.aiSource === "fallback" ? (
        <p className={`mt-2 text-xs ${flagged ? "text-white/60" : "text-muted"}`}>
          Drafted without the live model.
        </p>
      ) : null}

      {card.hasVideo ? (
        <a
          href={`/api/checkins/${card.id}/video`}
          className={`mt-3 inline-flex min-h-11 items-center text-sm underline ${flagged ? "text-accent" : "text-black"}`}
        >
          Watch form video
        </a>
      ) : (
        <p className={`mt-3 text-sm ${flagged ? "text-white/60" : "text-muted"}`}>No form video</p>
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
            className={`min-h-11 rounded-full border px-3 disabled:opacity-60 ${
              flagged ? "border-white text-white" : "border-black"
            }`}
          >
            Edit
          </button>
          <button
            type="submit"
            name="intent"
            value="review"
            disabled={pending}
            className={`min-h-11 rounded-full border px-3 disabled:opacity-60 ${
              flagged ? "border-white/40 text-white" : "border-line text-muted"
            }`}
          >
            Mark reviewed
          </button>
        </div>
      </form>
    </article>
  );
}

function Stat({ label, value, light }: { label: string; value: string; light: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${light ? "bg-white/10" : "bg-card"}`}>
      <dt className={`text-xs uppercase tracking-wide ${light ? "text-white/60" : "text-muted"}`}>{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
