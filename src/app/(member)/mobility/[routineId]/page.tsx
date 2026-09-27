import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getMobilityRoutine, routineIsPro } from "@/lib/mobility";
import { CreditList } from "@/components/mobility/CreditList";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityRoutinePage({
  params,
  searchParams,
}: {
  params: Promise<{ routineId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { routineId } = await params;
  const query = await searchParams;
  const routine = getMobilityRoutine(routineId);
  if (!routine) notFound();
  const [pro, trial] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
  ]);
  const locked = routineIsPro(routine.id) && !pro;

  return (
    <main className="space-y-5">
      <Link href="/mobility" className="text-sm font-semibold text-accent">
        All routines
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">
          {routine.minutesLabel} · {routine.when}
        </p>
        <h1 className="mt-1 text-3xl">{routine.title}</h1>
        <p className="mt-2 text-sm text-muted">{routine.summary}</p>
      </div>
      {query.saved ? (
        <p className="rounded-full bg-accent px-4 py-2 text-center text-sm text-black">Session saved.</p>
      ) : null}
      {locked ? (
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next={`/mobility/${routine.id}`}
        />
      ) : (
        <>
          <div className="grid gap-3">
            <Link
              href={`/mobility/${routine.id}/play`}
              className="touch-target flex items-center justify-center rounded-full bg-accent text-black"
            >
              Follow along
            </Link>
            <Link
              href={`/mobility/${routine.id}/log`}
              className="touch-target flex items-center justify-center rounded-full border border-black font-semibold"
            >
              Log holds and reps
            </Link>
          </div>
          <ol className="space-y-3">
            {routine.blocks.map((block) => (
              <li key={block.key} className="rounded-2xl border border-line bg-card px-4 py-3">
                <p className="font-semibold">
                  {block.name}
                  {block.advanced ? " · advanced" : ""}
                </p>
                <p className="text-sm text-muted">{block.prescription}</p>
                <p className="mt-1 text-sm">{block.cues}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      <CreditList credits={routine.credits} />
    </main>
  );
}
