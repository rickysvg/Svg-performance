import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getTrialState } from "@/lib/trial";
import { formCheckStorageNotice } from "@/lib/form-check-storage";
import { PageBackLink } from "@/components/fight-camp/PageBackLink";
import { CheckInForm } from "@/components/checkin/CheckInForm";
import { CheckInPrefsForm } from "@/components/checkin/CheckInPrefsForm";
import { CheckInReminderPrompt } from "@/components/checkin/CheckInReminderPrompt";
import { parseRegionIds, regionLabel } from "@/lib/weekly-checkin-shared";
import {
  getCheckInPrefs,
  getCurrentCheckIn,
  markCoachRepliesSeen,
  unseenCoachReply,
  weekTrainingSnapshot,
  weeklyCheckInAllowed,
} from "@/lib/weekly-checkin";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const allowed = await weeklyCheckInAllowed(user.id);
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const now = new Date();

  if (!allowed) {
    const trial = await getTrialState(user.id);
    return (
      <main className="space-y-4">
        <div className="flex items-center gap-3">
          <PageBackLink />
          <h1 className="text-2xl">Weekly check-in</h1>
        </div>
        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="font-display text-xs uppercase tracking-[0.06em]">Coaching</p>
          <h2 className="mt-2 text-2xl">This is on 1-on-1 coaching</h2>
          <p className="mt-2 text-sm text-muted">
            Weekly check-ins are for coaching-plan members. Ricky reads one short form a week.
            An admin can turn it on for a test account from the coach dashboard.
          </p>
          <Link
            href="/plan"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
          >
            See coaching plans
          </Link>
          {trial.canStartTrial ? (
            <p className="mt-3 text-xs text-muted">
              A Performance trial does not include the weekly coaching check-in.
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  const [current, unseenReply, snapshot, prefs] = await Promise.all([
    getCurrentCheckIn(user.id, now, timeZone),
    unseenCoachReply(user.id),
    weekTrainingSnapshot(user.id, now, timeZone),
    getCheckInPrefs(user.id),
  ]);
  await markCoachRepliesSeen(user.id, now);
  const replyRows = [unseenReply, current?.coachStatus === "sent" ? current : null].flatMap((row) =>
    row?.coachReply ? [row] : [],
  );
  const shownReplies = replyRows.filter(
    (row, index) => replyRows.findIndex((item) => item.id === row.id) === index,
  );

  return (
    <main className="space-y-5">
      <section className="-mx-4 -mt-6 bg-black px-4 pb-6 pt-5 text-white">
        <div className="flex items-center gap-3">
          <PageBackLink href="/home" />
          <p className="text-xs uppercase tracking-[0.14em] text-accent">Coach Ricky</p>
        </div>
        <h1 className="mt-3 text-4xl">Weekly check-in</h1>
        <p className="mt-2 text-sm text-white/80">
          One form. About two minutes. {timeZone}.
        </p>
      </section>

      {params.sent === "1" ? (
        <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">
          Sent. Ricky will reply in the app.
        </p>
      ) : null}

      {shownReplies.map((row) => (
        <section key={row.id} className="rounded-2xl border border-black bg-black px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-wide text-accent">Coach Ricky replied</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{row.coachReply}</p>
        </section>
      ))}

      {current ? (
        <SubmittedCheckIn
          bodyweightLb={current.bodyweightLb}
          sleepQuality={current.sleepQuality}
          energy={current.energy}
          stress={current.stress}
          sessionsCompleted={current.sessionsCompleted}
          sessionsPlanned={current.sessionsPlanned}
          sparringSummary={current.sparringSummary}
          wins={current.wins}
          struggles={current.struggles}
          regions={parseRegionIds(current.sorenessRegionsJson)}
          sorenessNotes={current.sorenessNotes}
          summary={current.aiSummary}
          waiting={current.coachStatus !== "sent"}
          hasVideo={Boolean(current.videoStorageKey)}
          id={current.id}
        />
      ) : (
        <CheckInForm
          suggestedWeight={snapshot.suggestedWeightLb}
          sessionsCompleted={snapshot.sessionsCompleted}
          sessionsPlanned={snapshot.sessionsPlanned}
          sessionTitles={snapshot.sessionTitles}
          sparringSummary={snapshot.sparringSummary}
          storageNotice={formCheckStorageNotice()}
        />
      )}

      <CheckInReminderPrompt />
      <CheckInPrefsForm weekday={prefs.weekday} minuteOfDay={prefs.minuteOfDay} timeZone={timeZone} />
    </main>
  );
}

function SubmittedCheckIn({
  bodyweightLb,
  sleepQuality,
  energy,
  stress,
  sessionsCompleted,
  sessionsPlanned,
  sparringSummary,
  wins,
  struggles,
  regions,
  sorenessNotes,
  summary,
  waiting,
  hasVideo,
  id,
}: {
  bodyweightLb: number | null;
  sleepQuality: number;
  energy: number;
  stress: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  sparringSummary: string;
  wins: string;
  struggles: string;
  regions: string[];
  sorenessNotes: string;
  summary: string;
  waiting: boolean;
  hasVideo: boolean;
  id: string;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-line bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">This week</p>
      <h2 className="text-2xl">Check-in sent</h2>
      {waiting ? (
        <p className="text-sm text-muted">Ricky reviews this once. The reply shows up here.</p>
      ) : null}
      {summary ? <p className="whitespace-pre-line text-sm">{summary}</p> : null}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Item label="Weight" value={bodyweightLb != null ? `${bodyweightLb} lb` : "—"} />
        <Item label="Sleep" value={`${sleepQuality}/5`} />
        <Item label="Energy" value={`${energy}/5`} />
        <Item label="Stress" value={`${stress}/5`} />
        <Item label="Sessions" value={`${sessionsCompleted} of ${sessionsPlanned}`} />
        <Item label="Sparring" value={sparringSummary || "None logged"} />
      </dl>
      {regions.length > 0 ? (
        <p className="text-sm">Sore: {regions.map((region) => regionLabel(region)).join(", ")}</p>
      ) : null}
      {sorenessNotes ? <p className="text-sm text-muted">{sorenessNotes}</p> : null}
      {wins ? <p className="text-sm">Win: {wins}</p> : null}
      {struggles ? <p className="text-sm">Struggle: {struggles}</p> : null}
      {hasVideo ? (
        <a href={`/api/checkins/${id}/video`} className="inline-flex min-h-11 items-center text-sm underline">
          Your form video
        </a>
      ) : null}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
