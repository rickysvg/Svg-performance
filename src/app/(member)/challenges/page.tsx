import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { getChallengeProgressForUser } from "@/lib/challenges";
import { ChallengeJoinForm } from "@/components/challenges/ChallengeJoinForm";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";

export default async function ChallengesPage() {
  const user = await requireOnboardedUser();
  const progress = await getChallengeProgressForUser(user.id);

  if (!progress) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">Monthly SVG challenge</h1>
        <EmptyState title="No active challenge">
          An admin turns on the month from the pilot toolkit.
        </EmptyState>
      </main>
    );
  }

  const { challenge, enrollment, daysActive, goalDays, complete, ratio } = progress;

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">{challenge.monthKey}</p>
        <h1 className="mt-1 text-2xl font-semibold">{challenge.title}</h1>
        {challenge.isDemo ? <DemoBadge className="mt-2" /> : null}
        <p className="mt-2 text-sm text-muted">{challenge.summary}</p>
      </div>
      <section className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-muted">
          Consistency scoring: days with a workout and/or food log. Not heaviest lift.
        </p>
        <p className="mt-3 text-3xl font-semibold text-accent">
          {daysActive} / {goalDays}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        {complete ? (
          <p className="mt-3 text-sm font-semibold">Badge earned for this month. Nice consistency.</p>
        ) : enrollment ? (
          <p className="mt-3 text-sm text-muted">
            {enrollment.track} track. Keep logging — a quiet day is okay.
          </p>
        ) : null}
      </section>
      <ChallengeJoinForm defaultTrack={enrollment?.track} />
      <p className="text-sm">
        <Link href="/home" className="text-accent underline">
          Back to Today
        </Link>
      </p>
    </main>
  );
}
