import { UpgradeCtas } from "@/components/upgrade/UpgradeCtas";

const BLURBS: Record<string, { title: string; body: string }> = {
  tutorial: {
    title: "This lesson is in Performance",
    body: "You can see the title and thumbnail on the free plan. The video and write-up open with a short Performance trial or an upgrade. No card needed for the trial.",
  },
  fuel: {
    title: "Food tracking is in Performance",
    body: "Log meals and macros on Performance. Start a short free trial — no card — or upgrade anytime from Profile.",
  },
  coach: {
    title: "SVG Coach is in Performance",
    body: "SVG Coach is an AI assistant, not Ricky. Try it on a short free trial, or upgrade anytime from Profile.",
  },
  charts: {
    title: "Progress charts are in Performance",
    body: "Workout logging stays on the free plan. Charts, food tracking, and SVG Coach open with Performance.",
  },
};

export function UpgradePreview({
  kind,
  canStartTrial,
  trialDays,
  next = "/home",
  onDismiss,
  framed = true,
}: {
  kind: keyof typeof BLURBS;
  canStartTrial: boolean;
  trialDays: number;
  next?: string;
  onDismiss?: () => void;
  framed?: boolean;
}) {
  const copy = BLURBS[kind];
  return (
    <section className={framed ? "rounded-2xl border border-line bg-white p-5" : "bg-white"}>
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">
        Performance
      </p>
      <h2 className="font-display mt-2 text-2xl uppercase tracking-wide text-black">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm text-muted">{copy.body}</p>
      <div className="mt-4 space-y-3">
        <UpgradeCtas canStartTrial={canStartTrial} trialDays={trialDays} next={next} />
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="touch-target w-full rounded-full border border-black bg-white font-semibold text-black"
          >
            Not now
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted">You can upgrade anytime from Profile.</p>
    </section>
  );
}
