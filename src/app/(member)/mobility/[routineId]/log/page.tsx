import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser } from "@/lib/profile";
import { getMobilityRoutine, logRowsFor, routineIsPro } from "@/lib/mobility";
import { previousMobilityLogs } from "@/lib/mobility-store";
import { lengthUnitForLoad } from "@/lib/length-units";
import { MobilityLogForm, type PreviousCell } from "@/components/mobility/MobilityLogForm";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

export default async function MobilityLogPage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const user = await requireUser();
  const { routineId } = await params;
  const routine = getMobilityRoutine(routineId);
  if (!routine) notFound();
  const [pro, trial, profile] = await Promise.all([
    canUseFeature(user.id, "mobility_pro"),
    getTrialState(user.id),
    getProfileForUser(user.id),
  ]);
  if (routineIsPro(routine.id) && !pro) {
    return (
      <main className="space-y-4">
        <h1 className="text-3xl">{routine.title}</h1>
        <UpgradePreview
          kind="mobility"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next={`/mobility/${routine.id}/log`}
        />
      </main>
    );
  }
  const unit = lengthUnitForLoad(profile?.preferredUnits ?? "lb");
  const previousMap = await previousMobilityLogs(user.id, routine.id);
  const previous: Record<string, PreviousCell> = {};
  for (const [key, row] of previousMap) {
    previous[key] = {
      holdSeconds: row.holdSeconds,
      reps: row.reps,
      sets: row.sets,
      depthValue: row.depthValue,
      heightMark: row.heightMark,
    };
  }
  const rows = logRowsFor(routine);
  return (
    <main className="space-y-5">
      <Link href={`/mobility/${routine.id}`} className="text-sm font-semibold text-accent">
        Back
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Log</p>
        <h1 className="mt-1 text-3xl">{routine.title}</h1>
      </div>
      <MobilityLogForm
        routineId={routine.id}
        rows={rows}
        previous={previous}
        unit={unit}
      />
    </main>
  );
}
