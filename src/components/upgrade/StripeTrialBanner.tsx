import { shortMonthDay, trialDaysRemaining } from "@/lib/subscription-copy";

/** Home countdown for a Stripe trial, same shape as the no-card reminder. */
export function StripeTrialBanner({ trialEnd }: { trialEnd: Date }) {
  const days = trialDaysRemaining(trialEnd);
  if (days < 1) return null;
  const unit = days === 1 ? "day" : "days";
  return (
    <section data-stripe-trial-banner="1" className="mb-4 rounded-2xl border border-black bg-accent/20 p-4">
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Pro</p>
      <h2 className="mt-1 text-lg text-black">
        {days} {unit} left on your Pro trial
      </h2>
      <p className="mt-1 text-sm text-black">
        Trial ends {shortMonthDay(trialEnd)}. Your card is on file. One trial per person.
      </p>
    </section>
  );
}
