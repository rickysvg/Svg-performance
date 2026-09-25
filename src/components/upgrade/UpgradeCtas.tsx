import Link from "next/link";
import { startTrialAction } from "@/app/actions/trial";

export function UpgradeCtas({
  canStartTrial,
  next = "/home",
  trialLabel,
  upgradeLabel = "Upgrade",
}: {
  canStartTrial: boolean;
  trialDays?: number;
  next?: string;
  trialLabel?: string;
  upgradeLabel?: string;
}) {
  if (canStartTrial) {
    return (
      <form action={startTrialAction}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent font-semibold text-black"
        >
          {trialLabel ?? "Start free trial"}
        </button>
      </form>
    );
  }
  return (
    <Link
      href="/pricing"
      className="touch-target inline-flex w-full items-center justify-center rounded-full bg-accent font-semibold text-black"
    >
      {upgradeLabel}
    </Link>
  );
}
