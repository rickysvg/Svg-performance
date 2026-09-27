import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { LISTED_ROUTINES, MOBILITY_DISCLAIMER, SAFETY_NOTES } from "@/lib/mobility";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityPage() {
  const user = await requireUser();
  const [pro, trial] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Mobility</p>
        <h1 className="mt-1 text-3xl">Move better</h1>
        <p className="mt-2 text-sm text-muted">
          Six short routines. Holds, sets, and rounds — log what you actually did. Warm up before the long holds.
        </p>
      </div>

      <Link href="/mobility/drills" className="block rounded-[1.5rem] bg-black px-4 py-4 text-white">
        <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Drill ideas</p>
        <h2 className="mt-1 text-2xl text-white">Hips, kicks, and add-ons</h2>
        <p className="mt-1 text-sm text-white/70">
          Seated hip work, high kicks to a mark, and short power add-ons. Cues are ours. Each card links to the creator’s post.
        </p>
      </Link>

      <ul className="space-y-3">
        {LISTED_ROUTINES.map((routine) => {
          const locked = routine.access === "pro" && !pro;
          return (
            <li key={routine.id}>
              <Link
                href={`/mobility/${routine.id}`}
                className="block rounded-[1.5rem] border border-line bg-card px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl">{routine.title}</h2>
                  <span className="font-display text-xs uppercase tracking-wide text-accent">
                    {locked ? "Performance" : routine.access === "free" ? "Free" : "Open"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {routine.minutesLabel} · {routine.when}
                </p>
                <p className="mt-2 text-sm">{routine.summary}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-3">
        <Link href="/mobility/check-in" className="rounded-[1.5rem] bg-black px-4 py-4 text-white">
          <p className="font-display text-xs uppercase tracking-[0.12em] text-highlighter">Every 2 weeks</p>
          <h2 className="mt-1 text-2xl text-white">Mobility check-in</h2>
          <p className="mt-1 text-sm text-white/70">Sit-and-reach, splits, hips, ankles, kick height.</p>
        </Link>
        <Link href="/mobility/progression" className="rounded-[1.5rem] border border-line bg-white px-4 py-4">
          <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">6 weeks</p>
          <h2 className="mt-1 text-2xl">Flexibility progression</h2>
          <p className="mt-1 text-sm text-muted">Front split, side split, and a controlled head-height kick.</p>
        </Link>
      </div>

      {!pro ? (
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/mobility"
        />
      ) : null}

      <section className="space-y-2 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">Safety</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          {SAFETY_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted">{MOBILITY_DISCLAIMER}</p>
    </main>
  );
}
