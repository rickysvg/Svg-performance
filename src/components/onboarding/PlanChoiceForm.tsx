import { continueFreePlanAction, startTrialAction } from "@/app/actions/trial";

export function PlanChoiceForm({
  verified,
  trialDays,
}: {
  verified: boolean;
  trialDays: number;
}) {
  const title = verified ? "Your free member plan is ready" : "Your free preview is ready";
  const trialButton = `Start ${trialDays} days of Performance free`;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">
          {verified ? "SVG Member Access" : "Free preview"}
        </p>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Workout logging, beginner tutorials, one starter program, announcements,
          shop links, and a daily quote teaser
          {verified ? " come with your academy membership." : " stay open on the free preview."}{" "}
          Performance adds the full Learn library, food tracking, SVG Coach, and
          progress charts.
        </p>
      </div>

      <form action={startTrialAction} className="space-y-3">
        <input type="hidden" name="next" value="/onboarding/deeper" />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          {trialButton}
        </button>
      </form>

      <form action={continueFreePlanAction}>
        <input type="hidden" name="next" value="/onboarding/deeper" />
        <button
          type="submit"
          className="touch-target w-full rounded-full border border-black bg-white font-semibold text-black"
        >
          Continue with free plan
        </button>
      </form>

      <p className="text-sm text-muted">You can upgrade anytime from Profile.</p>
    </div>
  );
}
