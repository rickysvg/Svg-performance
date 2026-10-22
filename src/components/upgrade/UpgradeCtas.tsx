import Link from "next/link";
import { startTrialAction } from "@/app/actions/trial";

export function UpgradeCtas({
  canStartTrial,
  trialDays,
  next = "/home",
  trialLabel,
  upgradeLabel = "Subscribe",
}: {
  canStartTrial: boolean;
  trialDays?: number;
  next?: string;
  trialLabel?: string;
  upgradeLabel?: string;
}) {
  if (canStartTrial) {
    return (
      <form data-testid="chrome-form-4" action={startTrialAction}>
        <input type="hidden" name="next" value={next} />
        <button
          data-testid="chrome-button"
          type="submit"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          {trialLabel ?? `Start ${trialDays && trialDays > 0 ? trialDays : 7}-day free trial`}
        </button>
      </form>
    );
  }
  return (
    <Link
      href="/pricing"
      className="touch-target inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
    >
      {upgradeLabel}
    </Link>
  );
}
