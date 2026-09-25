import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import type { getChallengeProgressForUser } from "@/lib/challenges";

type Progress = Awaited<ReturnType<typeof getChallengeProgressForUser>>;

export function ChallengeHomeCard({ progress }: { progress: Progress }) {
  if (!progress) {
    return null;
  }
  const { challenge, enrollment, daysActive, goalDays, complete, ratio } = progress;
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Monthly challenge</p>
          <h2 className="mt-1">{challenge.title}</h2>
        </div>
        {challenge.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        {enrollment
          ? complete
            ? "Badge earned — consistency, not heaviest lift."
            : `${daysActive} / ${goalDays} show-up days on the ${enrollment.track} track.`
          : "Opt in to track show-up days this month."}
      </p>
      {enrollment ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      ) : null}
      <Link href="/challenges" className="mt-3 inline-block text-sm text-accent underline">
        {enrollment ? "Open challenge" : "Opt in"}
      </Link>
    </section>
  );
}
