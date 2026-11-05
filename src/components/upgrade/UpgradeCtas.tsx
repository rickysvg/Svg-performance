import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
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
    <div className="space-y-2">
      <CheckoutButton plan="performance_monthly" label={`${upgradeLabel} · $9.99/mo`} />
      <CheckoutButton plan="performance_year" label={`${upgradeLabel} · $72.99/yr`} />
      <Link href="/pricing" className="inline-flex text-sm text-accent underline">
        Compare plans
      </Link>
    </div>
  );
}
