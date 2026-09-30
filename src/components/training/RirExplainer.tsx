import { RIR_PLAIN } from "@/lib/rir";

/** Train help. Starts collapsed so the day’s plan is the first thing on Train. */
export function RirExplainer() {
  return (
    <details data-rir-explainer className="rounded-2xl border border-line bg-card px-4 py-3">
      <summary className="font-display cursor-pointer text-xs uppercase tracking-wide text-accent">
        How heavy — RIR
      </summary>
      <p className="mt-2 text-sm leading-snug">{RIR_PLAIN}</p>
    </details>
  );
}
