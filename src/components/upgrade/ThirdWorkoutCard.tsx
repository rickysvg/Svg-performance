import { dismissThirdWorkoutCardAction } from "@/app/actions/trial";
import { UpgradeCtas } from "@/components/upgrade/UpgradeCtas";

export function ThirdWorkoutCard({
  canStartTrial,
  trialDays,
}: {
  canStartTrial: boolean;
  trialDays: number;
}) {
  return (
    <section className="rounded-2xl border border-black bg-white p-5">
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-black">
        Nice work
      </p>
      <h2 className="font-display mt-2 text-2xl font-semibold uppercase tracking-wide text-black">
        Three sessions logged
      </h2>
      <p className="mt-2 text-sm text-muted">
        You&apos;ve logged 3 sessions. See your progress charts, food tracking and SVG
        Coach in Performance.
      </p>
      <div className="mt-4">
        <UpgradeCtas canStartTrial={canStartTrial} trialDays={trialDays} />
      </div>
      <form action={dismissThirdWorkoutCardAction} className="mt-3">
        <button type="submit" className="text-sm text-muted underline underline-offset-4">
          Dismiss
        </button>
      </form>
    </section>
  );
}
