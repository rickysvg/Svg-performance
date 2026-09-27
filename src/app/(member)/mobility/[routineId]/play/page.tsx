import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { expandPlaySteps, getMobilityRoutine, routineIsPro } from "@/lib/mobility";
import { MobilityPlayer } from "@/components/mobility/MobilityPlayer";
import { CreditList } from "@/components/mobility/CreditList";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityPlayPage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const user = await requireUser();
  const { routineId } = await params;
  const routine = getMobilityRoutine(routineId);
  if (!routine) notFound();
  const [pro, trial] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
  ]);
  if (routineIsPro(routine.id) && !pro) {
    return (
      <main className="space-y-4">
        <Link href={`/mobility/${routine.id}`} className="text-sm font-semibold text-accent">
          Back
        </Link>
        <h1 className="text-3xl">{routine.title}</h1>
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next={`/mobility/${routine.id}/play`}
        />
      </main>
    );
  }
  const steps = expandPlaySteps(routine);
  return (
    <main className="space-y-5">
      <Link href={`/mobility/${routine.id}`} className="text-sm font-semibold text-accent">
        Back
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Follow along</p>
        <h1 className="mt-1 text-3xl">{routine.title}</h1>
      </div>
      <MobilityPlayer steps={steps} logHref={`/mobility/${routine.id}/log`} />
      <CreditList credits={routine.credits} />
    </main>
  );
}
